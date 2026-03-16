'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { MapPin, Truck, Radio, Users } from 'lucide-react'

const LiveMap = dynamic(() => import('./components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">Cargando Satélite...</div>
})

export default function LiveMonitorPage() {
  const [operators, setOperators] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [dispatchers, setDispatchers] = useState<any[]>([])
  const [dbError, setDbError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const fetchPersonnel = async () => {
      // Operadores — no filtramos por updated_at (no existe), mostramos todos los que tengan role='operator'
      const { data: ops, error: opsError } = await supabase
        .from('profiles')
        .select('id, full_name, grua_asignada, avatar_url, created_at')
        .eq('role', 'operator')
      if (opsError) setDbError(`Error ops: ${opsError.message}`)
      if (ops) setOperators(ops)

      // Grúas en calle = tienen al menos un operador vinculado (profiles.tow_truck_id != null)
      const { data: tw, error: twError } = await supabase
        .from('tow_trucks')
        .select('id, economic_number, unit_type, photo_url, profiles!profiles_tow_truck_id_fkey(full_name, avatar_url)')
        .eq('is_active', true)
        .not('id', 'is', null)
      if (twError) setDbError(prev => prev ? `${prev} | Error trucks: ${twError.message}` : `Error trucks: ${twError.message}`)
      // Solo mostrar grúas con operador vinculado
      if (tw) setTrucks(tw.filter(t => Array.isArray(t.profiles) ? t.profiles.length > 0 : !!t.profiles))

      // Despachadores
      const { data: disp } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, created_at')
        .eq('role', 'dispatcher')
      if (disp) setDispatchers(disp)
    }

    fetchPersonnel()
    const interval = setInterval(fetchPersonnel, 30000)
    return () => clearInterval(interval)
  }, [])

  // Operador activo = tiene grua_asignada (fue vinculado hoy)
  const onlineOps  = operators.filter(o => !!o.grua_asignada)
  const offlineOps = operators.filter(o => !o.grua_asignada)

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">

      {/* ── Mapa en Vivo ── */}
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

      {/* ── Panel de Personal Conectado ── */}
      {dbError && (
        <div className="bg-red-100 text-red-700 p-2 rounded text-xs font-mono">
          {dbError}
        </div>
      )}
      <section className="basis-1/2 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">

        {/* Operadores */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-sm text-slate-700">Operadores</span>
            <span className="ml-auto text-xs font-bold text-green-600">{onlineOps.length} activos</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-1">
            {operators.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-6">Sin operadores registrados</p>
            )}
            {onlineOps.map(op => (
              <PersonnelRow key={op.id} name={op.name ?? op.full_name} sub={op.grua_asignada ? `Grúa: ${op.grua_asignada}` : 'Sin grúa asignada'} online={true} avatarUrl={op.avatar_url} />
            ))}
            {offlineOps.map(op => (
              <PersonnelRow key={op.id} name={op.name ?? op.full_name} sub={op.grua_asignada ? `Grúa: ${op.grua_asignada}` : 'Sin grúa asignada'} online={false} avatarUrl={op.avatar_url} />
            ))}
          </div>
        </div>

        {/* Grúas en calle */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
            <Truck className="w-4 h-4 text-violet-500" />
            <span className="font-bold text-sm text-slate-700">Grúas en Calle</span>
            <span className="ml-auto text-xs font-bold text-violet-600">{trucks.length} activas</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-1">
            {trucks.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-6">Sin grúas con GPS activo</p>
            )}
            {trucks.map(tw => {
              const op = Array.isArray(tw.profiles) ? tw.profiles[0] : tw.profiles
              return (
                <PersonnelRow
                  key={tw.id}
                  name={`${tw.economic_number}${tw.unit_type ? ` (Tipo ${tw.unit_type})` : ''}`}
                  sub={op?.full_name ? `Operador: ${op.full_name}` : 'Sin operador asignado'}
                  online={true}
                  icon="truck"
                  avatarUrl={tw.photo_url}
                />
              )
            })}
          </div>
        </div>

        {/* Despachadores */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
            <Radio className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-sm text-slate-700">Cabina / Despachadores</span>
            <span className="ml-auto text-xs font-bold text-amber-600">{dispatchers.length} en línea</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-1">
            {dispatchers.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-6">Sin despachadores registrados</p>
            )}
            {dispatchers.map(d => (
              <PersonnelRow key={d.id} name={d.full_name} sub="Despachador / Call Center" online={true} avatarUrl={d.avatar_url} />
            ))}
          </div>
        </div>

      </section>
    </div>
  )
}

function PersonnelRow({ name, sub, online, icon, avatarUrl }: {
  name: string
  sub: string
  online: boolean
  icon?: string
  avatarUrl?: string | null
}) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${online ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
      <div className={`relative w-9 h-9 rounded-full flex-shrink-0 overflow-hidden border-2 ${online ? 'border-green-400' : 'border-slate-200'}`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-xs font-black ${online ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
            {icon === 'truck'
              ? <Truck className="w-4 h-4" />
              : (name?.[0]?.toUpperCase() ?? '?')}
          </div>
        )}
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${online ? 'bg-green-500' : 'bg-slate-300'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
        <p className="text-xs text-slate-500 truncate">{sub}</p>
      </div>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
        {online ? 'En línea' : 'Offline'}
      </span>
    </div>
  )
}
