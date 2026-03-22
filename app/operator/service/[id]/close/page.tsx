'use client'

import { useState, useRef, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import SignatureCanvas from 'react-signature-canvas'
import { Star, Save, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// ── Radio group helper ─────────────────────────────────────────────────────
function RadioGroup({
  label, options, value, onChange
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              border: value === opt.value ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
              background: value === opt.value ? '#eff6ff' : 'white',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              border: value === opt.value ? '6px solid #3b82f6' : '2px solid #cbd5e1',
              transition: 'all 0.15s',
            }} />
            <span style={{ fontSize: 14, fontWeight: value === opt.value ? 700 : 500, color: value === opt.value ? '#1d4ed8' : '#475569' }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Star Rating ────────────────────────────────────────────────────────────
function StarRating({ rating, onChange }: { rating: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            transform: 'scale(1)', transition: 'transform 0.1s',
          }}
        >
          <Star
            style={{ width: 38, height: 38, fill: rating >= star ? '#facc15' : 'none', stroke: rating >= star ? '#eab308' : '#cbd5e1', strokeWidth: 1.5 }}
          />
        </button>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CloseServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serviceId } = use(params)
  const router  = useRouter()
  const supabase = createClient()
  const sigCanvas = useRef<any>(null)

  const [service,    setService]    = useState<any>(null)
  const [company,    setCompany]    = useState<any>(null)
  const [rating,     setRating]     = useState(0)
  const [comments,   setComments]   = useState('')
  const [tipoAsistencia,  setTipoAsistencia]  = useState('')
  const [tiempoEspera,    setTiempoEspera]    = useState('')
  const [calidadOperador, setCalidadOperador] = useState('')
  const [nombreCliente,   setNombreCliente]   = useState('')
  const [isSubmitting,    setIsSubmitting]    = useState(false)
  const [errorMsg,        setErrorMsg]        = useState('')

  // Load service + company logo
  useEffect(() => {
    async function load() {
      const { data: svc } = await supabase
        .from('services')
        .select('*, clients(name, company_id)')
        .eq('id', serviceId)
        .single()
      if (svc) {
        setService(svc)
        // Get company via operator's profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', svc.operator_id ?? '')
          .single()
        const companyId = prof?.company_id
        if (companyId) {
          const { data: co } = await supabase
            .from('companies')
            .select('name, logo_url')
            .eq('id', companyId)
            .single()
          if (co) setCompany(co)
        }
      }
    }
    load()
  }, [serviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearSignature = () => sigCanvas.current?.clear()

  const handleCompleteService = async () => {
    if (!tipoAsistencia) { setErrorMsg('Seleccione el tipo de asistencia.'); return }
    if (!tiempoEspera)   { setErrorMsg('Seleccione el tiempo de espera.'); return }
    if (!calidadOperador){ setErrorMsg('Califique la atención del operador.'); return }
    if (rating === 0)    { setErrorMsg('Otorgue una calificación de estrellas.'); return }
    if (!nombreCliente.trim()) { setErrorMsg('Ingrese el nombre del cliente.'); return }
    if (sigCanvas.current?.isEmpty()) { setErrorMsg('La firma del cliente es obligatoria.'); return }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      // 1. Upload signature
      const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png')
      const blob = await (await fetch(signatureDataUrl)).blob()
      const fileName = `${serviceId}/firma_${Date.now()}.png`
      const { error: uploadErr } = await supabase.storage
        .from('firmas')
        .upload(fileName, blob, { contentType: 'image/png' })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage.from('firmas').getPublicUrl(fileName)

      // 2. Update service record
      const { error: updateErr } = await supabase
        .from('services')
        .update({
          status:               'servicio_cerrado',
          calidad_estrellas:    rating,
          comentarios_calidad:  comments,
          firma_url:            publicUrl,
          tipo_asistencia:      tipoAsistencia,
          tiempo_espera:        tiempoEspera,
          calidad_operador:     calidadOperador,
          nombre_cliente_firma: nombreCliente.trim(),
          updated_at:           new Date().toISOString(),
        })
        .eq('id', serviceId)
      if (updateErr) throw updateErr

      // 3. Log in bitácora
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('service_logs').insert({
          service_id:  serviceId,
          created_by:  user.id,
          type:        'status_change',
          note:        `Servicio concluido. Tipo: ${tipoAsistencia} · Espera: ${tiempoEspera} min · Operador: ${calidadOperador} · ${rating}★`,
          actor_role:  'operator',
          event_label: '✅ Servicio cerrado y firmado',
        })
      }

      router.push('/operator?success=cerrado')
      router.refresh()

    } catch (e: any) {
      setErrorMsg(e.message || 'Ocurrió un error al guardar.')
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: 120 }}>

      {/* Header */}
      <div style={{ background: 'white', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href={`/operator/service/${serviceId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 18, height: 18, color: '#475569' }} />
        </Link>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Finalizar Servicio</h1>
      </div>

      <div style={{ padding: 16, maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Company Logo ── */}
        {company && (
          <div style={{
            background: 'white', borderRadius: 16, padding: '18px 20px',
            border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14,
          }}>
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                style={{ height: 48, maxWidth: 120, objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>
                {company.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Empresa</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{company.name}</p>
            </div>
          </div>
        )}

        {/* ── Encuesta de Calidad ── */}
        <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Encuesta de Calidad</p>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: '#94a3b8' }}>Pida al cliente que evalúe el trato y servicio brindado.</p>

          <RadioGroup
            label="1. Tipo de asistencia recibida:"
            value={tipoAsistencia}
            onChange={setTipoAsistencia}
            options={[
              { value: 'grua',      label: '🚛 Grúa' },
              { value: 'corriente', label: '⚡ Paso de corriente' },
              { value: 'llanta',    label: '🔧 Cambio de llanta' },
              { value: 'gasolina',  label: '⛽ Suministro de gasolina' },
            ]}
          />

          <RadioGroup
            label="2. El tiempo de espera entre solicitud y arribo fue:"
            value={tiempoEspera}
            onChange={setTiempoEspera}
            options={[
              { value: '0-45',   label: '✅ 0 – 45 minutos' },
              { value: '45-60',  label: '⏳ 45 – 60 minutos' },
              { value: 'mas-60', label: '⚠️ Más de 60 minutos' },
            ]}
          />

          <RadioGroup
            label="3. ¿Cómo califica la atención y presentación del operador?"
            value={calidadOperador}
            onChange={setCalidadOperador}
            options={[
              { value: 'excelente', label: '🌟 Excelente' },
              { value: 'buena',     label: '👍 Buena' },
              { value: 'regular',   label: '😐 Regular' },
              { value: 'mala',      label: '👎 Mala' },
            ]}
          />

          {/* Stars */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>4. Calificación general del servicio:</p>
            <StarRating rating={rating} onChange={setRating} />
            <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>
              {rating === 0 ? 'Toca para calificar' : ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'][rating]}
            </p>
          </div>

          {/* Opinión libre */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>5. Opinión y observaciones del servicio:</p>
            <textarea
              rows={3}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Escribe aquí cualquier comentario u observación adicional..."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14,
                border: '1.5px solid #e2e8f0', outline: 'none', resize: 'none',
                color: '#1e293b', background: '#f8fafc', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* ── Nombre + Firma ── */}
        <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Nombre y Firma</p>

          {/* Nombre del cliente */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Nombre completo del cliente:</p>
            <input
              type="text"
              value={nombreCliente}
              onChange={e => setNombreCliente(e.target.value)}
              placeholder="Ej: Juan Pérez González"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14,
                border: '1.5px solid #e2e8f0', outline: 'none', color: '#1e293b',
                background: '#f8fafc', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Signature */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Firma de conformidad:</p>
            <button
              type="button"
              onClick={handleClearSignature}
              style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
            >
              Limpiar
            </button>
          </div>
          <div style={{ border: '2px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc', overflow: 'hidden', touchAction: 'none' }}>
            <SignatureCanvas
              ref={sigCanvas}
              penColor="#1d4ed8"
              canvasProps={{ style: { width: '100%', height: 180 } }}
            />
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', margin: '8px 0 0' }}>Firmar sobre el área punteada</p>
        </div>

        {/* Error */}
        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px' }}>
            <p style={{ margin: 0, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>⚠️ {errorMsg}</p>
          </div>
        )}

      </div>

      {/* Fixed bottom action */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #e2e8f0', padding: 16, boxShadow: '0 -4px 20px rgba(0,0,0,0.08)', zIndex: 20 }}>
        <button
          onClick={handleCompleteService}
          disabled={isSubmitting}
          style={{
            width: '100%', padding: '18px 20px', borderRadius: 14, border: 'none',
            background: isSubmitting ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)',
            color: 'white', fontWeight: 800, fontSize: 16, cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 4px 16px rgba(22, 163, 74, 0.4)', transition: 'all 0.2s',
          }}
        >
          {isSubmitting
            ? <><Loader2 style={{ width: 22, height: 22, animation: 'spin 0.8s linear infinite' }} /> Guardando Acta...</>
            : <><CheckCircle2 style={{ width: 22, height: 22 }} /> Concluir Servicio</>
          }
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </button>
      </div>
    </div>
  )
}
