'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function PanicButton({ activeServiceId }: { activeServiceId?: string }) {
  const [isSending, setIsSending] = useState(false)

  const triggerPanic = async () => {
    if (!navigator.geolocation) {
       alert("Geolocalización no soportada por el navegador.")
       return
    }
    
    setIsSending(true)

    navigator.geolocation.getCurrentPosition(async (position) => {
       const lat = position.coords.latitude
       const lng = position.coords.longitude
       
       const { data: { user } } = await supabase.auth.getUser()

       if (user) {
         // Insertar en la bitácora si hay un servicio activo
         if (activeServiceId) {
             await supabase.from('service_logs').insert({
               service_id: activeServiceId,
               created_by: user.id,
               type: 'panic_button',
               note: JSON.stringify({ lat, lng, alert: 'S.O.S disparado por el operador' }),
             })
         }
         
         // TODO: Aquí emitiremos un evento por Supabase Realtime Channels al Call Center
         const channel = supabase.channel('emergency-alerts')
         await channel.send({
            type: 'broadcast',
            event: 'sos',
            payload: { operatorId: user.id, lat, lng, serviceId: activeServiceId }
         })
         
         alert("¡Alerta S.O.S enviada al Call Center exitosamente!")
       }
       
       setIsSending(false)

    }, (error) => {
       alert(`Error obteniendo ubicación: ${error.message}`)
       setIsSending(false)
    }, {
       enableHighAccuracy: true
    })
  }

  return (
    <button 
      onClick={triggerPanic}
      disabled={isSending}
      className={`absolute bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-white font-bold leading-none transform transition-transform 
        ${isSending ? 'bg-red-400 scale-95' : 'bg-red-600 animate-pulse hover:bg-red-700 active:scale-90 hover:scale-105'} z-50`}
    >
      {isSending ? '...' : 'S.O.S'}
    </button>
  )
}
