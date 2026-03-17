'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { MapPin, ArrowRight, Bell } from 'lucide-react'

// All browser-only components loaded dynamically with ssr:false
const PlateGate           = dynamic(() => import('./PlateGate'),           { ssr: false })
const OperatorTracker     = dynamic(() => import('./OperatorTracker'),      { ssr: false })
const DownloadPDFButton   = dynamic(() => import('./DownloadPDFButton'),    { ssr: false })
const AssignedTruckBanner = dynamic(() => import('./AssignedTruckBanner'), { ssr: false })

interface Truck {
  id: string
  economic_number: string
  brand: string
  model: string
  plates: string
}

const STATUS_MAP: Record<string, string> = {
  creado:             'Nuevo Asignado',
  rumbo_contacto:     'En camino al Origen',
  arribo_origen:      'En Sitio',
  contacto:           'Maniobra / Enganche',
  inicio_traslado:    'En Traslado a Destino',
  traslado_concluido: 'Descargando...',
}

export default function OperatorClientLayer() {
  const [operatorId, setOperatorId]   = useState<string | null>(null)
  const [operatorName, setOperatorName] = useState('Operador')
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null)
  const [truck, setTruck]             = useState<Truck | null>(null)
  const [services, setServices]       = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [dbError, setDbError]         = useState<string | null>(null)
  const [newServiceAlert, setNewServiceAlert] = useState(false)
  const prevServiceCount = useRef(0)

  // Plays a attention beep using the Web Audio API (no external files needed)
  const playNotification = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const frequencies = [880, 1100, 880]
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
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
          // Auth check
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) { window.location.href = '/login'; return }
          setOperatorId(user.id)

          // Profile
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, tow_truck_id, role')
            .eq('id', user.id)
            .single()

          if (profErr) { setDbError('Error perfil: ' + profErr.message); setLoading(false); return }
          if (!prof)   { setDbError('Perfil no encontrado.'); setLoading(false); return }

          setOperatorName(prof.full_name ?? 'Operador')
          setAvatarUrl(prof.avatar_url ?? null)

          // Truck
          if (prof.tow_truck_id) {
            const { data: truckData } = await supabase
              .from('tow_trucks')
              .select('id, economic_number, brand, model, plates')
              .eq('id', prof.tow_truck_id)
              .single()
            if (truckData) setTruck(truckData)
          }

          // Services — solo los que están formalmente asignados y en curso
          const OPERATOR_VISIBLE_STATUSES = [
            'asignado', 'rumbo_contacto', 'arribo_origen',
            'contacto', 'inicio_traslado', 'traslado_concluido', 'servicio_cerrado'
          ]
          const { data: svcData } = await supabase
            .from('services')
            .select('id, folio, status, created_at, costo_calculado, calidad_estrellas, firma_url, tipo_servicio, origen_coords, destino_coords, comentarios_calidad, clients(name)')
            .eq('operator_id', user.id)
            .in('status', OPERATOR_VISIBLE_STATUSES)
            .order('created_at', { ascending: false })
            .limit(20)
          if (svcData) {
            // 🔔 Sound alert when a NEW service arrives
            if (prevServiceCount.current > 0 && svcData.length > prevServiceCount.current) {
              playNotification()
              setNewServiceAlert(true)
              setTimeout(() => setNewServiceAlert(false), 6000)
            }
            prevServiceCount.current = svcData.length
            setServices(svcData)
          }

          setLoading(false)
        }

        loadData()
        const interval = setInterval(loadData, 5000)
        return () => clearInterval(interval)

      } catch (e: any) {
        setDbError(e.message || 'Error inesperado.')
        setLoading(false)
      }
    })()
  }, [])

  // ── Loading
  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'linear-gradient(160deg,#060b18 0%,#0d1530 60%,#0a0f20 100%)' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'4px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', animation:'spin 0.8s linear infinite' }} />
        <p style={{ color:'rgba(148,163,184,0.7)', fontSize:14, marginTop:12 }}>Cargando...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── Error
  if (dbError) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d1530', padding:20 }}>
        <p style={{ color:'#fca5a5', fontFamily:'monospace', textAlign:'center' }}>{dbError}</p>
      </div>
    )
  }

  // ── No truck → plate gate
  if (!truck) {
    return <PlateGate operatorName={operatorName} avatarUrl={avatarUrl} />
  }

  // ── Dashboard
  return (
    <div className="p-4 space-y-6 pb-24" style={{ background:'linear-gradient(160deg,#060b18 0%,#0d1530 60%,#0a0f20 100%)', minHeight:'100vh' }}>

      {/* Invisible GPS tracker */}
      {operatorId && <OperatorTracker operatorId={operatorId} truckId={truck.id} />}

      {/* 🔔 Notification Banner — shows when a new service arrives */}
      {newServiceAlert && (
        <div style={{
          position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: '#f59e0b', color: 'white', borderRadius: 14, padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'pulse-banner 0.5s ease-in-out infinite alternate'
        }}>
          <Bell className="w-5 h-5" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>¡Nuevo servicio asignado!</span>
          <style>{`@keyframes pulse-banner { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.03); } }`}</style>
        </div>
      )}

      {/* Assigned truck banner */}
      <AssignedTruckBanner
        economic_number={truck.economic_number}
        plates={truck.plates}
        brand={truck.brand ?? ''}
        model={truck.model ?? ''}
      />

      {/* Services header */}
      <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
        <h2 className="text-xl font-bold text-slate-800">Mis Servicios Activos</h2>
        <p className="text-sm text-slate-500 mt-1">Atiende los folios pendientes en orden.</p>
      </div>

      {/* Service cards */}
      {services.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
            <MapPin className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">Libre. Sin servicios asignados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {services.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-blue-500 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block ${s.status === 'servicio_cerrado' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                    FOLIO: #{s.folio}
                  </span>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">
                    {(s.clients as any)?.name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="block text-xs text-gray-400 font-medium">ESTADO</span>
                  <span className={`block text-sm font-bold ${s.status === 'servicio_cerrado' ? 'text-green-600' : 'text-slate-700'}`}>
                    {STATUS_MAP[s.status] ?? s.status}
                  </span>
                </div>
              </div>
              {s.status !== 'servicio_cerrado' && (
                <Link
                  href={`/operator/service/${s.id}`}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  <span>Ver Detalles del Servicio</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              )}
              {s.status === 'servicio_cerrado' && (
                <DownloadPDFButton service={s} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* SOS button */}
      <div style={{ position:'fixed', bottom:24, right:20, zIndex:50 }}>
        <button
          onClick={() => alert('SOS enviado. Coordinador notificado.')}
          style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#ef4444,#dc2626)', border:'none', color:'white', fontWeight:900, fontSize:11, cursor:'pointer', boxShadow:'0 4px 20px rgba(239,68,68,0.5)', letterSpacing:'0.03em' }}
        >
          S.O.S
        </button>
      </div>

    </div>
  )
}
