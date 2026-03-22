'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import { MapPin, Truck, Radio, Users, LogOut, X, AlertTriangle, Shield, Loader2, Mic, Coffee } from 'lucide-react'

const LiveMap = dynamic(() => import('./components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">Cargando Satélite...</div>
})

// ── Modal Confirmar Cierre ────────────────────────────────────────────────────
interface ForceLogoutModalProps {
  operator: { id: string; full_name: string; grua_asignada: string | null } | null
  onConfirm: (operatorId: string) => Promise<void>
  onClose: () => void
  isLoading: boolean
}

function ForceLogoutModal({ operator, onConfirm, onClose, isLoading }: ForceLogoutModalProps) {
  if (!operator) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#0f172a', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 16, padding: 28, maxWidth: 380, width: '100%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(239,68,68,0.1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <AlertTriangle style={{ color: '#f87171', width: 22, height: 22 }} />
          </div>
          <div>
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: 15 }}>Cerrar Turno Forzado</p>
            <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 12 }}>Esta acción se registrará en el sistema</p>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X style={{ color: 'rgba(148,163,184,0.5)', width: 18, height: 18 }} />
          </button>
        </div>

        {/* Info operador */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 20,
        }}>
          <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>{operator.full_name}</p>
          {operator.grua_asignada && (
            <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 13, marginTop: 2 }}>
              Grúa: {operator.grua_asignada}
            </p>
          )}
        </div>

        <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          Se liberará la grúa asignada y el operador verá la pantalla de <strong style={{ color: '#e2e8f0' }}>vincular unidad</strong> la próxima vez que abra su panel.
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(148,163,184,0.8)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(operator.id)}
            disabled={isLoading}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none',
              background: isLoading ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: 'white', fontWeight: 700, fontSize: 13, cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 4px 14px rgba(220,38,38,0.35)',
            }}
          >
            {isLoading
              ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Cerrando...</>
              : <><LogOut style={{ width: 14, height: 14 }} /> Cerrar Turno</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LiveMonitorPage() {
  const [operators, setOperators] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [dispatchers, setDispatchers] = useState<any[]>([])
  const [dbError, setDbError] = useState<string | null>(null)
  const [myProfile, setMyProfile] = useState<{ role: string; supervisor_level: number } | null>(null)

  // Force-logout state
  const [modalOperator, setModalOperator] = useState<{ id: string; full_name: string; grua_asignada: string | null } | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutMessage, setLogoutMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [audioAlerts, setAudioAlerts] = useState<Record<string, number>>({}) // operatorId -> timestamp

  const supabase = createClient()

  // ¿Puede este usuario forzar el cierre de turno de operadores?
  const canForceLogout =
    myProfile?.role === 'admin' ||
    myProfile?.role === 'superadmin' ||
    (myProfile?.role === 'dispatcher' && (myProfile?.supervisor_level ?? 0) >= 1)

  const fetchPersonnel = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase
          .from('profiles')
          .select('company_id, role, supervisor_level')
          .eq('id', user.id)
          .single()
      : { data: null }

    if (profile) setMyProfile({ role: profile.role, supervisor_level: profile.supervisor_level ?? 0 })
    const companyId = profile?.company_id

    // Operadores
    const { data: ops, error: opsError } = await supabase
      .from('profiles')
      .select(`
        id, full_name, grua_asignada, avatar_url, created_at, tow_truck_id,
        duty_status, duty_status_since,
        tow_trucks!profiles_tow_truck_id_fkey(current_lat, current_lng, current_location)
      `)
      .eq('role', 'operator')
      .eq('company_id', companyId)
    if (opsError) setDbError(`Error ops: ${opsError.message}`)
    if (ops) {
      const enriched = ops.map((op: any) => {
        const truck = op.tow_trucks
        let lat = truck?.current_lat ?? null
        let lng = truck?.current_lng ?? null
        if (!lat && truck?.current_location) {
          lat = truck.current_location.lat
          lng = truck.current_location.lng
        }
        return { ...op, lat, lng }
      })
      setOperators(enriched)
    }

    // Grúas
    const { data: tw, error: twError } = await supabase
      .from('tow_trucks')
      .select('id, economic_number, unit_type, photo_url, profiles!profiles_tow_truck_id_fkey(full_name, avatar_url)')
      .eq('is_active', true)
      .eq('company_id', companyId)
      .not('id', 'is', null)
    if (twError) setDbError(prev => prev ? `${prev} | Error trucks: ${twError.message}` : `Error trucks: ${twError.message}`)
    if (tw) setTrucks(tw.filter(t => Array.isArray(t.profiles) ? t.profiles.length > 0 : !!t.profiles))

    // Despachadores — incluir last_seen_at para detectar si están activos
    const { data: disp } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at, supervisor_level, last_seen_at')
      .eq('role', 'dispatcher')
      .eq('company_id', companyId)

    if (disp) {
      // Un despachador está "en línea" si tuvo actividad en los últimos 10 minutos
      const TEN_MIN_MS = 10 * 60 * 1000
      const now = Date.now()
      const enriched = disp.map((d: any) => ({
        ...d,
        isOnline: d.last_seen_at
          ? now - new Date(d.last_seen_at).getTime() < TEN_MIN_MS
          : false,
      }))
      setDispatchers(enriched)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: actualizar cuando operador cambia duty_status
  useEffect(() => {
    const channel = supabase
      .channel('monitor-duty-status')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
      }, () => { fetchPersonnel() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchPersonnel])

  useEffect(() => {
    fetchPersonnel()
    const interval = setInterval(fetchPersonnel, 30000)
    return () => clearInterval(interval)
  }, [fetchPersonnel])

  // Suscripción a notas de voz (PTT)
  useEffect(() => {
    const channel = supabase
      .channel('monitor-audio-alerts')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'service_logs', filter: "type=eq.audio_ptt"
      }, (payload) => {
        const opId = payload.new.created_by
        if (opId) {
          setAudioAlerts(prev => ({ ...prev, [opId]: Date.now() }))
        }
      })
      .subscribe()

    // Limpiar alertas después de 30 segundos
    const timer = setInterval(() => {
      setAudioAlerts(prev => {
        const now = Date.now()
        let changed = false
        const next = { ...prev }
        for (const [id, time] of Object.entries(next)) {
          if (now - time > 30000) { delete next[id]; changed = true }
        }
        return changed ? next : prev
      })
    }, 5000)

    return () => { supabase.removeChannel(channel); clearInterval(timer) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ejecutar cierre forzado
  const handleForceLogout = async (operatorId: string) => {
    setIsLoggingOut(true)
    try {
      const res = await fetch('/api/admin/force-logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLogoutMessage({ text: data.error || 'Error al cerrar turno.', ok: false })
      } else {
        setLogoutMessage({ text: `✓ Turno de ${data.operatorName} cerrado exitosamente.`, ok: true })
        await fetchPersonnel() // refrescar monitor
      }
    } catch {
      setLogoutMessage({ text: 'Error de conexión.', ok: false })
    } finally {
      setIsLoggingOut(false)
      setModalOperator(null)
      setTimeout(() => setLogoutMessage(null), 4000)
    }
  }

  const onlineOps  = operators.filter(o => !!o.grua_asignada)
  const offlineOps = operators.filter(o => !o.grua_asignada)

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">

      {/* Modal confirmación */}
      <ForceLogoutModal
        operator={modalOperator}
        onConfirm={handleForceLogout}
        onClose={() => setModalOperator(null)}
        isLoading={isLoggingOut}
      />

      {/* Toast mensaje resultado */}
      {logoutMessage && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9998,
          padding: '12px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: logoutMessage.ok ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
          color: 'white',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.3s ease',
        }}>
          {logoutMessage.text}
        </div>
      )}

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

      {/* Error DB */}
      {dbError && (
        <div className="bg-red-100 text-red-700 p-2 rounded text-xs font-mono">{dbError}</div>
      )}

      {/* ── Panel de Personal ── */}
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
              <PersonnelRow
                key={op.id}
                name={op.name ?? op.full_name}
                sub={op.grua_asignada ? `Grúa: ${op.grua_asignada}` : 'Sin grúa asignada'}
                online={true}
                avatarUrl={op.avatar_url}
                dutyStatus={op.duty_status ?? 'active'}
                dutySince={op.duty_status_since}
                canForceLogout={canForceLogout}
                onForceLogout={() => setModalOperator({ id: op.id, full_name: op.full_name, grua_asignada: op.grua_asignada })}
                hasAudioAlert={audioAlerts[op.id] !== undefined}
                onClearAudioAlert={() => setAudioAlerts(prev => { const n = {...prev}; delete n[op.id]; return n; })}
              />
            ))}
            {offlineOps.map(op => (
              <PersonnelRow
                key={op.id}
                name={op.name ?? op.full_name}
                sub="Sin grúa asignada"
                online={false}
                avatarUrl={op.avatar_url}
                canForceLogout={false}
              />
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
                  canForceLogout={false}
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
            <span className="ml-auto text-xs font-bold text-amber-600">
              {dispatchers.filter((d: any) => d.isOnline).length} en línea
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-1">
            {dispatchers.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-6">Sin despachadores registrados</p>
            )}
            {/* Online dispatchers first */}
            {dispatchers.filter((d: any) => d.isOnline).map((d: any) => (
              <PersonnelRow
                key={d.id}
                name={d.full_name}
                sub={d.supervisor_level >= 1 ? `Supervisor Nv.${d.supervisor_level}` : 'Despachador / Call Center'}
                online={true}
                avatarUrl={d.avatar_url}
                badge={d.supervisor_level >= 1 ? 'supervisor' : undefined}
                canForceLogout={false}
              />
            ))}
            {/* Offline dispatchers */}
            {dispatchers.filter((d: any) => !d.isOnline).map((d: any) => (
              <PersonnelRow
                key={d.id}
                name={d.full_name}
                sub={d.supervisor_level >= 1 ? `Supervisor Nv.${d.supervisor_level}` : 'Despachador / Call Center'}
                online={false}
                avatarUrl={d.avatar_url}
                badge={d.supervisor_level >= 1 ? 'supervisor' : undefined}
                canForceLogout={false}
              />
            ))}
          </div>
        </div>

      </section>
    </div>
  )
}

function PersonnelRow({
  name, sub, online, icon, avatarUrl, badge, dutyStatus, dutySince, canForceLogout, onForceLogout, hasAudioAlert, onClearAudioAlert,
}: {
  name: string
  sub: string
  online: boolean
  icon?: string
  avatarUrl?: string | null
  badge?: 'supervisor'
  dutyStatus?: 'active' | 'break' | 'pause' | 'offline' | string
  dutySince?: string | null
  canForceLogout?: boolean
  onForceLogout?: () => void
  hasAudioAlert?: boolean
  onClearAudioAlert?: () => void
}) {
  // Live timer for break/pause
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!dutySince || dutyStatus === 'active' || dutyStatus === 'offline') { setElapsed(0); return }
    const base = Date.now() - new Date(dutySince).getTime()
    setElapsed(Math.floor(base / 1000))
    const iv = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [dutySince, dutyStatus])

  const fmtSecs = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const dutyBadge = !dutyStatus || dutyStatus === 'active' ? null
    : dutyStatus === 'break' ? { label: '☕ Break', bg: '#fef3c7', color: '#92400e', timer: elapsed }
    : dutyStatus === 'pause' ? { label: '⏸ Pausa', bg: '#ede9fe', color: '#5b21b6', timer: elapsed }
    : null

  return (
    <div className={`flex flex-col gap-1 px-3 py-2.5 rounded-lg ${online ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
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
          <p className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1">
            {name}
            {badge === 'supervisor' && (
              <span aria-label="Supervisor" title="Supervisor" style={{ display: 'inline-flex' }}>
                <Shield className="w-3 h-3 text-amber-500 flex-shrink-0" />
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 truncate">{sub}</p>
        </div>

        {/* Alerta de audio (PTT) */}
        {hasAudioAlert ? (
          <button
            onClick={onClearAudioAlert}
            title="Nuevo mensaje de voz recibido"
            className="flex-shrink-0 animate-pulse bg-red-100 border border-red-300 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors hover:bg-red-200"
          >
            <Mic className="w-4 h-4 text-red-600" />
          </button>
        ) : canForceLogout && onForceLogout ? (
          <button
            onClick={onForceLogout}
            title="Forzar cierre de turno"
            style={{
              flexShrink: 0,
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'
            }}
          >
            <LogOut style={{ width: 13, height: 13, color: '#ef4444' }} />
          </button>
        ) : (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {online ? 'En línea' : 'Offline'}
          </span>
        )}
      </div>

      {/* Duty status badge with live timer */}
      {dutyBadge && (
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          background: dutyBadge.bg, borderRadius:8, padding:'3px 10px',
          marginLeft:48, width:'fit-content',
        }}>
          <span style={{ fontSize:11, fontWeight:700, color: dutyBadge.color }}>{dutyBadge.label}</span>
          {dutyBadge.timer > 0 && (
            <span style={{ fontSize:11, fontFamily:'monospace', color: dutyBadge.color, opacity:0.8 }}>{fmtSecs(dutyBadge.timer)}</span>
          )}
        </div>
      )}
    </div>
  )
}
