'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Mic, X, MapPin } from 'lucide-react'

// Define el evento que viene del canal de supabase
type EmergencyEvent = {
  type: 'sos' | 'audio',
  payload: {
    operatorId: string,
    lat?: number,
    lng?: number,
    serviceId?: string,
    message?: string
  }
}

export default function EmergencyNotifier() {
  const [alerts, setAlerts] = useState<EmergencyEvent[]>([])

  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase.channel('emergency-alerts')
      .on('broadcast', { event: 'sos' }, (payload) => {
        setAlerts(curr => [...curr, { type: 'sos', payload: payload.payload }])
        // Reproducir sonido de sirena/alerta aquí (opcional)
        // new Audio('/alert.mp3').play().catch(console.error)
      })
      .on('broadcast', { event: 'audio' }, (payload) => {
        setAlerts(curr => [...curr, { type: 'audio', payload: payload.payload }])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (alerts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full">
      {alerts.map((alert, idx) => (
        <div key={idx} className={`rounded-xl shadow-2xl border-l-8 p-4 bg-white relative overflow-hidden animate-in slide-in-from-right
          ${alert.type === 'sos' ? 'border-red-600' : 'border-blue-500'}`}>
          
          <button 
            onClick={() => setAlerts(curr => curr.filter((_, i) => i !== idx))}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex gap-3">
            <div className={`p-2 rounded-full h-fit
               ${alert.type === 'sos' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-100 text-blue-600'}
            `}>
               {alert.type === 'sos' ? <AlertCircle className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </div>
            
            <div className="flex-1">
               <h4 className="font-bold text-slate-900 text-sm">
                 {alert.type === 'sos' ? '⚠️ ALERTA S.O.S OPERADOR' : '🎙️ NUEVO AUDIO RECIBIDO'}
               </h4>
               <p className="text-xs text-slate-600 mt-1">
                 {alert.payload.message || 'El operador ha activado una alerta desde la App.'}
               </p>
               
               {alert.payload.serviceId && (
                 <a href={`/dashboard/services/${alert.payload.serviceId}`} 
                    className="inline-block mt-2 text-xs font-bold text-blue-600 hover:underline">
                    Ver Folio de Servicio →
                 </a>
               )}
               
               {alert.payload.lat && alert.payload.lng && (
                 <a href={`https://maps.google.com/?q=${alert.payload.lat},${alert.payload.lng}`}
                    target="_blank" rel="noreferrer"
                    className="flex mt-2 items-center gap-1 text-xs font-bold text-red-600 hover:underline">
                    <MapPin className="h-3 w-3" /> Ver Ubicación Exacta
                 </a>
               )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
