'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Stethoscope, Truck, Package, Video, Plus, Search, X, Clock, User, Phone } from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────────
type ServiceType = 'medico_domicilio' | 'reparto_medicamento' | 'telemedicina'
type TabType = 'abierto' | 'programado' | 'concluido' | 'cancelado'

const SERVICE_CONFIG: Record<ServiceType, {
  label: string
  prefix: string
  color: string
  bgColor: string
  borderColor: string
  icon: React.ReactNode
  openStatuses: string[]
}> = {
  medico_domicilio: {
    label: 'Médico a Domicilio',
    prefix: 'MD',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: <Stethoscope className="w-4 h-4" />,
    openStatuses: ['cotizacion','programado','rumbo_consulta','en_sitio','contacto_paciente','en_consulta'],
  },
  reparto_medicamento: {
    label: 'Reparto de Medicamento',
    prefix: 'RM',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: <Package className="w-4 h-4" />,
    openStatuses: ['cotizacion','programado','preparando','en_camino','entregado'],
  },
  telemedicina: {
    label: 'Telemedicina',
    prefix: 'TM',
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    icon: <Video className="w-4 h-4" />,
    openStatuses: ['cotizacion','programado','en_consulta'],
  },
}

const STATUS_LABELS: Record<string, string> = {
  cotizacion:        'Cotización',
  programado:        'Programado',
  rumbo_consulta:    'Rumbo a consulta',
  en_sitio:          'En sitio',
  contacto_paciente: 'Contacto paciente',
  en_consulta:       'En consulta',
  preparando:        'Preparando pedido',
  en_camino:         'En camino',
  entregado:         'Entregado',
  concluido:         'Concluido',
  cancelado:         'Cancelado',
}

const OPEN_STATUSES = [
  'cotizacion','programado','rumbo_consulta','en_sitio',
  'contacto_paciente','en_consulta','preparando','en_camino','entregado',
]

// ── Componente Principal ────────────────────────────────────────────────────
export default function MedicalServicesPage() {
  const [services, setServices] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('abierto')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentTime, setCurrentTime] = useState(Date.now())
  const supabase = createClient()

  // Reloj para calcular tiempos transcurridos
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 10000)
    return () => clearInterval(t)
  }, [])

  const fetchServices = useCallback(async () => {
    const { data } = await supabase
      .from('medical_services')
      .select(`
        id, folio, folio_prefix, service_type, status,
        patient_name, patient_phone, patient_address,
        scheduled_at, created_at, closed_at,
        cobro_cliente,
        doctor:medical_providers(full_name, specialty, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(300)
    if (data) setServices(data)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchServices()
    const ch = supabase
      .channel('medical_services_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_services' }, fetchServices)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchServices])

  // ── Contadores por tab ──────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    abierto:   services.filter(s => OPEN_STATUSES.includes(s.status) && s.status !== 'programado').length,
    programado: services.filter(s => s.status === 'programado').length,
    concluido:  services.filter(s => s.status === 'concluido').length,
    cancelado:  services.filter(s => s.status === 'cancelado').length,
  }), [services])

  // ── Filtro activo ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = services

    if (q) {
      list = list.filter(s =>
        String(s.folio).includes(q) ||
        `${s.folio_prefix}-${s.folio}`.toLowerCase().includes(q) ||
        (s.patient_name || '').toLowerCase().includes(q) ||
        (s.numero_expediente || '').toLowerCase().includes(q)
      )
    } else {
      list = list.filter(s => {
        switch (activeTab) {
          case 'abierto':    return OPEN_STATUSES.includes(s.status) && s.status !== 'programado'
          case 'programado': return s.status === 'programado'
          case 'concluido':  return s.status === 'concluido'
          case 'cancelado':  return s.status === 'cancelado'
          default: return true
        }
      })
    }
    return list
  }, [services, activeTab, searchQuery])

  // ── Tiempo transcurrido ─────────────────────────────────────────────────
  function elapsed(dateStr: string) {
    const mins = Math.floor((currentTime - new Date(dateStr).getTime()) / 60000)
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
            Servicios Médicos
          </h2>
          <p className="text-sm text-slate-500">Médico a Domicilio · Reparto de Medicamento · Telemedicina</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/medical/providers"
            className="flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-600 px-3 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            <User className="h-4 w-4" />
            Directorio de Doctores
          </Link>
          <Link
            href="/dashboard/medical/new"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Servicio Médico
          </Link>
        </div>
      </div>

      {/* Tabs + Buscador */}
      <div className="flex items-center border-b border-slate-200 bg-slate-50 overflow-x-auto shrink-0">
        <TabBtn active={activeTab === 'abierto'}    count={tabCounts.abierto}    onClick={() => { setActiveTab('abierto');    setSearchQuery('') }}>En Curso</TabBtn>
        <TabBtn active={activeTab === 'programado'} count={tabCounts.programado} onClick={() => { setActiveTab('programado'); setSearchQuery('') }}>Programados</TabBtn>
        <TabBtn active={activeTab === 'concluido'}  count={tabCounts.concluido}  onClick={() => { setActiveTab('concluido');  setSearchQuery('') }}>Concluidos</TabBtn>
        <TabBtn active={activeTab === 'cancelado'}  count={tabCounts.cancelado}  onClick={() => { setActiveTab('cancelado');  setSearchQuery('') }}>Cancelados</TabBtn>

        <div className="ml-auto flex-shrink-0 px-3 py-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar folio, paciente..."
              className="pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-52 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <Stethoscope className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {searchQuery ? `Sin resultados para "${searchQuery}"` : 'No hay servicios en esta categoría.'}
            </p>
          </div>
        ) : (
          filtered.map(svc => (
            <ServiceCard key={svc.id} service={svc} elapsed={elapsed} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Card de Servicio ────────────────────────────────────────────────────────
function ServiceCard({ service, elapsed }: { service: any; elapsed: (d: string) => string }) {
  const cfg = SERVICE_CONFIG[service.service_type as ServiceType] ?? SERVICE_CONFIG.medico_domicilio
  const folio = `${service.folio_prefix}-${String(service.folio).padStart(4, '0')}`
  const isOpen = OPEN_STATUSES.includes(service.status)

  return (
    <Link
      href={`/dashboard/medical/${service.id}`}
      className={`block bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:border-emerald-400 ${cfg.borderColor}`}
    >
      <div className="flex gap-4 items-start">

        {/* Folio badge */}
        <div className={`shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center font-black text-xs gap-0.5 ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
          <span className="text-[10px] font-bold opacity-70">{service.folio_prefix}</span>
          <span className="text-base font-black">#{service.folio}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              service.status === 'concluido' ? 'bg-green-100 text-green-700' :
              service.status === 'cancelado' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {STATUS_LABELS[service.status] ?? service.status}
            </span>
          </div>

          <p className="font-bold text-slate-800 truncate">{service.patient_name}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
            {service.patient_phone && (
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {service.patient_phone}</span>
            )}
            {service.doctor?.full_name && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> Dr. {service.doctor.full_name}</span>
            )}
            {service.patient_address && (
              <span className="truncate max-w-xs">📍 {service.patient_address}</span>
            )}
          </div>
        </div>

        {/* Tiempo + costo */}
        <div className="shrink-0 text-right text-xs text-slate-500 space-y-1">
          {isOpen && (
            <span className="flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" />
              {elapsed(service.created_at)}
            </span>
          )}
          {service.scheduled_at && service.status === 'programado' && (
            <span className="block text-violet-600 font-semibold">
              📅 {new Date(service.scheduled_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
          {service.cobro_cliente > 0 && (
            <span className="block font-bold text-slate-700">
              ${Number(service.cobro_cliente).toLocaleString('es-MX')}
            </span>
          )}
          {!isOpen && service.closed_at && (
            <span className="block text-slate-400">
              Cerrado {new Date(service.closed_at).toLocaleDateString('es-MX')}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Tab Button ──────────────────────────────────────────────────────────────
function TabBtn({ children, active, onClick, count }: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-4 text-sm font-bold uppercase tracking-wider shrink-0 transition-all border-b-2 flex items-center gap-2
        ${active ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`text-xs font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
          active ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}
