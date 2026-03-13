'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { Clock, AlertTriangle, Truck, MapPin } from 'lucide-react'

// El mapa requiere cargarse dinámicamente para no crashear en SSR (Server-Side Rendering)
const LiveMap = dynamic(() => import('./components/Map'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">Cargando Satélite...</div> 
})

// Tipos de Pestaña
type TabType = 'abierto' | 'cotizacion' | 'cancelado_momento' | 'cancelado_posterior'

export default function LiveMonitorPage() {
  const [activeTab, setActiveTab] = useState<TabType>('cotizacion')
  const [services, setServices] = useState<any[]>([])
  const [operators, setOperators] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  const supabase = createClient()

  // 1. Reloj Maestro WebWorker para recalcular semáforos fluidamente cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  // 2. Cargar Operadores Activos para el Mapa
  useEffect(() => {
    const fetchOperators = async () => {
      const { data } = await supabase.from('profiles').select('*').in('role', ['operator', 'dispatcher'])
      if (data) setOperators(data)
    }
    fetchOperators()
  }, [])

  // 3. Cargar Servicios Activos (Monitor)
  useEffect(() => {
    const fetchServices = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, client:clients(name), operator:profiles(full_name, grua_asignada)')
        .order('created_at', { ascending: false })
      
      if (data) setServices(data)
    }

    fetchServices()

    // Suscripción Realtime para la matriz de control 
    const channel = supabase.channel('service_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, (payload) => {
        fetchServices() // Para simplificar recargamos la lista ante cualquier cambio
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // 4. Filtrado de Pestañas
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      switch (activeTab) {
        case 'cotizacion':
            // "En cotización" -> Solo los que fueron capturados inicialmente (en_captura o sin_operador)
            return ['creado', 'en_captura', 'sin_operador'].includes(s.status)
        case 'abierto':
            // "Abiertos" -> Asignados en tránsito (rumbo_contacto, contacto, traslado...)
            return !['creado', 'en_captura', 'sin_operador', 'cancelado_momento', 'cancelado_posterior', 'terminado', 'servicio_cerrado'].includes(s.status)
        case 'cancelado_momento':
            return s.status === 'cancelado_momento'
        case 'cancelado_posterior':
            return s.status === 'cancelado_posterior'
        default: return true
      }
    })
  }, [services, activeTab])

  // 5. Cálculador de Semaforización (SLA)
  const calculateSLA = (service: any) => {
     let color = 'bg-slate-100'
     let text = 'text-slate-600'
     let warning = false
     let message = 'Dentro de tiempo'
     let barColor = 'bg-blue-500'
     let progress = 0

     if (!service.created_at) return { color, text, warning, message, progress, barColor }

     const started = new Date(service.created_at).getTime()
     const elapsedMins = (currentTime - started) / 60000

     if (service.status === 'creado' || service.status === 'en_captura') {
         progress = 5 // (0-5%)
         if (elapsedMins > 3) {
            color = 'bg-red-100'; text = 'text-red-700'; barColor = 'bg-red-600'
            warning = true; message = 'Tiempo excedido en toma de datos (>3m)'
            triggerPushAlert(service.folio, message)
         } else {
            color = 'bg-green-100'; text = 'text-green-700'; barColor = 'bg-green-500'
         }
     } else if (service.status === 'sin_operador') {
         progress = 10 // (5-10%)
         if (elapsedMins > 5) {
            color = 'bg-red-100'; text = 'text-red-700'; barColor = 'bg-red-600'
            warning = true; message = 'Expediente Sin Asignar (>5m excedido)'
            triggerPushAlert(service.folio, message)
         } else {
            color = 'bg-orange-100'; text = 'text-orange-700'; barColor = 'bg-orange-400'
            message = 'Esperando asignación'
         }
     } else if (service.status === 'rumbo_contacto') {
         progress = 20
         const limit = service.es_foraneo ? 150 : 60
         if (elapsedMins > limit) {
             warning = true; message = `Expediente Sin Contacto (>${limit}m excedido)`; barColor = 'bg-red-600'
             color = 'bg-red-100'; text = 'text-red-700'
         } else {
             color = 'bg-sky-100'; text = 'text-sky-700'; barColor = 'bg-sky-400'
             message = 'Operador en camino (Local <60m, Foráneo <150m)'
         }
     } else {
         progress = 40
         barColor = 'bg-purple-500'
         message = `En tránsito (${service.status})`
     }

     return { color, text, warning, message, progress, barColor }
  }

  // Prevención de Flood Push (no enviar 1 notificación por react-render)
  const [notifiedFolios, setNotifiedFolios] = useState(new Set<number>())

  const triggerPushAlert = (folio: number, msg: string) => {
      // Si ya notificamos este folio en rojo, ignoramos.
      if (notifiedFolios.has(folio)) return;
      
      if (typeof window !== "undefined" && "Notification" in window) {
         if (Notification.permission === "granted") {
            new Notification(`🔥 Alerta SLA Folio #${folio}`, { body: msg })
            setNotifiedFolios(prev => new Set(prev).add(folio))
         } else if (Notification.permission !== "denied") {
            Notification.requestPermission()
         }
      }
  }


  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
      {/* 1. Módulo Superior: Mapa en Vivo (50% Altura) */}
      <section className="basis-1/2 min-h-0 bg-white shadow-sm border border-slate-200 rounded-xl p-3 flex flex-col relative z-0">
        <div className="flex justify-between items-center mb-2 z-10 px-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="text-blue-500 w-5 h-5" /> Ubicación Dinámica
            </h2>
            <div className="flex items-center gap-2">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-xs text-slate-500 font-medium tracking-wide">RASTREO ACTIVO</span>
            </div>
        </div>
        <div className="flex-1 relative z-0">
          <LiveMap operators={operators} />
        </div>
      </section>

      {/* 2. Módulo Inferior: Tablero SLA */}
      <section className="basis-1/2 min-h-0 flex flex-col bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden pb-4">
         {/* Tabs Navbar */}
         <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
             <TabButton active={activeTab==='cotizacion'} onClick={()=>setActiveTab('cotizacion')}>Exp. en Cotización</TabButton>
             <TabButton active={activeTab==='abierto'} onClick={()=>setActiveTab('abierto')}>Servicios Abiertos</TabButton>
             <TabButton active={activeTab==='cancelado_momento'} onClick={()=>setActiveTab('cancelado_momento')}>Cancelados Inmediatos</TabButton>
             <TabButton active={activeTab==='cancelado_posterior'} onClick={()=>setActiveTab('cancelado_posterior')}>Cancelados Posterior</TabButton>
         </div>

         {/* Lista Cajas SLA */}
         <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
             {filteredServices.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-slate-400 text-sm">No hay servicios en este estatus.</div>
             ) : (
                 filteredServices.map(service => {
                     const sla = calculateSLA(service)
                     return (
                         <div key={service.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-4 justify-between transition-all hover:border-blue-300">
                             {/* Fila superior / Izq */}
                             <div className="flex space-x-4">
                               <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center font-black text-slate-700">
                                   #{service.folio}
                               </div>
                               <div>
                                   <p className="font-bold text-slate-800">{service.client?.name || 'Cliente Particular'}</p>
                                   <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                       <span className="flex items-center gap-1"><Truck className="w-3 h-3"/> {service.operator?.full_name || 'SIN ASIGNAR'}</span>
                                       <span>•</span>
                                       <span className="uppercase font-semibold text-slate-400">{service.status.replace(/_/g, ' ')}</span>
                                   </div>
                               </div>
                             </div>

                             {/* Bloque Central de Tiempos (Barra y Estatus) */}
                             <div className="flex-1 flex flex-col justify-center max-w-lg w-full shrink-0">
                                <div className="flex justify-between text-xs font-bold mb-1 items-center">
                                    <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${sla.color} ${sla.text}`}>
                                        {sla.warning && <AlertTriangle className="w-3 h-3"/>}
                                        {sla.message}
                                    </span>
                                    <span className="text-slate-500">{sla.progress}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                                    <div className={`h-full ${sla.barColor} transition-all duration-1000 ease-in-out`} style={{width: `${sla.progress}%`}}></div>
                                </div>
                             </div>

                             {/* Botoneria Acciones (Contextual) */}
                             <div className="flex items-center">
                                 {service.status === 'sin_operador' && (
                                     <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-bold rounded-lg shadow-sm">
                                         Asignar Operador
                                     </button>
                                 )}
                                 {service.status === 'rumbo_contacto' && sla.warning && (
                                     <button className="border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 text-sm font-bold rounded-lg transition-colors group relative shadow-inner">
                                         Cancelar Asignación
                                     </button>
                                 )}
                                 {service.status === 'en_captura' && (
                                    <button className="bg-slate-900 hover:bg-black text-white px-4 py-2 text-sm font-bold rounded-lg shadow-sm">
                                       Terminar Captura
                                   </button>
                                 )}
                             </div>
                         </div>
                     )
                 })
             )}
         </div>
      </section>
    </div>
  )
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: ()=>void }) {
    return (
        <button 
           onClick={onClick}
           className={`px-6 py-4 text-sm font-bold uppercase tracking-wider shrink-0 transition-all border-b-2 
            ${active ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
        >
            {children}
        </button>
    )
}
