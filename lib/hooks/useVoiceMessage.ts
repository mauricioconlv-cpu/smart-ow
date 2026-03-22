'use client'

import { useRef, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export type VoiceMessageMode = 'idle' | 'recording' | 'uploading'

interface UseVoiceMessageOptions {
  serviceId: string | null | undefined
  /** 'operator' is the only role that records audio; dispatcher uses text only */
  role: 'operator'
}

interface UseVoiceMessageReturn {
  mode: VoiceMessageMode
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  lastTranscript: string
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function useVoiceMessage({ serviceId }: UseVoiceMessageOptions): UseVoiceMessageReturn {
  const [mode, setMode]                   = useState<VoiceMessageMode>('idle')
  const [lastTranscript, setLastTranscript] = useState('')

  const recorderRef      = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const recognitionRef   = useRef<any>(null)
  const transcriptAccum  = useRef('')

  // ── Start Web Speech API recognition (runs in parallel with recording) ──
  function startSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return
    const r = new SpeechRecognition()
    r.lang           = 'es-MX'
    r.continuous     = true
    r.interimResults = true
    transcriptAccum.current = ''
    r.onresult = (e: any) => {
      let final = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
      }
      if (final) transcriptAccum.current = final.trim()
    }
    r.onerror = () => {}
    r.start()
    recognitionRef.current = r
  }

  function stopSpeechRecognition() {
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
  }

  const startRecording = useCallback(async () => {
    if (!serviceId || mode !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(200) // collect chunks every 200ms
      recorderRef.current = recorder

      startSpeechRecognition()
      setMode('recording')
    } catch (err) {
      console.error('[VoiceMessage] mic error:', err)
    }
  }, [serviceId, mode])

  const stopRecording = useCallback(async () => {
    if (mode !== 'recording') return
    stopSpeechRecognition()
    setMode('uploading')

    const recorder = recorderRef.current
    if (!recorder) { setMode('idle'); return }

    // Wait for final chunk
    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
      recorder.stream?.getTracks().forEach(t => t.stop())
    })

    try {
      const mimeType  = recorder.mimeType || 'audio/webm'
      const ext       = mimeType.includes('ogg') ? 'ogg' : 'webm'
      const blob      = new Blob(chunksRef.current, { type: mimeType })
      const fileName  = `${serviceId}/voz_${Date.now()}.${ext}`

      // Upload to Storage
      const { error: uploadErr } = await supabase.storage
        .from('audios')
        .upload(fileName, blob, { contentType: mimeType })

      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage.from('audios').getPublicUrl(fileName)

      const transcript = transcriptAccum.current.trim() || '[Audio sin transcripción automática]'
      setLastTranscript(transcript)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // Log in bitácora
      if (user && serviceId) {
        await supabase.from('service_logs').insert({
          service_id:  serviceId,
          created_by:  user.id,
          type:        'voice_note',
          note:        transcript,
          resource_url: publicUrl,
          actor_role:  'operator',
          event_label: '🎙️ Operador — mensaje de voz',
        })
      }
    } catch (e: any) {
      console.error('[VoiceMessage] upload/log error:', e.message)
    } finally {
      recorderRef.current   = null
      chunksRef.current     = []
      setMode('idle')
    }
  }, [mode, serviceId])

  return { mode, startRecording, stopRecording, lastTranscript }
}
