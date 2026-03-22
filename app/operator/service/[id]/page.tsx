'use client'

import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, ChevronRight, MapPin, Navigation,
  Loader2, MessageSquare, Send, X
} from 'lucide-react'
import { advanceServiceStatus } from './actions'
import { useOperatorStore } from '../../store'
import OperatorBitacoraNotifier from '../../components/OperatorBitacoraNotifier'

const STEPS = [
  { id: 'rumbo_contacto',     emoji: '🚛', label: 'En Camino al Origen',     sub: 'Confirma cuando salgas hacia el lugar del siniestro' },
  { id: 'arribo_origen',      emoji: '📍', label: 'Llegué al Origen',         sub: 'Confirma cuando llegues al lugar del siniestro' },
  { id: 'contacto_usuario',   emoji: '🤝', label: 'Contacto con Usuario',     sub: 'Confirma cuando hagas contacto con el cliente' },
  { id: 'contacto',           emoji: '🔗', label: 'Maniobra / Enganche',      sub: 'Confirma cuando el vehículo esté enganchado' },
  { id: 'inicio_traslado',    emoji: '🏎️', label: 'En Traslado al Destino',  sub: 'Confirma cuando salgas con el vehículo hacia el destino' },
  { id: 'traslado_concluido', emoji: '🏁', label: 'Entregado en Destino',     sub: 'Confirma cuando hayas descargado en el destino' },
]

const STATUS_INDEX: Record<string, number> = {
  rumbo_contacto:     0,
  arribo_origen:      1,
  contacto_usuario:   2,
  contacto:           3,
  inicio_traslado:    4,
  traslado_concluido: 5,
  servicio_cerrado:   6,
}

interface CabinMessage {
  id: string
  type: string
  note: string
  event_label: string | null
  actor_role: string | null
  resource_url: string | null
  created_at: string
}

export default function ServiceControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serviceId } = use(params)
  const supabase = createClient()

  const [service,     setService]     = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  const [updating,    setUpdating]    = useState(false)
  const [updateError, setUpdateError] = useState('')

  // Messages from dispatcher (dispatcher_note)
  const [cabinMsgs,   setCabinMsgs]   = useState<CabinMessage[]>([])
  const [newMsgCount, setNewMsgCount] = useState(0)

  // Operator sends text note
  const [operatorNote, setOperatorNote] = useState('')
  const [noteSending,  setNoteSending]  = useState(false)
  const [noteSent,     setNoteSent]     = useState(false)

  const { setActiveService } = useOperatorStore()

  useEffect(() => {
    setActiveService(serviceId)
    return () => setActiveService(null)
  }, [serviceId, setActiveService])

  const load = async () => {
    const { data } = await supabase
      .from('services')
      .select('*, clients(name)')
      .eq('id', serviceId)
      .single()
    if (data) setService(data)
    setLoading(false)
  }

  // Load messages from dispatcher (dispatcher_note)
  const loadCabinMsgs = async () => {
    const { data } = await supabase
      .from('service_logs')
      .select('id, type, note, event_label, actor_role, resource_url, created_at')
      .eq('service_id', serviceId)
      .eq('type', 'dispatcher_note')
      .order('created_at', { ascending: true })
    if (data) setCabinMsgs(data as CabinMessage[])
  }

  useEffect(() => {
    load()
    loadCabinMsgs()

    const interval = setInterval(load, 6000)

    // Real-time: listen for new dispatcher_note
    const logChannel = supabase
      .channel(`operator_cabin_msgs_${serviceId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'service_logs',
        filter: `service_id=eq.${serviceId}`,
      }, (payload: any) => {
        const row = payload.new
        if (row.actor_role === 'dispatcher' && row.type === 'dispatcher_note') {
          loadCabinMsgs()
          setNewMsgCount(c => c + 1)
        }
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(logChannel)
    }
  }, [serviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdvance = async (nextStatus: string) => {
    setUpdating(true)
    setUpdateError('')
    const res = await advanceServiceStatus(serviceId, nextStatus)
    if (!res.success) setUpdateError(res.error ?? 'Error al actualizar')
    else await load()
    setUpdating(false)
  }

  async function sendOperatorNote() {
    const msg = operatorNote.trim()
    if (!msg || noteSending) return
    setNoteSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('no auth')
      await supabase.from('service_logs').insert({
        service_id:  serviceId,
        created_by:  user.id,
        type:        'operator_note',
        note:        msg,
        actor_role:  'operator',
        event_label: '💬 Operador — nota de texto',
      })
      setOperatorNote('')
      setNoteSent(true)
      setTimeout(() => setNoteSent(false), 2500)
    } catch (e: any) {
      console.error('[OperatorNote]', e.message)
    } finally {
      setNoteSending(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────
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
  const nextStep   = currentIdx < STEPS.length ? STEPS[currentIdx + 1] ?? null : null
  const currentStep = STEPS[currentIdx] ?? null

  const hasNewCabinMsgs = newMsgCount > 0

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: 120 }}>
      {/* Notificador de mensajes de la cabina */}
      <OperatorBitacoraNotifier serviceId={serviceId} />

      {/* Header */}
      <div style={{ background: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/operator" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 18, height: 18, color: '#475569' }} />
        </Link>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>FOLIO #{service.folio}</p>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{service.clients?.name ?? 'Servicio'}</h1>
        </div>
        {/* New message badge in header */}
        {newMsgCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: '#dcfce7', color: '#15803d',
            padding: '4px 10px', borderRadius: 20,
            fontSize: 11, fontWeight: 800,
            animation: 'cabinPulse 1s ease-in-out infinite',
          }}>
            <MessageSquare style={{ width: 13, height: 13 }} />
            {newMsgCount} nuevo{newMsgCount > 1 ? 's' : ''}
          </div>
        )}
        <style>{`@keyframes cabinPulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
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

        {/* ── Mensajes de la Cabina (dispatcher_note) ────────────────────── */}
        <div style={{
          background: 'white', borderRadius: 16,
          border: newMsgCount > 0 ? '2px solid #4ade80' : '1px solid #e2e8f0',
          overflow: 'hidden', transition: 'all 0.3s',
        }}>
          <div style={{
            padding: '12px 18px', background: newMsgCount > 0 ? '#f0fdf4' : '#f8fafc',
            borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <MessageSquare style={{ width: 16, height: 16, color: newMsgCount > 0 ? '#16a34a' : '#64748b' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: newMsgCount > 0 ? '#15803d' : '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mensajes de la Cabina
            </span>
            {newMsgCount > 0 && (
              <>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, background: '#16a34a', color: 'white', padding: '2px 8px', borderRadius: 10 }}>
                  {newMsgCount} NUEVO{newMsgCount > 1 ? 'S' : ''}
                </span>
                <button onClick={() => setNewMsgCount(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </>
            )}
          </div>

          {cabinMsgs.length === 0 ? (
            <p style={{ margin: 0, padding: '16px 18px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
              Sin mensajes de la cabina
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {cabinMsgs.map((msg, i) => (
                <div key={msg.id} style={{
                  padding: '14px 18px',
                  borderBottom: i < cabinMsgs.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: '#fafafa',
                }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💬 Cabina</p>
                  <p style={{ margin: '0 0 6px', fontSize: 14, color: '#1e293b', lineHeight: 1.5 }}>{msg.note}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                    {new Date(msg.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Enviar nota de texto al despachador ─────────────────────────── */}
        <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💬 Enviar nota a la cabina</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={operatorNote}
              onChange={e => setOperatorNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendOperatorNote()}
              placeholder="Escribe un mensaje para el despachador…"
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 10, fontSize: 14,
                border: '1.5px solid #e2e8f0', outline: 'none', color: '#1e293b',
              }}
            />
            <button
              onClick={sendOperatorNote}
              disabled={!operatorNote.trim() || noteSending}
              style={{
                width: 48, height: 48, borderRadius: 10, border: 'none',
                background: noteSent ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: !operatorNote.trim() || noteSending ? 0.5 : 1, cursor: 'pointer', flexShrink: 0,
              }}
            >
              {noteSending
                ? <Loader2 style={{ width: 20, height: 20, color: 'white', animation: 'spin 0.8s linear infinite' }} />
                : <Send style={{ width: 20, height: 20, color: 'white' }} />
              }
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </button>
          </div>
          {noteSent && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ Nota enviada a la cabina</p>}
        </div>

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
              return (
                <div key={step.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                  {i < STEPS.length - 1 && (
                    <div style={{ position: 'absolute', left: 17, top: 34, bottom: -10, width: 2, background: done ? '#3b82f6' : '#e2e8f0', zIndex: 0 }} />
                  )}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                    background: done ? '#3b82f6' : current ? '#fff' : '#f1f5f9',
                    border: done ? '2px solid #3b82f6' : current ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: done ? 14 : 18,
                  }}>
                    {done ? <CheckCircle2 style={{ width: 18, height: 18, color: 'white' }} /> : <span>{step.emoji}</span>}
                  </div>
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
