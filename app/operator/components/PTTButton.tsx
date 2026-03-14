'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function PTTButton({ activeServiceId }: { activeServiceId?: string }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    if (!activeServiceId) return; // Solo graba si está en un servicio
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await uploadAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop()) // Apagar micro
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Error al acceder al micrófono:", err)
      alert("No se pudo acceder al micrófono. Revise permisos.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const uploadAudio = async (blob: Blob) => {
     setIsUploading(true)
     try {
       const { data: { user } } = await supabase.auth.getUser()
       if (!user) throw new Error("No autenticado")

       const fileName = `${activeServiceId}/${Date.now()}.webm`
       
       // 1. Subir al Bucket "audios"
       const { error: uploadErr } = await supabase.storage
         .from('audios')
         .upload(fileName, blob, { contentType: 'audio/webm' })
         
       if (uploadErr) throw uploadErr
       
       const { data: { publicUrl } } = supabase.storage.from('audios').getPublicUrl(fileName)

       // 2. Registrar en Bitácora (El Call Center escucha esta tabla)
       await supabase.from('service_logs').insert({
         service_id: activeServiceId,
         created_by: user.id,
         type: 'audio_ptt',
         resource_url: publicUrl,
         note: 'Mensaje de voz de Operador'
       })

       // 3. Notificar en vivo al Call Center
       const channel = supabase.channel('emergency-alerts')
       await channel.send({
          type: 'broadcast',
          event: 'audio',
          payload: { operatorId: user.id, serviceId: activeServiceId, message: 'El operador acaba de enviar una nota de voz.' }
       })
       
     } catch(e: any) {

        alert("Error al enviar audio: " + e.message)
     } finally {
        setIsUploading(false)
     }
  }

  // Interfaz tipo "Mantener Presionado"
  return (
    <button
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onMouseLeave={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      disabled={isUploading || !activeServiceId}
      className={`relative p-3 rounded-full flex items-center justify-center transition-all touch-none select-none
        ${!activeServiceId ? 'bg-slate-200 text-slate-400 opacity-50' : 
          isRecording ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse scale-110' : 
          isUploading ? 'bg-amber-400 text-amber-900' : 'bg-blue-600 text-white shadow-md hover:bg-blue-500'}`}
    >
      {isUploading ? (
         <Loader2 className="h-5 w-5 animate-spin" />
      ) : isRecording ? (
         <Square className="h-5 w-5 fill-current" /> // Icono cuadro de stop
      ) : (
         <Mic className="h-5 w-5" />
      )}
    </button>
  )
}
