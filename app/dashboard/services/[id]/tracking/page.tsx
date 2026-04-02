'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  MapPin, Truck, CheckCircle2, Navigation,
  Loader2, RefreshCw, Phone, Clock, User,
  MessageSquare, FileText, AlertCircle, Send, ExternalLink,
} from 'lucide-react'
import ServiceLog from '../components/ServiceLog'
import DispatcherMessageBar from '../components/DispatcherMessageBar'
import InventoryPanel from '../components/InventoryPanel'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Mapa embebido dinámico (sin SSR) — typed explicitly to avoid TS resolution errors
import type { ComponentType } from 'react'
interface TrackingMapProps {
  truckGps: { lat: number; lng: number } | null
  originCoords: Record<string, number> | null
  destCoords: Record<string, number> | null
}
const TrackingMap: ComponentType<TrackingMapProps> = dynamic(
  () => import('./TrackingMap') as Promise<{ default: ComponentType<TrackingMapProps> }>,
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', borderRadius: 12 }}>
        <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: '#64748b' }} />
      </div>
    )
  }
)

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; step: number }> = {
  creado:             { label: 'Creado',                  color: '#64748b', dot: '#94a3b8', step: 0 },
  sin_operador:       { label: 'Sin Operador',            color: '#f97316', dot: '#fb923c', step: 0 },
  rumbo_contacto:     { label: 'En Camino al Origen',    color: '#f59e0b', dot: '#fbbf24', step: 1 },
  arribo_origen:      { label: 'Llegó al Origen',        color: '#3b82f6', dot: '#60a5fa', step: 2 },
  contacto_usuario:   { label: 'Contacto con Usuario',   color: '#6366f1', dot: '#818cf8', step: 3 },
  contacto:           { label: 'Maniobra / Enganche',    color: '#8b5cf6', dot: '#a78bfa', step: 4 },
  inicio_traslado:    { label: 'En Traslado',            color: '#f97316', dot: '#fb923c', step: 5 },
  traslado_concluido: { label: 'Entregado en Destino',   color: '#10b981', dot: '#34d399', step: 6 },
  servicio_cerrado:   { label: 'Servicio Cerrado',       color: '#6b7280', dot: '#9ca3af', step: 7 },
  cancelado_momento:  { label: 'Cancelado al Momento',   color: '#ef4444', dot: '#f87171', step: -1 },
  cancelado_posterior:{ label: 'Cancelado Posterior',    color: '#ef4444', dot: '#f87171', step: -1 },
}

const PROGRESS_STEPS_ARRASTRE = [
  { key: 'rumbo_contacto',     label: 'En Camino',  icon: '🚛', step: 1 },
  { key: 'arribo_origen',      label: 'En Sitio',   icon: '📍', step: 2 },
  { key: 'contacto_usuario',   label: 'Contacto',   icon: '🤝', step: 3 },
  { key: 'contacto',           label: 'Enganche',   icon: '🔗', step: 4 },
  { key: 'inicio_traslado',    label: 'Traslado',   icon: '🏎️', step: 5 },
  { key: 'traslado_concluido', label: 'Entregado',  icon: '🏁', step: 6 },
]

const PROGRESS_STEPS_ASISTENCIA = [
  { key: 'rumbo_contacto',     label: 'En Camino',  icon: '🚛', step: 1 },
  { key: 'arribo_origen',      label: 'En Sitio',   icon: '📍', step: 2 },
  { key: 'contacto_usuario',   label: 'Contacto',   icon: '🤝', step: 3 },
  { key: 'traslado_concluido', label: 'Término',    icon: '🏁', step: 6 },
]

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>()
  const [service,  setService]  = useState<any>(null)
  const [operator, setOperator] = useState<any>(null)
  const [truck,    setTruck]    = useState<any>(null)
  const [truckGps, setTruckGps] = useState<{ lat: number; lng: number } | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [inventoryItems, setInventoryItems] = useState<any[]>([])

  // ── Cancelado Posterior ─────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [costoMuertoEditable, setCostoMuertoEditable] = useState<string>('0')
  const [cancelNotes, setCancelNotes] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const fetchData = async () => {
    try {
      const { data: svc, error: err } = await supabase
        .from('services')
        .select('*, clients(name, costo_muerto_activo, costo_muerto_umbral_min, costo_muerto_pct)')
        .eq('id', id)
        .single()

      if (err || !svc) {
        console.error('Tracking fetch error:', err)
        setErrorMsg('Servicio no encontrado.')
        setLoading(false)
        return
      }
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
              .select('economic_number, brand, model, plates, unit_type, current_lat, current_lng, current_location')
              .eq('id', prof.tow_truck_id)
              .single()
            if (t) {
              setTruck(t)
              let lat = t.current_lat, lng = t.current_lng
              if (!lat && t.current_location) { lat = t.current_location.lat; lng = t.current_location.lng }
              if (lat && lng) setTruckGps({ lat, lng })
            }
          }
        }
      }
      // Cargar ítems de inventario si el servicio es bajo inventario
      if (svc.viaja_bajo_inventario && svc.company_id) {
        const { data: items } = await supabase
          .from('inventory_items')
          .select('id, seccion, label, orden')
          .eq('company_id', svc.company_id)
          .eq('activo', true)
          .order('seccion').order('orden')
        if (items) setInventoryItems(items)
      }
      setLastRefresh(new Date())
    } catch (e: any) {
      console.error('Tracking exception:', e)
      setErrorMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 10000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const status    = service?.status ?? 'creado'
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.creado
  const step      = statusCfg.step

  const isArrastre = service?.categoria_servicio === 'arrastre' || !service?.categoria_servicio
  const activeSteps = isArrastre ? PROGRESS_STEPS_ARRASTRE : PROGRESS_STEPS_ASISTENCIA
  const statusLabel = (!isArrastre && status === 'traslado_concluido') 
    ? 'Asistencia Completada' 
    : (!isArrastre && status === 'contacto') ? 'Maniobra / Asistencia' : statusCfg.label

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
    </div>
  )

  if (errorMsg || !service) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <p style={{ color: '#ef4444', fontWeight: 600 }}>{errorMsg || 'Servicio no disponible'}</p>
    </div>
  )

  // Coordenadas para el mapa
  const originCoords  = service.origen_coords  ?? null
  const destCoords    = service.destino_coords  ?? null

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 20 }}>

      {/* ── Status Banner ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'white', borderRadius: 14, padding: '18px 22px',
        border: `1px solid ${statusCfg.color}30`,
        boxShadow: `inset 3px 0 0 ${statusCfg.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: '50%',
            background: statusCfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Truck style={{ width: 22, height: 22, color: 'white' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: statusCfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estado Actual
            </p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{statusLabel}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
              Actualizado: {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
          <button
            onClick={fetchData}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              background: '#eff6ff', border: '1px solid #bfdbfe', cursor: 'pointer',
              fontSize: 12, color: '#3b82f6', fontWeight: 600 }}
          >
            <RefreshCw style={{ width: 13, height: 13 }} /> Actualizar
          </button>
        </div>
      </div>

      {/* ── Progreso ── */}
      {step >= 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 18px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Progreso del Servicio
          </p>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {activeSteps.map((s, i) => {
              const done   = step > s.step
              const active = step === s.step
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 64 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: done ? '#10b981' : active ? statusCfg.color : '#e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      boxShadow: active ? `0 0 0 4px ${statusCfg.color}30` : 'none',
                      transition: 'all 0.3s',
                    }}>
                      {done ? <CheckCircle2 style={{ width: 20, height: 20, color: 'white' }} /> : <span>{s.icon}</span>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? statusCfg.color : done ? '#10b981' : '#94a3b8', textAlign: 'center' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < activeSteps.length - 1 && (
                    <div style={{ flex: 1, height: 3, background: done ? '#10b981' : '#e2e8f0', margin: '0 4px', marginBottom: 20, borderRadius: 2, transition: 'all 0.3s' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Mapa + Operador (grid 2 col) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: operator ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* Mapa en Vivo */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', minHeight: 320 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Navigation style={{ width: 15, height: 15, color: '#3b82f6' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Mapa en Vivo
            </span>
            {truckGps && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                GPS Activo
              </span>
            )}
          </div>
          <div style={{ height: 280 }}>
            {(truckGps || originCoords || destCoords) ? (
              <TrackingMap
                truckGps={truckGps}
                originCoords={originCoords}
                destCoords={destCoords}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f8fafc' }}>
                <MapPin style={{ width: 32, height: 32, color: '#cbd5e1' }} />
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Sin datos de ubicación aún</p>
                <p style={{ margin: 0, fontSize: 11, color: '#cbd5e1' }}>El GPS se actualizará cuando el operador inicie turno</p>
              </div>
            )}
          </div>
          {truckGps && (
            <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                {truckGps.lat.toFixed(5)}, {truckGps.lng.toFixed(5)}
              </span>
              <a
                href={`https://www.google.com/maps?q=${truckGps.lat},${truckGps.lng}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}
              >
                <ExternalLink style={{ width: 11, height: 11 }} /> Google Maps
              </a>
            </div>
          )}
        </div>

        {/* Operador */}
        {operator && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Card operador */}
            <div style={{ background: 'white', borderRadius: 14, padding: '18px 20px', border: '1px solid #e2e8f0', flex: 1 }}>
              <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User style={{ width: 14, height: 14 }} /> Operador Asignado
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                {operator.avatar_url
                  ? <img src={operator.avatar_url} alt="" style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>
                      {operator.full_name?.[0]?.toUpperCase()}
                    </div>
                }
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{operator.full_name}</p>
                  {operator.phone && (
                    <a href={`tel:${operator.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#3b82f6', textDecoration: 'none', marginTop: 2 }}>
                      <Phone style={{ width: 12, height: 12 }} /> {operator.phone}
                    </a>
                  )}
                </div>
              </div>
              {truck && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Unidad</p>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                    {truck.economic_number} · {truck.plates}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    {truck.brand} {truck.model}
                    {truck.unit_type ? ` · Tipo ${truck.unit_type}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Origen / Destino */}
            {(service.origen_address || service.destino_address) && (
              <div style={{ background: 'white', borderRadius: 14, padding: '16px 20px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ruta</p>
                {service.origen_address && (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>🔴</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Origen</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{service.origen_address}</p>
                    </div>
                  </div>
                )}
                {service.destino_address && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>🟢</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Destino</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{service.destino_address}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Info del Servicio (memoria descriptiva) ── */}
      <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0' }}>
        <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText style={{ width: 14, height: 14 }} /> Memoria Descriptiva
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          <InfoField label="Cliente / Aseguradora" value={service.clients?.name} />
          <InfoField label="Asegurado" value={service.nombre_asegurado} />
          <InfoField label="Teléfono" value={service.telefono_contacto} />
          <InfoField label="Vehículo" value={service.marca_vehiculo && service.modelo_vehiculo ? `${service.marca_vehiculo} ${service.modelo_vehiculo} ${service.anio_vehiculo ?? ''}` : null} />
          <InfoField label="Placas Vehículo" value={service.placas_vehiculo} />
          <InfoField label="Color" value={service.color_vehiculo} />
          <InfoField label="Tipo de Falla" value={service.tipo_falla} />
          <InfoField label="Tipo de Servicio" value={service.tipo_servicio} />
          <InfoField label="Folio Aseguradora" value={service.insurance_folio} />
          <InfoField label="Distancia (km)" value={service.distancia_km != null ? `${service.distancia_km} km` : null} />
          <InfoField label="Costo Calculado" value={service.costo_calculado != null ? `$${Number(service.costo_calculado).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : null} />
        </div>
      </div>

      {/* ── Panel de Inventario (solo si viaja_bajo_inventario) ── */}
      {service.viaja_bajo_inventario && (
        <InventoryPanel service={service} inventoryItems={inventoryItems} />
      )}

      {/* ── Dispatcher Message Bar ── */}
      <DispatcherMessageBar serviceId={id} />

      {/* ── Bitácora ── */}
      <ServiceLog serviceId={id} canAddNotes={true} />

      {/* ── Botón Cancelado Posterior ── solo si hay operador asignado */}
      {service.operator_id && !['cancelado_momento','cancelado_posterior','servicio_cerrado'].includes(service.status) && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 24 }}>
          <button
            onClick={() => {
              // Pre-calcular el costo muerto
              const client = service.clients
              const costoOriginal = Number(service.costo_calculado ?? 0)
              let costoMuerto = 0
              if (client?.costo_muerto_activo && service.assigned_at) {
                const minutosTranscurridos = Math.floor(
                  (Date.now() - new Date(service.assigned_at).getTime()) / 60000
                )
                if (minutosTranscurridos > (client.costo_muerto_umbral_min ?? 15)) {
                  costoMuerto = costoOriginal * ((client.costo_muerto_pct ?? 25) / 100)
                }
              }
              setCostoMuertoEditable(costoMuerto.toFixed(2))
              setShowCancelModal(true)
            }}
            style={{
              padding: '10px 28px', background: '#dc2626', color: 'white',
              borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(220,38,38,0.3)'
            }}
          >
            ✕ Cancelado Posterior
          </button>
        </div>
      )}

      {/* ── Modal Cancelado Posterior ── */}
      {showCancelModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
        }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', position: 'relative', zIndex: 10000 }}>
            {/* Header */}
            <div style={{ background: '#dc2626', padding: '18px 22px', color: 'white' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirmar</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, marginTop: 2 }}>Cancelado Posterior</p>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tiempo transcurrido */}
              {service.assigned_at && (() => {
                const min = Math.floor((Date.now() - new Date(service.assigned_at).getTime()) / 60000)
                const umbral = service.clients?.costo_muerto_umbral_min ?? 15
                const dentroUmbral = min <= umbral
                return (
                  <div style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: dentroUmbral ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${dentroUmbral ? '#bbf7d0' : '#fecaca'}`
                  }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: dentroUmbral ? '#15803d' : '#dc2626' }}>
                      ⏱ Tiempo desde asignación: <strong>{min} min</strong>
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>
                      {dentroUmbral
                        ? `Dentro del umbral de ${umbral} min — Costo muerto = $0`
                        : `Excede el umbral de ${umbral} min — se aplica costo muerto`
                      }
                    </p>
                  </div>
                )
              })()}

              {/* Costo Muerto editable */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Costo Muerto (editable)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontWeight: 600 }}>$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={costoMuertoEditable}
                    onChange={e => setCostoMuertoEditable(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px 10px 24px', border: '1.5px solid #d1d5db',
                      borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#111827',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <p style={{ margin: '5px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  Basado en: ${Number(service.costo_calculado ?? 0).toLocaleString('es-MX', {minimumFractionDigits: 2})} &times; {service.clients?.costo_muerto_pct ?? 25}%
                </p>
              </div>

              {/* Notas */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Motivo del Cancelado Posterior
                </label>
                <textarea
                  rows={3} value={cancelNotes} onChange={e => setCancelNotes(e.target.value)}
                  placeholder="Ej. El asegurado ya no requirió servicio, cancelado por la aseguradora..."
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowCancelModal(false)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  disabled={isCancelling}
                  onClick={async () => {
                    setIsCancelling(true)
                    const costoFinal = parseFloat(costoMuertoEditable) || 0
                    // 1. Actualizar servicio
                    await supabase.from('services').update({
                      status: 'cancelado_posterior',
                      costo_muerto: costoFinal,
                      costo_calculado: costoFinal,
                    }).eq('id', id)
                    // 2. Bitácora
                    await supabase.from('service_logs').insert({
                      service_id: id,
                      type: 'status_change',
                      event_label: '❌ Cancelado Posterior',
                      note: `Servicio cancelado con costo muerto de $${costoFinal.toLocaleString('es-MX', {minimumFractionDigits:2})}. ${cancelNotes}`,
                      actor_role: 'admin',
                    })
                    setShowCancelModal(false)
                    setIsCancelling(false)
                    fetchData()
                  }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                    background: isCancelling ? '#94a3b8' : '#dc2626',
                    color: 'white', fontWeight: 700, fontSize: 13, cursor: isCancelling ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCancelling ? 'Procesando...' : 'Confirmar Cancelado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{value}</p>
    </div>
  )
}
