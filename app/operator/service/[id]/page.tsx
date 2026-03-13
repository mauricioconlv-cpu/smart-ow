'use client'

import { createClient } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronRight, MapPin, Navigation } from 'lucide-react'
import StatusUpdateForm from './StatusUpdateForm'
import { useOperatorStore } from '../../store'

export default function ServiceControlPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const serviceId = params.id
  
  // Guardando en Zustand
  const { setActiveService } = useOperatorStore()
  
  useEffect(() => {
     setActiveService(serviceId)
     return () => setActiveService(null) // Cleanup
  }, [serviceId, setActiveService])

  // Cambia a client fetching por simplificar el hook
  const [service, setService] = useState<any>(null)

  useEffect(() => {
    supabase.from('services').select('*, clients(name)').eq('id', serviceId).single()
      .then((res: any) => setService(res.data))
  }, [serviceId, supabase])

  if (!service) return <div className="p-8 text-center">Cargando servicio...</div>

  const STEPS = [
    { id: 'creado', title: 'Asignado a Grúa' },
    { id: 'rumbo_contacto', title: 'Rumbo al Siniestro' },
    { id: 'arribo_origen', title: 'Llegada al Origen' },
    { id: 'contacto', title: 'Maniobra y Enganche' },
    { id: 'inicio_traslado', title: 'Traslado al Destino' },
    { id: 'traslado_concluido', title: 'Llegada a Destino (Descargado)' },
    { id: 'servicio_cerrado', title: 'Finalizado y Firmado' }
  ]

  const currentStepIndex = STEPS.findIndex(s => s.id === service.status)
  
  // Si el servicio no está cerrado, determinamos cuál es el "Siguiente paso" lógico
  const nextStep = currentStepIndex < STEPS.length - 1 ? STEPS[currentStepIndex + 1] : null

  return (
    <div className="flex flex-col h-full bg-slate-50">
       
       <header className="bg-white px-4 py-3 border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
         <div className="flex items-center gap-3">
            <Link href="/operator" className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="h-5 w-5 text-slate-700" />
            </Link>
            <div>
              <p className="text-xs font-bold text-blue-600">FOLIO #{service.folio}</p>
              <h1 className="text-sm font-bold text-slate-900 truncate w-48">{service.clients?.name}</h1>
            </div>
         </div>
       </header>

       <div className="flex-1 p-4 space-y-6 pb-32">
          
          {/* Card Resumen Rápido */}
          <section className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100 flex flex-col gap-3">
             <div className="flex gap-3">
               <Navigation className="h-5 w-5 text-slate-400 mt-1" />
               <div className="flex-1">
                 <p className="text-xs font-semibold text-slate-500 uppercase">Origen</p>
                 <p className="text-sm font-medium text-slate-900 line-clamp-2">
                   {service.origen_coords?.address || "No especificado por el call center"}
                 </p>
               </div>
             </div>
             <hr className="border-slate-100" />
             <div className="flex gap-3">
               <MapPin className="h-5 w-5 text-red-400 mt-1" />
               <div className="flex-1">
                 <p className="text-xs font-semibold text-slate-500 uppercase">Destino</p>
                 <p className="text-sm font-medium text-slate-900 line-clamp-2">
                   {service.destino_coords?.address || "No especificado por el call center"}
                 </p>
               </div>
             </div>
          </section>

          {/* Stepper Vertical */}
          <section className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Línea de Vida del Servicio</h2>
            <div className="space-y-6">
              {STEPS.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isNext = index === currentStepIndex + 1;
                
                return (
                  <div key={step.id} className="relative flex items-start gap-4">
                     {/* Línea conectora */}
                     {index < STEPS.length - 1 && (
                       <div className={`absolute top-8 left-3.5 bottom-[-24px] w-0.5 ${isCompleted ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                     )}

                     {/* Icono Círculo */}
                     <div className="relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white">
                        {isCompleted ? (
                           <CheckCircle2 className="h-7 w-7 text-blue-600 bg-white" />
                        ) : isCurrent ? (
                           <div className="h-5 w-5 rounded-full border-4 border-blue-600 bg-white"></div>
                        ) : (
                           <div className="h-4 w-4 rounded-full border-2 border-slate-300 bg-white"></div>
                        )}
                     </div>

                     {/* Texto Paso */}
                     <div className="min-w-0 flex-1 flex justify-between items-center py-0.5">
                       <span className={`text-sm font-medium ${isCompleted ? 'text-slate-900' : isCurrent ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>
                         {step.title}
                       </span>
                     </div>
                  </div>
                )
              })}
            </div>
          </section>
       </div>

       {nextStep && (
         <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 p-4 shadow-2xl z-20">
           {nextStep.id === 'servicio_cerrado' ? (
              <Link 
                href={`/operator/service/${service.id}/close`}
                className="w-full flex items-center justify-between bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-4 px-5 rounded-xl transition-all shadow-lg active:scale-[0.98]"
              >
                <span>Proceder a Firmar</span>
                <ChevronRight className="h-6 w-6" />
              </Link>
           ) : (
             <StatusUpdateForm 
               serviceId={service.id} 
               nextStatus={nextStep.id} 
               buttonLabel={`Avanzar a: ${nextStep.title}`}
             />
           )}
         </div>
       )}

    </div>
  )
}
