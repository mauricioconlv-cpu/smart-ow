'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { MapPin, ArrowRight, Bell, X, Menu, Coffee, PauseCircle, LogOut, Truck, ChevronDown, ChevronUp, Archive } from 'lucide-react'

const OperatorTracker   = dynamic(() => import('./OperatorTracker'),      { ssr: false })
const PlateGate         = dynamic(() => import('./PlateGate'),            { ssr: false })
const DownloadPDFButton = dynamic(() => import('./DownloadPDFButton'),    { ssr: false })

interface TruckData {
  id: string
  economic_number: string
  brand: string
  model: string
  plates: string
}

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  rumbo_contacto:     { label: 'En camino al Origen',   color: '#f59e0b', dot: '#fbbf24' },
  arribo_origen:      { label: 'Llegué al Origen',      color: '#3b82f6', dot: '#60a5fa' },
  contacto_usuario:   { label: 'Contacto con Usuario',  color: '#6366f1', dot: '#818cf8' },
  contacto:           { label: 'Maniobra / Enganche',   color: '#8b5cf6', dot: '#a78bfa' },
  inicio_traslado:    { label: 'En Traslado a Destino', color: '#f97316', dot: '#fb923c' },
  traslado_concluido: { label: 'Entregado en Destino',  color: '#10b981', dot: '#34d399' },
  servicio_cerrado:   { label: 'Servicio Cerrado',      color: '#6b7280', dot: '#9ca3af' },
}

export default function OperatorClientLayer() {
  const [operatorId,   setOperatorId]   = useState<string | null>(null)
  const [operatorName, setOperatorName] = useState('...')
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null)
  const [truck,        setTruck]        = useState<TruckData | null>(null)
  const [services,     setServices]     = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [dbError,      setDbError]      = useState<string | null>(null)
  const [newServiceAlert, setNewServiceAlert] = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [statusMode,   setStatusMode]   = useState<'active' | 'break' | 'pause'>('active')
  const [showClosed,   setShowClosed]   = useState(false)
  const prevServiceCount = useRef(0)

  const playNotification = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      ;[880, 1100, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.2)
        osc.start(ctx.currentTime + i * 0.15)
        osc.stop(ctx.currentTime + i * 0.15 + 0.25)
      })
    } catch {}
  }

  useEffect(() => {
    ;(async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        const loadData = async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) { window.location.href = '/login'; return }
          setOperatorId(user.id)

          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, tow_truck_id, role')
            .eq('id', user.id)
            .single()

          if (profErr || !prof) { setDbError('Error cargando perfil.'); setLoading(false); return }
          setOperatorName(prof.full_name ?? 'Operador')
          setAvatarUrl(prof.avatar_url ?? null)

          if (prof.tow_truck_id) {
            const { data: truckData } = await supabase
              .from('tow_trucks')
              .select('id, economic_number, brand, model, plates')
              .eq('id', prof.tow_truck_id)
              .single()
            if (truckData) setTruck(truckData)
          }

          const VISIBLE = ['rumbo_contacto','arribo_origen','contacto_usuario','contacto','inicio_traslado','traslado_concluido','servicio_cerrado']
          const { data: svcData, error: svcErr } = await supabase
            .from('services')
            .select('id, folio, status, created_at, costo_calculado, calidad_estrellas, firma_url, tipo_servicio, origen_coords, destino_coords, comentarios_calidad, clients(name)')
            .eq('operator_id', user.id)
            .in('status', VISIBLE)
            .order('created_at', { ascending: false })
            .limit(30)

          if (svcErr) console.error('[Operator] services error:', svcErr.message)
          if (svcData) {
            const active = svcData.filter(s => s.status !== 'servicio_cerrado')
            if (prevServiceCount.current > 0 && active.length > prevServiceCount.current) {
              playNotification()
              setNewServiceAlert(true)
              setTimeout(() => setNewServiceAlert(false), 6000)
            }
            prevServiceCount.current = active.length
            setServices(svcData)
          }
          setLoading(false)
        }

        loadData()
        const iv = setInterval(loadData, 5000)
        return () => clearInterval(iv)
      } catch (e: any) {
        setDbError(e.message || 'Error inesperado.')
        setLoading(false)
      }
    })()
  }, [])

  async function handleEndShift() {
    await fetch('/api/operator/link-truck', { method: 'DELETE' })
    window.location.reload()
  }

  // ── Loading
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'linear-gradient(160deg,#060b18 0%,#0d1530 60%,#0a0f20 100%)' }}>
      <div style={{ width:40, height:40, borderRadius:'50%', border:'4px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', animation:'spin 0.8s linear infinite' }} />
      <p style={{ color:'rgba(148,163,184,0.7)', fontSize:14, marginTop:12 }}>Cargando...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Error
  if (dbError) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d1530', padding:20 }}>
      <p style={{ color:'#fca5a5', fontFamily:'monospace', textAlign:'center' }}>{dbError}</p>
    </div>
  )

  // ── No truck
  if (!truck) return <PlateGate operatorName={operatorName} avatarUrl={avatarUrl} />

  const activeServices = services.filter(s => s.status !== 'servicio_cerrado')
  const closedServices = services.filter(s => s.status === 'servicio_cerrado')

  const statusModeConfig = {
    active: { label: '🟢 Activo',  bg: '#16a34a' },
    break:  { label: '☕ Break',   bg: '#d97706' },
    pause:  { label: '⏸ Pausa',   bg: '#6366f1' },
  }

  return (
    <div style={{ background:'linear-gradient(160deg,#060b18 0%,#0d1530 60%,#0a0f20 100%)', minHeight:'100vh' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideDown { from { transform:translateY(-10px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes pulse-banner { from { transform:translateX(-50%) scale(1) } to { transform:translateX(-50%) scale(1.03) } }
        @keyframes fadeInUp { from { transform:translateY(10px); opacity:0 } to { transform:translateY(0); opacity:1 } }
      `}</style>

      {/* GPS Tracker (invisible) */}
      {operatorId && <OperatorTracker operatorId={operatorId} truckId={truck.id} />}

      {/* ── TOP NAV BAR ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'linear-gradient(135deg,#1e40af,#1d4ed8)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
      }}>
        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          {menuOpen ? <X style={{ width:20, height:20, color:'white' }} /> : <Menu style={{ width:20, height:20, color:'white' }} />}
        </button>

        {/* Avatar + Name */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(255,255,255,0.3)' }} />
            : <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:16, color:'white', border:'2px solid rgba(255,255,255,0.3)', flexShrink:0 }}>
                {operatorName?.[0]?.toUpperCase() ?? 'O'}
              </div>
          }
          <div>
            <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>OPERADOR</p>
            <p style={{ margin:0, fontSize:15, color:'white', fontWeight:800, lineHeight:1.1 }}>{operatorName}</p>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:20, padding:'4px 12px 4px 8px', display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background: statusMode === 'active' ? '#4ade80' : statusMode === 'break' ? '#fbbf24' : '#a5b4fc' }} />
          <span style={{ fontSize:11, color:'white', fontWeight:700 }}>{statusModeConfig[statusMode].label}</span>
        </div>
      </div>

      {/* ── HAMBURGER MENU DROPDOWN ── */}
      {menuOpen && (
        <div style={{
          position:'fixed', top:72, left:0, right:0, zIndex:99,
          background:'linear-gradient(160deg,#1e293b,#0f172a)',
          borderBottom:'1px solid rgba(255,255,255,0.08)',
          padding:'12px 16px 20px',
          animation:'slideDown 0.2s ease',
          boxShadow:'0 12px 40px rgba(0,0,0,0.5)',
        }}>
          {/* Unit info */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(255,255,255,0.05)', borderRadius:12, marginBottom:14 }}>
            <Truck style={{ width:18, height:18, color:'#60a5fa' }} />
            <div>
              <p style={{ margin:0, fontSize:11, color:'#94a3b8', fontWeight:600 }}>UNIDAD ASIGNADA</p>
              <p style={{ margin:0, fontSize:14, color:'white', fontWeight:800 }}>{truck.economic_number} <span style={{ fontSize:12, fontWeight:400, color:'#94a3b8' }}>({truck.plates})</span></p>
              <p style={{ margin:0, fontSize:11, color:'#64748b' }}>{truck.brand} {truck.model}</p>
            </div>
          </div>

          <p style={{ margin:'0 0 8px', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', paddingLeft:4 }}>Estado del Turno</p>

          {[
            { key:'active' as const, icon:'🟢', label:'Activo', sub:'Disponible para servicios' },
            { key:'break'  as const, icon:'☕', label:'Break',  sub:'Descanso breve (no asignable)' },
            { key:'pause'  as const, icon:'⏸', label:'Pausa',  sub:'Pausa temporal del turno' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => { setStatusMode(opt.key); setMenuOpen(false) }}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:12,
                padding:'12px 14px', borderRadius:12, border:'none', cursor:'pointer',
                marginBottom:6, textAlign:'left',
                background: statusMode === opt.key ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                borderLeft: statusMode === opt.key ? '3px solid #3b82f6' : '3px solid transparent',
                transition:'all 0.15s',
              }}
            >
              <span style={{ fontSize:20 }}>{opt.icon}</span>
              <div>
                <p style={{ margin:0, fontSize:14, fontWeight:700, color:'white' }}>{opt.label}</p>
                <p style={{ margin:0, fontSize:11, color:'#94a3b8' }}>{opt.sub}</p>
              </div>
              {statusMode === opt.key && <div style={{ marginLeft:'auto', width:8, height:8, borderRadius:'50%', background:'#3b82f6' }} />}
            </button>
          ))}

          <div style={{ height:'1px', background:'rgba(255,255,255,0.07)', margin:'12px 0' }} />

          <button
            onClick={handleEndShift}
            style={{
              width:'100%', display:'flex', alignItems:'center', gap:12,
              padding:'12px 14px', borderRadius:12, border:'none', cursor:'pointer',
              background:'rgba(239,68,68,0.12)', borderLeft:'3px solid #ef4444',
              textAlign:'left',
            }}
          >
            <LogOut style={{ width:20, height:20, color:'#f87171' }} />
            <div>
              <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#f87171' }}>Fin de Turno</p>
              <p style={{ margin:0, fontSize:11, color:'#94a3b8' }}>Desvincula tu unidad y cierra sesión de turno</p>
            </div>
          </button>
        </div>
      )}

      {/* Overlay cierra menu */}
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position:'fixed', inset:0, zIndex:98 }} />}

      {/* ── NEW SERVICE ALERT ── */}
      {newServiceAlert && (
        <div style={{
          position:'fixed', top:84, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background:'#f59e0b', color:'white', borderRadius:14, padding:'14px 24px',
          display:'flex', alignItems:'center', gap:10, boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
          animation:'pulse-banner 0.5s ease-in-out infinite alternate',
        }}>
          <Bell style={{ width:20, height:20 }} />
          <span style={{ fontWeight:700, fontSize:15 }}>¡Nuevo servicio asignado!</span>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ padding:'16px 16px 120px' }}>

        {/* Unit card */}
        <div style={{
          background:'rgba(37,99,235,0.15)', border:'1px solid rgba(59,130,246,0.3)',
          borderRadius:18, padding:'16px 18px', marginBottom:16,
          display:'flex', alignItems:'center', gap:14,
          animation:'fadeInUp 0.4s ease',
        }}>
          <div style={{ background:'rgba(59,130,246,0.2)', borderRadius:'50%', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Truck style={{ width:24, height:24, color:'#60a5fa' }} />
          </div>
          <div style={{ flex:1 }}>
            <p style={{ margin:0, fontSize:11, color:'#93c5fd', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Tu Unidad</p>
            <p style={{ margin:0, fontSize:18, color:'white', fontWeight:800 }}>{truck.economic_number} <span style={{ fontSize:13, fontWeight:400, color:'#93c5fd' }}>({truck.plates})</span></p>
            <p style={{ margin:0, fontSize:12, color:'#6b93d6' }}>{truck.brand} {truck.model}</p>
          </div>
        </div>

        {/* Active services header */}
        <div style={{ marginBottom:12 }}>
          <p style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:'white' }}>
            Mis Servicios Activos
          </p>
          <p style={{ margin:0, fontSize:13, color:'#64748b' }}>
            {activeServices.length === 0 ? 'Sin servicios asignados' : `${activeServices.length} folio${activeServices.length !== 1 ? 's' : ''} activo${activeServices.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Active services */}
        {activeServices.length === 0 ? (
          <div style={{
            background:'rgba(255,255,255,0.04)', border:'1.5px dashed rgba(255,255,255,0.12)',
            borderRadius:20, padding:'40px 24px', textAlign:'center',
            animation:'fadeInUp 0.4s ease',
          }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🚛</div>
            <p style={{ margin:0, fontSize:16, color:'#94a3b8', fontWeight:600 }}>Libre. Sin servicios activos.</p>
            <p style={{ margin:0, fontSize:13, color:'#475569', marginTop:6 }}>Tu próximo servicio aparecerá aquí.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {activeServices.map((s, idx) => {
              const cfg = STATUS_MAP[s.status]
              return (
                <div
                  key={s.id}
                  style={{
                    background:'rgba(255,255,255,0.05)', backdropFilter:'blur(10px)',
                    border:`1.5px solid ${cfg?.color ?? '#334155'}40`,
                    borderLeft:`4px solid ${cfg?.color ?? '#3b82f6'}`,
                    borderRadius:20, padding:'18px 16px',
                    display:'flex', flexDirection:'column', gap:14,
                    animation:`fadeInUp ${0.3 + idx * 0.08}s ease`,
                  }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <span style={{ fontSize:10, fontWeight:800, color:'#60a5fa', textTransform:'uppercase', letterSpacing:'0.08em', background:'rgba(59,130,246,0.15)', padding:'3px 8px', borderRadius:6 }}>
                        FOLIO #{s.folio}
                      </span>
                      <p style={{ margin:'8px 0 0', fontSize:18, fontWeight:800, color:'white' }}>
                        {(s.clients as any)?.name ?? '—'}
                      </p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background: cfg?.dot ?? '#94a3b8' }} />
                        <span style={{ fontSize:12, fontWeight:700, color: cfg?.color ?? '#94a3b8' }}>
                          {cfg?.label ?? s.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/operator/service/${s.id}`}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      background:'linear-gradient(135deg,#1e40af,#1d4ed8)',
                      color:'white', textDecoration:'none', fontWeight:700, fontSize:14,
                      padding:'13px 16px', borderRadius:14,
                      boxShadow:'0 4px 14px rgba(29,78,216,0.4)',
                    }}
                  >
                    Abrir Servicio <ArrowRight style={{ width:18, height:18 }} />
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Closed services counter ── */}
        {closedServices.length > 0 && (
          <div style={{ marginTop:20 }}>
            <button
              onClick={() => setShowClosed(o => !o)}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:14, padding:'14px 18px', cursor:'pointer',
              }}
            >
              <Archive style={{ width:18, height:18, color:'#64748b' }} />
              <div style={{ flex:1, textAlign:'left' }}>
                <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#94a3b8' }}>Servicios Cerrados</p>
                <p style={{ margin:0, fontSize:12, color:'#475569' }}>{closedServices.length} folio{closedServices.length !== 1 ? 's' : ''} concluido{closedServices.length !== 1 ? 's' : ''}</p>
              </div>
              {showClosed
                ? <ChevronUp style={{ width:18, height:18, color:'#64748b' }} />
                : <ChevronDown style={{ width:18, height:18, color:'#64748b' }} />
              }
            </button>

            {showClosed && (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
                {closedServices.map(s => (
                  <div
                    key={s.id}
                    style={{
                      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
                      borderRadius:16, padding:'14px 16px', display:'flex', flexDirection:'column', gap:12,
                    }}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <span style={{ fontSize:10, fontWeight:800, color:'#6b7280', background:'rgba(107,114,128,0.15)', padding:'3px 8px', borderRadius:6, textTransform:'uppercase' }}>
                          FOLIO #{s.folio}
                        </span>
                        <p style={{ margin:'6px 0 0', fontSize:15, fontWeight:700, color:'#94a3b8' }}>
                          {(s.clients as any)?.name ?? '—'}
                        </p>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, color:'#10b981', background:'rgba(16,185,129,0.12)', padding:'4px 10px', borderRadius:8 }}>
                        ✓ Cerrado
                      </span>
                    </div>
                    <DownloadPDFButton service={s} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SOS Button ── */}
      <div style={{ position:'fixed', bottom:24, right:20, zIndex:50 }}>
        <button
          onClick={() => alert('SOS enviado. Coordinador notificado.')}
          style={{
            width:60, height:60, borderRadius:'50%',
            background:'linear-gradient(135deg,#ef4444,#dc2626)',
            border:'none', color:'white', fontWeight:900, fontSize:11,
            cursor:'pointer', boxShadow:'0 4px 20px rgba(239,68,68,0.5)',
            letterSpacing:'0.03em',
          }}
        >
          S.O.S
        </button>
      </div>
    </div>
  )
}
