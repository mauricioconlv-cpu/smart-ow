'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { MapPin, Truck, Radio, Users, Circle } from 'lucide-react'

const LiveMap = dynamic(() => import('./components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">Cargando Satélite...</div>
})

export default function LiveMonitorPage() {
  const [operators, setOperators] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [dispatchers, setDispatchers] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    const fetchPersonnel = async () => {
      // Operadores
      const { data: ops } = await supabase
        .from('profiles')
        .select('id, full_name, grua_asignada, updated_at')
        .eq('role', 'operator')
      if (ops) setOperators(ops)

      // Grúas con ubicación reciente (activas en calle = tienen coords dentro de las últimas 2h)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const { data: tw } = await supabase
        .from('tow_trucks')
        .select('id, economic_number, current_location, last_location_update, profiles(full_name)')
        .gt('last_location_update', twoHoursAgo)
        .not('current_location', 'is', null)
      if (tw) setTrucks(tw)

      // Despachadores
      const { data: disp } = await supabase
        .from('profiles')
        .select('id, full_name, updated_at')
        .eq('role', 'dispatcher')
      if (disp) setDispatchers(disp)
    }

    fetchPersonnel()
    const interval = setInterval(fetchPersonnel, 30000)
    return () => clearInterval(interval)
  }, [])

  // Considera "activo" si actualizó en los últimos 15 min
  const isOnline = (updatedAt: string) => {
    return Date.now() - new Date(updatedAt).getTime() < 15 * 60 * 1000
  }

  const onlineOps  = operators.filter(o => isOnline(o.updated_at))
  const offlineOps = operators.filter(o => !isOnline(o.updated_at))

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
              <PersonnelRow key={op.id} name={op.name ?? op.full_name} sub={op.grua_asignada ? `Grúa: ${op.grua_asignada}` : 'Sin grúa asignada'} online={true} />
            ))}
            {offlineOps.map(op => (
              <PersonnelRow key={op.id} name={op.name ?? op.full_name} sub={op.grua_asignada ? `Grúa: ${op.grua_asignada}` : 'Sin grúa asignada'} online={false} />
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
            {trucks.map(tw => (
              <PersonnelRow
                key={tw.id}
                name={`${tw.economic_number}${tw.unit_type ? ` (Tipo ${tw.unit_type})` : ''}`}
                sub={(tw.profiles as any)?.full_name ?? 'Sin operador'}
                online={true}
                icon="truck"
              />
            ))}
          </div>
        </div>

        {/* Despachadores */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
            <Radio className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-sm text-slate-700">Cabina / Despachadores</span>
            <span className="ml-auto text-xs font-bold text-amber-600">{dispatchers.filter(d => isOnline(d.updated_at)).length} en línea</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-1">
            {dispatchers.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-6">Sin despachadores registrados</p>
            )}
            {dispatchers.map(d => (
              <PersonnelRow key={d.id} name={d.full_name} sub="Despachador / Call Center" online={isOnline(d.updated_at)} />
            ))}
          </div>
        </div>

      </section>
    </div>
  )
}

function PersonnelRow({ name, sub, online, icon }: { name: string, sub: string, online: boolean, icon?: string }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${online ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
      <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${online ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
        {name?.[0]?.toUpperCase() ?? '?'}
        <Circle className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 fill-current ${online ? 'text-green-500' : 'text-slate-300'}`} />
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
