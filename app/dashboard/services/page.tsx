'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Clock, AlertTriangle, Truck, Search, X, Plus, Mailbox } from 'lucide-react'

type TabType = 'abierto' | 'cotizacion' | 'cancelado_momento' | 'cancelado_posterior'

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('abierto')
  const [services, setServices] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [searchQuery, setSearchQuery] = useState('')
  // serviceId → true  means it has unread voicemail from the operator
  const [voicemailAlert, setVoicemailAlert] = useState<Record<string, boolean>>({})

  const supabase = createClient()

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  const fetchServices = useCallback(async () => {
    const { data } = await supabase
      .from('services')
      .select('*, client:clients(name), operator:profiles(full_name, grua_asignada)')
      .order('created_at', { ascending: false })
    if (data) setServices(data)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load services + real-time service updates ──────────────────────────
  useEffect(() => {
    fetchServices()
    const channel = supabase.channel('services_list_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, fetchServices)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchServices])

  // ── Listen for operator voicemail PTT → blink folio ───────────────────
  useEffect(() => {
    const logChannel = supabase
      .channel('voicemail_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'service_logs' },
        (payload: any) => {
          const row = payload.new
          // Only operator voice messages (voicemail_ptt) trigger the alert
          if (row.type === 'voicemail_ptt' && row.actor_role === 'operator') {
            const svcId = row.service_id

            // Find folio for the push notification
            setServices(prev => {
              const svc = prev.find(s => s.id === svcId)
              if (svc) {
                triggerVoicemailNotification(svc.folio, row.note)
              }
              return prev
            })

            // Start blink
            setVoicemailAlert(prev => ({ ...prev, [svcId]: true }))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(logChannel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function triggerVoicemailNotification(folio: number, note: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const body = note && note !== '[Audio sin transcripción]'
      ? `"${note.slice(0, 80)}"`
      : 'El operador dejó un audio. Ábrelo en el expediente.'
    if (Notification.permission === 'granted') {
      new Notification(`📩 Audio del Operador — Folio #${folio}`, { body })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(`📩 Audio del Operador — Folio #${folio}`, { body })
      })
    }
  }

  // Dismiss voicemail blink when user clicks the card
  function dismissAlert(serviceId: string) {
    setVoicemailAlert(prev => {
      if (!prev[serviceId]) return prev
      const next = { ...prev }
      delete next[serviceId]
      return next
    })
  }

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

    if (service.is_scheduled && service.scheduled_at) {
      const scheduledTime = new Date(service.scheduled_at).getTime()
      const minsUntilAppointment = (scheduledTime - currentTime) / 60000

      if (service.status === 'creado' || service.status === 'sin_operador') {
        progress = 10
        if (minsUntilAppointment <= 0) {
          color = 'bg-red-100'; text = 'text-red-700'; barColor = 'bg-red-600'
          warning = true; message = `❌ CITA RETRASADA (${Math.abs(Math.floor(minsUntilAppointment))}m)`
        } else if (minsUntilAppointment <= 180) {
          color = 'bg-pink-100'; text = 'text-pink-700'; barColor = 'bg-pink-500'
          warning = true; message = `🚨 ALERTA: Asignar grúa (Faltan ${Math.floor(minsUntilAppointment/60)}h ${Math.floor(minsUntilAppointment%60)}m)`
        } else {
          color = 'bg-purple-100'; text = 'text-purple-700'; barColor = 'bg-purple-400'
          message = `Cita programada (Faltan ${Math.floor(minsUntilAppointment/60)}h ${Math.floor(minsUntilAppointment%60)}m)`
        }
        return { color, text, warning, message, progress, barColor }
      }
    }

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

  const renderServiceCard = (service: any) => {
    const sla = calculateSLA(service)
    const hasVoicemail = voicemailAlert[service.id]

    const requiresAssignment = service.is_scheduled && (service.status === 'creado' || service.status === 'sin_operador')
    let isPulseColor = false
    if (requiresAssignment && service.scheduled_at) {
      const minsToAppt = (new Date(service.scheduled_at).getTime() - currentTime) / 60000
      if (minsToAppt <= 180) isPulseColor = true
    }

    return (
      <Link
        key={service.id}
        href={`/dashboard/services/${service.id}/tracking`}
        onClick={() => dismissAlert(service.id)}
        className={`block bg-white border rounded-lg p-4 shadow-sm relative overflow-hidden transition-all
          ${hasVoicemail
            ? 'border-green-400 shadow-green-100 shadow-md'
            : isPulseColor 
              ? 'pulse-magenta border-pink-500 shadow-pink-200 shadow-lg'
              : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
          }`}
      >
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Folio + Cliente */}
          <div className="flex space-x-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-black text-sm transition-colors
              ${hasVoicemail
                ? 'folio-voicemail-blink'
                : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700'
              }`}>
              #{service.folio}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-800">{service.client?.name || 'Cliente Particular'}</p>
                {hasVoicemail && (
                  <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700 animate-pulse">
                    <Mailbox className="w-3 h-3" /> NUEVO AUDIO
                  </span>
                )}
              </div>
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
  }

  return (
    <>
      {/* Blink keyframe */}
      <style>{`
        @keyframes folioVoicemail {
          0%,100% { background:#dcfce7; color:#15803d; transform:scale(1); }
          50%      { background:#16a34a; color:white;   transform:scale(1.08); }
        }
        .folio-voicemail-blink { animation: folioVoicemail 0.85s ease-in-out infinite; }

        @keyframes pulseMagenta {
          0%, 100% { border-color: #fbcfe8; box-shadow: 0 0 0 rgba(236,72,153,0); }
          50% { border-color: #fce7f3; box-shadow: 0 4px 14px rgba(236,72,153,0.8); background-color: #fdf2f8; }
        }
        .pulse-magenta { animation: pulseMagenta 1.5s ease-in-out infinite; border-width: 2px !important; }
      `}</style>

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
            <>
              {filteredServices.filter(s => !s.is_scheduled).map(service => renderServiceCard(service))}

              {filteredServices.some(s => s.is_scheduled) && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
                    📅 Servicios con Cita Programada
                  </h3>
                  <div className="space-y-3">
                    {filteredServices.filter(s => s.is_scheduled).map(service => renderServiceCard(service))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
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
