'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Clock, AlertTriangle, Truck, Search, X, Plus } from 'lucide-react'

type TabType = 'abierto' | 'cotizacion' | 'cancelado_momento' | 'cancelado_posterior'

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('abierto')
  const [services, setServices] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [searchQuery, setSearchQuery] = useState('')

  const supabase = createClient()

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from('services')
        .select('*, client:clients(name), operator:profiles(full_name, grua_asignada)')
        .order('created_at', { ascending: false })
      if (data) setServices(data)
    }

    fetchServices()

    const channel = supabase.channel('services_list_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        fetchServices()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Contadores por pestaña
  const tabCounts = useMemo(() => ({
    abierto: services.filter(s =>
      !['creado','en_captura','sin_operador','cotizacion','asignando','cancelado_momento','cancelado_posterior','terminado','servicio_cerrado'].includes(s.status)
    ).length,
    cotizacion: services.filter(s =>
      ['creado','en_captura','sin_operador','cotizacion','asignando'].includes(s.status)
    ).length,
    cancelado_momento: services.filter(s => s.status === 'cancelado_momento').length,
    cancelado_posterior: services.filter(s => s.status === 'cancelado_posterior').length,
  }), [services])

  // Filtrado por búsqueda O por pestaña
  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    if (q) {
      return services.filter(s => {
        const folioMatch      = String(s.folio).includes(q)
        const expMatch        = (s.numero_expediente || '').toLowerCase().includes(q)
        const insuranceMatch  = (s.insurance_folio   || '').toLowerCase().includes(q)
        return folioMatch || expMatch || insuranceMatch
      })
    }

    return services.filter(s => {
      switch (activeTab) {
        case 'abierto':
          return !['creado','en_captura','sin_operador','cotizacion','asignando','cancelado_momento','cancelado_posterior','terminado','servicio_cerrado'].includes(s.status)
        case 'cotizacion':
          return ['creado','en_captura','sin_operador','cotizacion','asignando'].includes(s.status)
        case 'cancelado_momento':
          return s.status === 'cancelado_momento'
        case 'cancelado_posterior':
          return s.status === 'cancelado_posterior'
        default: return true
      }
    })
  }, [services, activeTab, searchQuery])

  const [notifiedFolios, setNotifiedFolios] = useState(new Set<number>())

  const triggerPushAlert = (folio: number, msg: string) => {
    if (notifiedFolios.has(folio)) return
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`🔥 Alerta SLA Folio #${folio}`, { body: msg })
        setNotifiedFolios(prev => new Set(prev).add(folio))
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission()
      }
    }
  }

  const calculateSLA = (service: any) => {
    let color = 'bg-slate-100', text = 'text-slate-600', warning = false
    let message = 'Dentro de tiempo', barColor = 'bg-blue-500', progress = 0

    if (!service.created_at) return { color, text, warning, message, progress, barColor }

    const started = new Date(service.created_at).getTime()
    const elapsedMins = (currentTime - started) / 60000

    if (service.status === 'creado' || service.status === 'en_captura') {
      progress = 5
      if (elapsedMins > 3) {
        color = 'bg-red-100'; text = 'text-red-700'; barColor = 'bg-red-600'
        warning = true; message = 'Tiempo excedido en toma de datos (>3m)'
        triggerPushAlert(service.folio, message)
      } else {
        color = 'bg-green-100'; text = 'text-green-700'; barColor = 'bg-green-500'
      }
    } else if (service.status === 'sin_operador') {
      progress = 10
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

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Servicios de Arrastre</h2>
          <p className="text-sm text-slate-500">Monitorea los folios activos y su estado SLA.</p>
        </div>
        <Link
          href="/dashboard/services/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Servicio
        </Link>
      </div>

      {/* Barra de Tabs + Buscador */}
      <div className="flex items-center border-b border-slate-200 bg-slate-50 overflow-x-auto shrink-0">
        <TabButton active={activeTab==='abierto'} count={tabCounts.abierto} onClick={()=>{setActiveTab('abierto'); setSearchQuery('')}}>Servicios Abiertos</TabButton>
        <TabButton active={activeTab==='cotizacion'} count={tabCounts.cotizacion} onClick={()=>{setActiveTab('cotizacion'); setSearchQuery('')}}>Exp. en Cotización</TabButton>
        <TabButton active={activeTab==='cancelado_momento'} count={tabCounts.cancelado_momento} onClick={()=>{setActiveTab('cancelado_momento'); setSearchQuery('')}}>Cancelados Inmediatos</TabButton>
        <TabButton active={activeTab==='cancelado_posterior'} count={tabCounts.cancelado_posterior} onClick={()=>{setActiveTab('cancelado_posterior'); setSearchQuery('')}}>Cancelados Posterior</TabButton>

        <div className="ml-auto flex-shrink-0 px-3 py-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar folio o expediente..."
              className="pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Aviso de búsqueda */}
      {searchQuery && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 font-medium flex items-center gap-2 shrink-0">
          <Search className="w-3 h-3" />
          {filteredServices.length === 0
            ? `Sin resultados para "${searchQuery}"`
            : `${filteredServices.length} resultado(s) para "${searchQuery}"`}
        </div>
      )}

      {/* Lista SLA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {filteredServices.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            {searchQuery ? `Sin resultados para "${searchQuery}"` : 'No hay servicios en este estatus.'}
          </div>
        ) : (
          filteredServices.map(service => {
            const sla = calculateSLA(service)
            return (
              <Link
                key={service.id}
                href={`/dashboard/services/${service.id}/capture`}
                className="block bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  {/* Folio + Cliente */}
                  <div className="flex space-x-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center font-black text-slate-700 text-sm hover:bg-blue-100 hover:text-blue-700 transition-colors">
                      #{service.folio}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{service.client?.name || 'Cliente Particular'}</p>
                      {service.numero_expediente && (
                        <p className="text-xs text-blue-600 font-medium mt-0.5">Exp: {service.numero_expediente}</p>
                      )}
                      <div className="flex gap-2 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1"><Truck className="w-3 h-3"/> {service.operator?.full_name || 'SIN ASIGNAR'}</span>
                        <span>•</span>
                        <span className="uppercase font-semibold text-slate-400">{service.status.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Barra SLA */}
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

                  {/* Acciones */}
                  <div className="flex items-center">
                    {service.status === 'sin_operador' && (
                      <span className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-bold rounded-lg shadow-sm">
                        Asignar Operador
                      </span>
                    )}
                    {service.status === 'en_captura' && (
                      <span className="bg-slate-900 hover:bg-black text-white px-4 py-2 text-sm font-bold rounded-lg shadow-sm">
                        Terminar Captura
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

function TabButton({ children, active, onClick, count }: { children: React.ReactNode, active: boolean, onClick: ()=>void, count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-4 text-sm font-bold uppercase tracking-wider shrink-0 transition-all border-b-2 flex items-center gap-2
        ${active ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`text-xs font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
          active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}
