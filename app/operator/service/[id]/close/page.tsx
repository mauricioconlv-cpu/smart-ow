'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import SignatureCanvas from 'react-signature-canvas'
import { Star, Save, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CloseServicePage({ params }: { params: { id: string } }) {
  const serviceId = params.id
  const router = useRouter()
  const supabase = createClient()
  const sigCanvas = useRef<any>(null)
  
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleClearSignature = () => {
    sigCanvas.current?.clear()
  }

  const handleCompleteService = async () => {
    if (rating === 0) {
      setErrorMsg("Por favor, califique el servicio.")
      return
    }
    
    if (sigCanvas.current?.isEmpty()) {
      setErrorMsg("La firma del cliente es obligatoria.")
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      // 1. Obtener la firma como Blob PNG
      const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png')
      const res = await fetch(signatureDataUrl)
      const blob = await res.blob()

      // 2. Subir firma a Supabase Storage
      const fileName = `${serviceId}/firma_${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage
        .from('firmas')
        .upload(fileName, blob, { contentType: 'image/png' })

      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage.from('firmas').getPublicUrl(fileName)

      // 3. Actualizar el registro del servicio a "Cerrado"
      const { error: updateErr } = await supabase
        .from('services')
        .update({
          status: 'servicio_cerrado',
          calidad_estrellas: rating,
          comentarios_calidad: comments,
          firma_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', serviceId)

      if (updateErr) throw updateErr

      // Redirigir al inicio del operador
      router.push('/operator?success=cerrado')
      router.refresh()

    } catch (e: any) {
      setErrorMsg(e.message || "Ocurrió un error al guardar.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
       <header className="bg-white px-4 py-3 border-b flex items-center gap-3">
         <Link href={`/operator/service/${serviceId}`} className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="h-5 w-5 text-slate-700" />
         </Link>
         <h1 className="text-sm font-bold text-slate-900">Finalizar Servicio (Firma)</h1>
       </header>

       <div className="flex-1 p-4 space-y-6 pb-24">
         
         {/* Calificación */}
         <section className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
            <h2 className="text-base font-bold text-slate-800 mb-1">Encuesta de Calidad</h2>
            <p className="text-xs text-slate-500 mb-4">Pida al cliente que evalúe el trato y servicio brindado.</p>
            
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`p-2 transition-transform active:scale-95 ${rating >= star ? 'text-yellow-400' : 'text-slate-200'}`}
                >
                  <Star className="h-10 w-10 fill-current" />
                </button>
              ))}
            </div>

            <textarea
               rows={2}
               placeholder="Comentarios adicionales del cliente (opcional)"
               value={comments}
               onChange={e => setComments(e.target.value)}
               className="w-full rounded-xl border-slate-200 text-sm focus:ring-blue-600 focus:border-blue-600"
            />
         </section>

         {/* Firma Digital */}
         <section className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100 relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-800">Firma de Conformidad</h2>
              <button 
                type="button" 
                onClick={handleClearSignature}
                className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded"
              >
                Limpiar Panel
              </button>
            </div>
            
            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden touch-none">
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="blue"
                canvasProps={{ className: 'w-full h-48 sm:h-64' }} 
              />
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">Firmar sobre la línea punteada</p>
         </section>

         {errorMsg && (
           <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium border border-red-100">
             {errorMsg}
           </div>
         )}
       </div>

       {/* Floating Submit Action */}
       <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 p-4 shadow-2xl z-20">
         <button
           onClick={handleCompleteService}
           disabled={isSubmitting}
           className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-4 rounded-xl transition-all active:scale-[0.98] disabled:bg-green-400"
         >
           {isSubmitting ? (
             <><Loader2 className="h-6 w-6 animate-spin" /> Guardando Acta...</>
           ) : (
             <><Save className="h-6 w-6" /> Concluir Servicio</>
           )}
         </button>
       </div>
    </div>
  )
}
