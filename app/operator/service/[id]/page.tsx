'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronRight, MapPin, Navigation, Loader2, Phone } from 'lucide-react'
import { advanceServiceStatus } from './actions'

const STEPS = [
  { id: 'rumbo_contacto',     emoji: '🚛', label: 'En Camino al Origen',     sub: 'Confirma cuando salgas hacia el lugar del siniestro' },
  { id: 'arribo_origen',      emoji: '📍', label: 'Llegué al Origen',         sub: 'Confirma cuando llegues con el cliente' },
  { id: 'contacto',           emoji: '🔗', label: 'Maniobra / Enganche',      sub: 'Confirma cuando el vehículo esté enganchado' },
  { id: 'inicio_traslado',    emoji: '🏎️', label: 'En Traslado al Destino',  sub: 'Confirma cuando salgas con el vehículo hacia el destino' },
  { id: 'traslado_concluido', emoji: '🏁', label: 'Entregado en Destino',     sub: 'Confirma cuando hayas descargado en el destino' },
]

// Map status to step index (-1 = before first step)
const STATUS_INDEX: Record<string, number> = {
  rumbo_contacto:     0,
  arribo_origen:      1,
  contacto:           2,
  inicio_traslado:    3,
  traslado_concluido: 4,
  servicio_cerrado:   5,
}

export default function ServiceControlPage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 15: params is a Promise
  const { id: serviceId } = use(params)
  const supabase = createClient()

  const [service, setService] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')

  const load = async () => {
    const { data } = await supabase
      .from('services')
      .select('*, clients(name)')
      .eq('id', serviceId)
      .single()
    if (data) setService(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 6000)
    return () => clearInterval(interval)
  }, [serviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdvance = async (nextStatus: string) => {
    setUpdating(true)
    setUpdateError('')
    const res = await advanceServiceStatus(serviceId, nextStatus)
    if (!res.success) setUpdateError(res.error ?? 'Error al actualizar')
    else await load()
    setUpdating(false)
  }

  // ── Loading
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '4px solid #bfdbfe', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 12 }}>Cargando servicio...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!service) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <p style={{ color: '#ef4444', fontWeight: 600 }}>Servicio no encontrado.</p>
    </div>
  )

  const currentIdx = STATUS_INDEX[service.status] ?? -1
  const isClosed   = service.status === 'servicio_cerrado'

  // Next action button
  const nextStep = currentIdx < STEPS.length ? STEPS[currentIdx + 1] ?? null : null
  const currentStep = STEPS[currentIdx] ?? null

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: 120 }}>

      {/* Header */}
      <div style={{ background: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/operator" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 18, height: 18, color: '#475569' }} />
        </Link>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>FOLIO #{service.folio}</p>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{service.clients?.name ?? 'Servicio'}</h1>
        </div>
      </div>

      <div style={{ padding: '16px', maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Current Status Banner */}
        {!isClosed && currentStep && (
          <div style={{
            background: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: 16,
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: 36 }}>{currentStep.emoji}</span>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>Estado Actual</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e3a5f' }}>{currentStep.label}</p>
            </div>
          </div>
        )}

        {isClosed && (
          <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <CheckCircle2 style={{ width: 40, height: 40, color: '#16a34a', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Servicio Completado</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#14532d' }}>¡Servicio cerrado!</p>
            </div>
          </div>
        )}

        {/* Origen / Destino */}
        <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Navigation style={{ width: 18, height: 18, color: '#94a3b8', marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Origen</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                {service.origen_address || service.origen_coords?.address || 'No especificado'}
              </p>
            </div>
          </div>
          <div style={{ height: 1, background: '#f1f5f9' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <MapPin style={{ width: 18, height: 18, color: '#ef4444', marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Destino</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                {service.destino_address || service.destino_coords?.address || 'No especificado'}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline Vertical */}
        <div style={{ background: 'white', borderRadius: 16, padding: '18px 18px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Progreso del Servicio</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((step, i) => {
              const done    = i <  currentIdx
              const current = i === currentIdx
              const future  = i >  currentIdx
              return (
                <div key={step.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div style={{ position: 'absolute', left: 17, top: 34, bottom: -10, width: 2, background: done ? '#3b82f6' : '#e2e8f0', zIndex: 0 }} />
                  )}
                  {/* Circle */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                    background: done ? '#3b82f6' : current ? '#fff' : '#f1f5f9',
                    border: done ? '2px solid #3b82f6' : current ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: done ? 14 : 18,
                  }}>
                    {done ? <CheckCircle2 style={{ width: 18, height: 18, color: 'white' }} /> : <span>{step.emoji}</span>}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, paddingBottom: 20, paddingTop: 6 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: current ? 800 : done ? 600 : 400, color: current ? '#1d4ed8' : done ? '#0f172a' : '#94a3b8' }}>
                      {step.label}
                    </p>
                    {current && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{step.sub}</p>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Closed step */}
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: isClosed ? '#16a34a' : '#f1f5f9',
                border: isClosed ? '2px solid #16a34a' : '2px solid #cbd5e1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isClosed ? <CheckCircle2 style={{ width: 18, height: 18, color: 'white' }} /> : <span>✅</span>}
              </div>
              <div style={{ flex: 1, paddingTop: 6 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: isClosed ? 800 : 400, color: isClosed ? '#16a34a' : '#94a3b8' }}>
                  Servicio Cerrado y Firmado
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {updateError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ margin: 0, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>⚠️ {updateError}</p>
          </div>
        )}

      </div>

      {/* Fixed bottom action */}
      {!isClosed && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
          {nextStep ? (
            <button
              onClick={() => handleAdvance(nextStep.id)}
              disabled={updating}
              style={{
                width: '100%', padding: '18px 20px', borderRadius: 14, border: 'none',
                background: updating ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: 'white', fontWeight: 800, fontSize: 16, cursor: updating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: 11, opacity: 0.8, fontWeight: 600 }}>SIGUIENTE PASO</p>
                <p style={{ margin: 0, fontSize: 15 }}>{nextStep.emoji} {nextStep.label}</p>
              </div>
              {updating
                ? <Loader2 style={{ width: 24, height: 24, animation: 'spin 0.8s linear infinite' }} />
                : <ChevronRight style={{ width: 28, height: 28 }} />
              }
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </button>
          ) : (
            /* traslado_concluido → go to close/signature */
            <Link
              href={`/operator/service/${serviceId}/close`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '18px 20px', borderRadius: 14,
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: 'white', fontWeight: 800, fontSize: 16, textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(22, 163, 74, 0.4)',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: 11, opacity: 0.8, fontWeight: 600 }}>COMPLETAR SERVICIO</p>
                <p style={{ margin: 0, fontSize: 15 }}>✅ Proceder a Firma y Cierre</p>
              </div>
              <ChevronRight style={{ width: 28, height: 28 }} />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
