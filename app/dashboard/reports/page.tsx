'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { History, Search, X, Calendar, Users, Filter, Loader2, Star, AlertCircle } from 'lucide-react'
import ExportExcelButton from './ExportExcelButton'
import DownloadPDFButton from '@/app/operator/components/DownloadPDFButton'

// Todos los statuses que van al histórico
const CLOSED_STATUSES = ['servicio_cerrado', 'terminado', 'cancelado_posterior']

export default function ReportsPage() {
  const supabase = createClient()  // dentro del componente → sesión correcta

  const [services, setServices]     = useState<any[]>([])
  const [clients, setClients]       = useState<any[]>([])
  const [company, setCompany]       = useState<{ name: string; logo_url: string | null } | null>(null)
  const [loading, setLoading]       = useState(false)
  const [searched, setSearched]     = useState(false)
  const [queryError, setQueryError] = useState('')

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [clientId, setClientId]       = useState('')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')

  // Cargar lista de clientes + company del usuario autenticado
  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data, error }) => {
      if (error) console.error('clients error:', error)
      if (data) setClients(data)
    })

    // Cargar company para el logo del PDF
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('company_id').eq('id', user.id).single().then(({ data: prof }) => {
        if (!prof?.company_id) return
        supabase.from('companies').select('name, logo_url').eq('id', prof.company_id).single().then(({ data: co }) => {
          if (co) setCompany(co)
        })
      })
    })
  }, [])

  const hasFilters = !!(searchQuery.trim() || clientId || dateFrom || dateTo)

  const runSearch = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    setQueryError('')

    // Construir query base — usa OR en status para capturar todos los cerrados
    let query = supabase
      .from('services')
      .select(`
        id, folio, status, costo_calculado, calidad_estrellas,
        firma_url, tipo_servicio, created_at, updated_at,
        numero_expediente, insurance_folio, origen_coords, destino_coords,
        tipo_asistencia, tiempo_espera, calidad_operador,
        nombre_cliente_firma, comentarios_calidad,
        clients ( name ),
        profiles ( full_name )
      `)
      .in('status', CLOSED_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (clientId)  query = query.eq('client_id', clientId)
    if (dateFrom)  query = query.gte('updated_at', `${dateFrom}T00:00:00`)
    if (dateTo)    query = query.lte('updated_at', `${dateTo}T23:59:59`)

    const { data, error } = await query

    if (error) {
      console.error('reports search error:', error)
      setQueryError(error.message)
      setLoading(false)
      return
    }

    // Si hay texto de búsqueda, filtrar en cliente (folio / num expediente / insurance_folio)
    let result = data ?? []
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(s =>
        String(s.folio).includes(q) ||
        (s.numero_expediente || '').toLowerCase().includes(q) ||
        (s.insurance_folio   || '').toLowerCase().includes(q)
      )
    }

    setServices(result)
    setLoading(false)
  }, [searchQuery, clientId, dateFrom, dateTo])

  function clearFilters() {
    setSearchQuery(''); setClientId(''); setDateFrom(''); setDateTo('')
    setServices([]); setSearched(false); setQueryError('')
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-start pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="h-6 w-6 text-blue-600" />
            Historial y Reportes
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Consulta servicios cerrados filtrando por fecha, cliente o folio.
          </p>
        </div>
        <ExportExcelButton data={services} />
      </div>

      {/* Panel de filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-sm text-slate-700">Filtros de búsqueda</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition">
              <X className="w-3.5 h-3.5" /> Limpiar todo
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Búsqueda por folio */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Folio / Exp. Aseguradora</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && hasFilters && runSearch()}
                placeholder="Ej. 7 ó 5454544"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          {/* Filtro por cliente */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" /> Cliente / Aseguradora
            </label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Fecha desde */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Fecha desde
            </label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900" />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Fecha hasta
            </label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900" />
          </div>
        </div>

        {/* Error de query */}
        {queryError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{queryError}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={runSearch}
            disabled={!hasFilters || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>
      </div>

      {/* Estado inicial */}
      {!searched && (
        <div className="bg-white rounded-xl border border-slate-200 text-center py-16 text-slate-400">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Usa los filtros de arriba para buscar expedientes cerrados</p>
          <p className="text-xs mt-1">Combina fecha + cliente + folio para resultados precisos</p>
        </div>
      )}

      {/* Sin resultados */}
      {searched && !loading && services.length === 0 && !queryError && (
        <div className="bg-white rounded-xl border border-slate-200 text-center py-16 text-slate-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Sin resultados para los filtros aplicados</p>
          <p className="text-xs mt-1">Intenta cambiar el rango de fechas o el cliente</p>
        </div>
      )}

      {/* Resultados */}
      {searched && services.length > 0 && (
        <div className="bg-white shadow rounded-xl overflow-hidden border border-slate-200">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">
              {services.length} expediente{services.length !== 1 ? 's' : ''} encontrado{services.length !== 1 ? 's' : ''}
            </span>
          </div>

          <ul role="list" className="divide-y divide-gray-100">
            {services.map(service => (
              <li key={service.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="h-16 w-16 bg-blue-50 border border-blue-100 rounded-lg flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs text-blue-500 font-bold">FOLIO</span>
                      <span className="text-lg text-blue-800 font-black">#{service.folio}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{(service.clients as any)?.name}</h3>
                      {service.numero_expediente && (
                        <p className="text-xs text-blue-600 font-medium">Exp: {service.numero_expediente}</p>
                      )}
                      {service.insurance_folio && (
                        <p className="text-xs text-violet-600 font-medium">Folio Aseg: {service.insurance_folio}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                        <span>📅 {new Date(service.updated_at).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'})}</span>
                        <span>Operador: {(service.profiles as any)?.full_name ?? '—'}</span>
                      </div>
                      {(service.calidad_estrellas ?? 0) > 0 && (
                        <div className="flex text-yellow-400 gap-0.5 mt-1">
                          {[...Array(service.calidad_estrellas)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-3 shrink-0">
                    <span className="text-xl font-bold text-green-600">
                      ${Number(service.costo_calculado || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
                    </span>
                    <DownloadPDFButton
                      service={service}
                      companyLogoUrl={company?.logo_url}
                      companyName={company?.name}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
