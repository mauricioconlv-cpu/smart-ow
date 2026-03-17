'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  MapPin, Truck, Clock, AlertCircle, CheckCircle2, 
  Navigation, ArrowLeft, Loader2, RefreshCw, Phone
} from 'lucide-react'
import ServiceLog from '../components/ServiceLog'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  creado:             { label: 'Creado',                 color: '#64748b', bg: '#f1f5f9', step: 0 },
  rumbo_contacto:     { label: 'En Camino al Origen',    color: '#f59e0b', bg: '#fffbeb', step: 1 },
  arribo_origen:      { label: 'Llegó al Origen',        color: '#3b82f6', bg: '#eff6ff', step: 2 },
  contacto:           { label: 'Maniobra en Curso',      color: '#8b5cf6', bg: '#f5f3ff', step: 3 },
  inicio_traslado:    { label: 'En Traslado',            color: '#f97316', bg: '#fff7ed', step: 4 },
  traslado_concluido: { label: 'Entregado en Destino',   color: '#10b981', bg: '#ecfdf5', step: 5 },
  servicio_cerrado:   { label: 'Servicio Cerrado',       color: '#6b7280', bg: '#f9fafb', step: 6 },
  cancelado_momento:  { label: 'Cancelado al Momento',   color: '#ef4444', bg: '#fef2f2', step: -1 },
}

const STEPS = [
  { key: 'rumbo_contacto', label: 'En Camino', icon: '🚛' },
  { key: 'arribo_origen', label: 'En Sitio', icon: '📍' },
  { key: 'contacto', label: 'Enganche', icon: '🔗' },
  { key: 'inicio_traslado', label: 'Traslado', icon: '🏎️' },
  { key: 'traslado_concluido', label: 'Entregado', icon: '🏁' },
]

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [service, setService] = useState<any>(null)
  const [operator, setOperator] = useState<any>(null)
  const [truck, setTruck] = useState<any>(null)
  const [truckGps, setTruckGps] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = async () => {
    const { data: svc } = await supabase
      .from('services')
      .select('*, clients(name, phone)')
      .eq('id', id)
      .single()
    if (!svc) return
    setService(svc)

    if (svc.operator_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone, tow_truck_id')
        .eq('id', svc.operator_id)
        .single()
      if (prof) {
        setOperator(prof)
        if (prof.tow_truck_id) {
          const { data: t } = await supabase
            .from('tow_trucks')
            .select('economic_number, brand, model, plates, current_lat, current_lng')
            .eq('id', prof.tow_truck_id)
            .single()
          if (t) {
            setTruck(t)
            if (t.current_lat && t.current_lng) {
              setTruckGps({ lat: t.current_lat, lng: t.current_lng })
            }
          }
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 10000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [id])

  const status = service?.status ?? 'rumbo_contacto'
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.rumbo_contacto
  const currentStep = statusCfg.step

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => router.back()} style={{ padding: 8, borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
            Seguimiento en Vivo
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Folio #{service?.folio} · {service?.clients?.name ?? 'Cliente'}
          </p>
        </div>
        <button onClick={fetchData} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24, display: 'grid', gap: 20, gridTemplateColumns: '1fr' }}>

        {/* Status Banner */}
        <div style={{ background: statusCfg.bg, border: `2px solid ${statusCfg.color}30`, borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: statusCfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: statusCfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado Actual</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{statusCfg.label}</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progreso del Servicio</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
            {STEPS.map((step, i) => {
              const done = currentStep > i + 1
              const active = currentStep === i + 1
              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 60 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: done ? '#10b981' : active ? '#3b82f6' : '#e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                      boxShadow: active ? '0 0 0 4px #bfdbfe' : 'none',
                      transition: 'all 0.3s'
                    }}>
                      {done ? <CheckCircle2 className="w-5 h-5 text-white" /> : <span>{step.icon}</span>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? '#3b82f6' : done ? '#10b981' : '#94a3b8', textAlign: 'center', lineHeight: 1.2 }}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 3, background: done ? '#10b981' : '#e2e8f0', margin: '0 4px', marginBottom: 20, borderRadius: 2, transition: 'all 0.3s' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Operator Card */}
        {operator && (
          <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck className="w-4 h-4" /> Operador Asignado
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                {operator.avatar_url
                  ? <img src={operator.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#1d4ed8' }}>
                      {operator.full_name?.[0]?.toUpperCase()}
                    </div>
                }
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{operator.full_name}</p>
                  {operator.phone && <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{operator.phone}</p>}
                </div>
              </div>
              {truck && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>UNIDAD</p>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{truck.economic_number} · {truck.plates}</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{truck.brand} {truck.model}</p>
                </div>
              )}
            </div>

            {/* GPS Location */}
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Navigation className="w-4 h-4" /> Ubicación GPS
              </h3>
              {truckGps ? (
                <div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#15803d', fontWeight: 600 }}>● GPS Activo</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#166534', fontFamily: 'monospace' }}>
                      {truckGps.lat.toFixed(5)}, {truckGps.lng.toFixed(5)}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${truckGps.lat},${truckGps.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
                  >
                    <MapPin className="w-4 h-4" />
                    Ver en Google Maps
                  </a>
                </div>
              ) : (
                <div style={{ background: '#fff7ed', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 600 }}>⚠️ GPS no disponible</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#78350f' }}>El operador aún no comparte ubicación.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Origin / Destination */}
        {(service?.origen_coords || service?.destino_coords) && (
          <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {service?.origen_address && (
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>🔴 Origen</p>
                <p style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>{service.origen_address}</p>
              </div>
            )}
            {service?.destino_address && (
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>🟢 Destino</p>
                <p style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>{service.destino_address}</p>
              </div>
            )}
          </div>
        )}

        {/* Bitacora */}
        <ServiceLog serviceId={id} canAddNotes={true} />

      </div>
    </div>
  )
}
