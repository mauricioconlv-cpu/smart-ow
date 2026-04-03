'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, Stethoscope, Package, Video, User, Phone, MapPin,
  Clock, DollarSign, FileText, Camera, CheckCircle2, AlertTriangle,
  ChevronRight, Eye, EyeOff, Key, Copy, Printer, MessageSquare, Send, X
} from 'lucide-react'

const LiveMap = dynamic(() => import('../../components/Map'), { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-xl" /> })

// ── Config por tipo ────────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  medico_domicilio:    { label: 'Médico a Domicilio',    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <Stethoscope className="w-4 h-4" /> },
  reparto_medicamento: { label: 'Reparto de Medicamento', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: <Package className="w-4 h-4" /> },
  telemedicina:        { label: 'Telemedicina',           color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200',  icon: <Video className="w-4 h-4" /> },
}

const STATUS_LABELS: Record<string, string> = {
  cotizacion: 'Cotización', programado: 'Programado', rumbo_consulta: 'Rumbo a consulta',
  en_sitio: 'En sitio', contacto_paciente: 'Contacto paciente', en_consulta: 'En consulta',
  preparando: 'Preparando pedido', en_camino: 'En camino', entregado: 'Entregado',
  concluido: 'Concluido', cancelado: 'Cancelado',
}

// Siguiente status disponible por tipo
const NEXT_STATUS: Record<string, Record<string, string>> = {
  medico_domicilio:    { cotizacion: 'programado', programado: 'rumbo_consulta', rumbo_consulta: 'en_sitio', en_sitio: 'contacto_paciente', contacto_paciente: 'en_consulta', en_consulta: 'concluido' },
  reparto_medicamento: { cotizacion: 'programado', programado: 'preparando', preparando: 'en_camino', en_camino: 'entregado', entregado: 'concluido' },
  telemedicina:        { cotizacion: 'programado', programado: 'en_consulta', en_consulta: 'concluido' },
}

export default function MedicalServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [service, setService]         = useState<any>(null)
  const [myProfile, setMyProfile]     = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [advancing, setAdvancing]     = useState(false)
  const [cancelling, setCancelling]   = useState(false)
  const [showCosts, setShowCosts]     = useState(false)
  const [notes, setNotes]             = useState('')
  const [message, setMessage]         = useState<{ text: string; ok: boolean } | null>(null)
  const [tokenInfo, setTokenInfo]     = useState<{ link: string; pin: string; accessed_at?: string } | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [isChatOpen, setIsChatOpen]   = useState(false)

  const fetchService = useCallback(async () => {
    const { data } = await supabase
      .from('medical_services')
      .select(`
        id, folio, folio_prefix, service_type, status,
        patient_name, patient_phone, patient_address, patient_coords,
        patient_age, patient_gender, patient_occupation, patient_weight, patient_height,
        symptoms, scheduled_at, created_at, closed_at,
        aseguradora, numero_expediente, follow_up_notes,
        costo_pago_proveedor, costo_medicamento, costo_envio, costo_consulta, cobro_cliente,
        diagnostico, tratamiento, medicamento_recetado, signos_vitales,
        notas_medico, firma_paciente_url, fotos_evidencia,
        doctor_lat, doctor_lng,
        doctor:medical_providers(full_name, cedula, specialty, phone)
      `)
      .eq('id', id)
      .single()
    if (data) setService(data)
    setLoading(false)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchService()
    // Obtener perfil del usuario actual
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role, is_supervisor, supervisor_level').eq('id', user.id).single()
          .then(({ data }) => setMyProfile(data))
      }
    })

    // Fetch Token Info si existe
    supabase.from('medical_service_tokens')
      .select('token, pin, accessed_at')
      .eq('service_id', id)
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        if (data) {
          const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://smart-tow.vercel.app'
          setTokenInfo({ link: `${siteUrl}/doc/${data.token}`, pin: data.pin, accessed_at: data.accessed_at })
        }
      })

    // Realtime: actualizar cuando el doctor cambia status/GPS
    const ch = supabase.channel(`medical_detail_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'medical_services', filter: `id=eq.${id}` }, fetchService)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchService, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const canSeeCosts = myProfile?.role === 'admin' || myProfile?.role === 'superadmin' || myProfile?.is_supervisor || (myProfile?.supervisor_level ?? 0) >= 1

  async function advanceStatus() {
    if (!service) return
    const next = NEXT_STATUS[service.service_type]?.[service.status]
    if (!next) return
    setAdvancing(true)
    const res = await fetch('/api/medical/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: id, newStatus: next, notes: notes.trim() || undefined }),
    })
    const data = await res.json()
    setAdvancing(false)
    if (data.success) {
      setMessage({ text: `Status actualizado a: ${STATUS_LABELS[next]}`, ok: true })
      setNotes('')
      fetchService()
    } else {
      setMessage({ text: data.error || 'Error al actualizar.', ok: false })
    }
    setTimeout(() => setMessage(null), 3500)
  }

  async function cancelService() {
    if (!confirm('¿Confirmar cancelación de este servicio?')) return
    setCancelling(true)
    await fetch('/api/medical/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: id, newStatus: 'cancelado' }),
    })
    setCancelling(false)
    fetchService()
  }

  async function sendChatMessage() {
    if (!chatMessage.trim() || !service) return
    const messages = service.chat_messages || []
    messages.push({
      sender: 'admin',
      text: chatMessage.trim(),
      timestamp: new Date().toISOString()
    })
    const { error } = await supabase.from('medical_services').update({ chat_messages: messages }).eq('id', id)
    if (!error) setChatMessage('')
    else {
      setMessage({ text: 'Error al enviar mensaje.', ok: false })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Cargando...</div>
  if (!service) return <div className="flex items-center justify-center h-64 text-red-500">Servicio no encontrado.</div>

  const cfg = TYPE_CFG[service.service_type] ?? TYPE_CFG.medico_domicilio
  const folio = `${service.folio_prefix}-${String(service.folio).padStart(4, '0')}`
  const nextStatus = NEXT_STATUS[service.service_type]?.[service.status]
  const isClosed = ['concluido','cancelado'].includes(service.status)

  // Para el mapa: posición del doctor en vivo o dirección del paciente como marcador
  const doctorPos = service.doctor_lat && service.doctor_lng
    ? [{ id: 'doctor', lat: service.doctor_lat, lng: service.doctor_lng, full_name: service.doctor?.full_name ?? 'Doctor', duty_status: 'active' }]
    : []

  return (
    <div className="max-w-3xl mx-auto space-y-5 py-4 pb-10 px-2 sm:px-4">
      
      {/* ── Columna Izquierda (Detalles del Servicio) ── */}
      <div className="space-y-5">

      {/* Toast */}
      {message && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, padding:'12px 18px', borderRadius:10,
          background: message.ok ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
          color:'white', fontWeight:600, fontSize:13 }}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl ${cfg.bg} ${cfg.border} border flex items-center justify-center shrink-0 ${cfg.color}`}>
            {cfg.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xl text-slate-800">{folio}</span>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                {cfg.label}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                service.status === 'concluido' ? 'bg-green-100 text-green-700' :
                service.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {STATUS_LABELS[service.status] ?? service.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 truncate">{service.patient_name}</p>
          </div>
        </div>
        <div className="flex shrink-0">
          <a
            href={`/dashboard/medical/${id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 md:px-4 md:py-2 flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold shadow-sm transition-colors text-sm"
            title="Imprimir Receta / Reporte Clínico"
          >
            <Printer className="w-4 h-4" /> <span className="hidden md:inline">Imprimir PDF</span>
          </a>
        </div>
      </div>

      {/* Accesos del Doctor */}
      {tokenInfo && !isClosed && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-amber-100/50">
            <Key className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-sm text-amber-800 uppercase tracking-wide">Acceso para el Doctor</span>
          </div>
          <div className="p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Link del servicio</p>
              <div className="flex items-center gap-1">
                <input readOnly value={tokenInfo.link} className="flex-1 bg-white border border-amber-200 text-xs py-2 px-3 rounded-lg font-mono text-slate-600 outline-none w-full" />
                <button onClick={() => { navigator.clipboard.writeText(tokenInfo.link); setMessage({text:'Link copiado', ok:true}); setTimeout(()=>setMessage(null), 2000) }} className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex shrink-0 items-center justify-center" aria-label="Copiar Link">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="w-full md:w-auto shrink-0 flex flex-col items-center">
              <p className="text-[10px] items-center font-bold text-amber-700 uppercase tracking-wider mb-1 text-center w-full md:text-left">
                PIN DE ACCESO
              </p>
              {tokenInfo.accessed_at ? (
                <div className="bg-emerald-50 border border-emerald-200 py-1.5 px-5 rounded-lg text-center shadow-sm flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-bold text-sm tracking-wide">PIN CANJEADO</span>
                </div>
              ) : (
                <div className="bg-white border border-amber-200 py-1.5 px-5 rounded-lg text-center shadow-sm">
                  <span className="font-black text-xl text-amber-600 tracking-[0.2em]">{tokenInfo.pin}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mapa en vivo (solo si hay GPS del doctor) */}
      {service.service_type !== 'telemedicina' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-sm text-slate-700 uppercase tracking-wide">Ubicación en Vivo</span>
            {service.doctor_lat ? (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> GPS activo
              </span>
            ) : (
              <span className="ml-auto text-xs text-slate-400">Esperando GPS del doctor...</span>
            )}
          </div>
          <div className="h-52">
            <LiveMap operators={doctorPos} />
          </div>
        </div>
      )}

      {/* Acciones de status */}
      {!isClosed && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <ChevronRight className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-sm text-slate-700 uppercase tracking-wide">Avance del Servicio</span>
          </div>
          <div className="p-4 space-y-5">
            {/* ── Stepper UI ── */}
            <div className="flex items-center justify-between w-full relative mb-2">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full z-0"></div>
              {(() => {
                const flow = ['cotizacion', 'programado', 'rumbo_consulta', 'en_sitio', 'contacto_paciente', 'en_consulta', 'concluido'];
                let statesToShow = flow;
                if (service?.service_type === 'telemedicina') {
                  statesToShow = ['cotizacion', 'programado', 'en_consulta', 'concluido'];
                }
                const currentIndex = statesToShow.indexOf(service?.status) !== -1 ? statesToShow.indexOf(service?.status) : 0;

                return statesToShow.map((st, i) => {
                  const isDone = i < currentIndex;
                  const isCurrent = i === currentIndex;
                  const label = STATUS_LABELS[st] ?? st;

                  return (
                    <div key={st} className="relative z-10 flex flex-col items-center gap-2 w-full max-w-[80px]">
                      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
                        isCurrent ? 'bg-emerald-50 border-emerald-500 text-emerald-600' :
                        'bg-white border-slate-200 text-slate-300'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{i+1}</span>}
                      </div>
                      <span className={`text-[10px] text-center font-bold tracking-tight px-1 leading-tight ${
                        isDone || isCurrent ? 'text-slate-800' : 'text-slate-400'
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Nota opcional al avanzar status..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
            <div className="flex gap-2">
              {nextStatus && (
                <button
                  onClick={advanceStatus}
                  disabled={advancing}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {advancing ? 'Actualizando...' : `Avanzar → ${STATUS_LABELS[nextStatus]}`}
                </button>
              )}
              <button
                onClick={cancelService}
                disabled={cancelling}
                className="px-4 py-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm transition-colors disabled:opacity-40"
              >
                {cancelling ? '...' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info del paciente */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <SectionHeader icon={<User className="w-4 h-4" />} title="Datos del Paciente" />
        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Nombre" value={service.patient_name} />
          {service.patient_age && <InfoRow label="Edad" value={`${service.patient_age} años`} />}
          {service.patient_gender && <InfoRow label="Género" value={service.patient_gender === 'M' ? 'Masculino' : service.patient_gender === 'F' ? 'Femenino' : 'Otro'} />}
          {service.patient_occupation && <InfoRow label="Ocupación" value={service.patient_occupation} />}
          <InfoRow label="Teléfono" value={service.patient_phone} icon={<Phone className="w-3 h-3" />} />
          {service.patient_address && <InfoRow label="Dirección" value={service.patient_address} span />}
          {service.symptoms && <InfoRow label="Síntomas / Motivo" value={service.symptoms} span />}
          {service.aseguradora && <InfoRow label="Aseguradora" value={service.aseguradora} />}
          {service.numero_expediente && <InfoRow label="Expediente" value={service.numero_expediente} />}
          {service.scheduled_at && (
            <InfoRow label="Cita Programada"
              value={new Date(service.scheduled_at).toLocaleString('es-MX', { dateStyle:'medium', timeStyle:'short' })}
              icon={<Clock className="w-3 h-3" />} />
          )}
        </div>
      </div>

      {/* Doctor asignado */}
      {service.doctor && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader icon={<Stethoscope className="w-4 h-4" />} title="Doctor / Proveedor" />
          <div className="p-4 grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Nombre" value={service.doctor.full_name} />
            <InfoRow label="Especialidad" value={service.doctor.specialty} />
            {service.doctor.cedula && <InfoRow label="Cédula" value={service.doctor.cedula} />}
            {service.doctor.phone && <InfoRow label="Teléfono" value={service.doctor.phone} icon={<Phone className="w-3 h-3" />} />}
          </div>
        </div>
      )}

      {/* Costos */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
          <DollarSign className="w-4 h-4 text-slate-500" />
          <span className="font-bold text-sm text-slate-700 uppercase tracking-wide">Costos</span>
          {canSeeCosts && (
            <button onClick={() => setShowCosts(!showCosts)} className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              {showCosts ? <><EyeOff className="w-3.5 h-3.5" /> Ocultar internos</> : <><Eye className="w-3.5 h-3.5" /> Ver costos internos</>}
            </button>
          )}
        </div>
        <div className="p-4 space-y-2 text-sm">
          <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-100 pt-2">
            <span>Cobro al cliente</span>
            <span>${Number(service.cobro_cliente).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
          </div>
          {canSeeCosts && showCosts && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5 mt-2">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Costos internos (confidencial)</p>
              {service.costo_pago_proveedor > 0 && <CostRow label="Pago al proveedor" value={service.costo_pago_proveedor} />}
              {service.costo_medicamento > 0 && <CostRow label="Medicamentos (farmacia)" value={service.costo_medicamento} />}
              {service.costo_envio > 0 && <CostRow label="Costo de envío" value={service.costo_envio} />}
              {service.costo_consulta > 0 && <CostRow label="Costo de consulta" value={service.costo_consulta} />}
              <div className="border-t border-amber-200 pt-1.5 flex justify-between font-bold text-amber-800">
                <span>Margen</span>
                <span>${(Number(service.cobro_cliente) - Number(service.costo_pago_proveedor) - Number(service.costo_medicamento) - Number(service.costo_consulta) - Number(service.costo_envio)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formulario médico (completado por el doctor) */}
      {(service.diagnostico || service.tratamiento || service.medicamento_recetado || service.notas_medico) && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader icon={<FileText className="w-4 h-4" />} title="Formulario Médico (Doctor)" />
          <div className="p-4 grid grid-cols-1 gap-3 text-sm">
            {service.diagnostico && <InfoRow label="Diagnóstico" value={service.diagnostico} span />}
            {service.tratamiento && <InfoRow label="Tratamiento indicado" value={service.tratamiento} span />}
            {service.medicamento_recetado && <InfoRow label="Medicamento recetado" value={service.medicamento_recetado} span />}
            {service.signos_vitales && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Signos Vitales</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(service.signos_vitales as Record<string,string>).map(([k,v]) => (
                    <span key={k} className="bg-slate-100 rounded-lg px-3 py-1 text-xs font-semibold text-slate-700">
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {service.notas_medico && <InfoRow label="Observaciones del médico" value={service.notas_medico} span />}
          </div>
        </div>
      )}

      {/* Evidencias fotográficas */}
      {service.fotos_evidencia && service.fotos_evidencia.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader icon={<Camera className="w-4 h-4" />} title={`Evidencias Fotográficas (${service.fotos_evidencia.length})`} />
          <div className="p-4 grid grid-cols-3 gap-2">
            {service.fotos_evidencia.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-400 transition-all">
                <img src={url} alt={`Evidencia ${i+1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Firma del paciente */}
      {service.firma_paciente_url && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader icon={<CheckCircle2 className="w-4 h-4" />} title="Firma del Paciente" />
          <div className="p-4">
            <img src={service.firma_paciente_url} alt="Firma del paciente" className="max-h-32 border border-slate-200 rounded-lg" />
          </div>
        </div>
      )}

      {/* Notas de seguimiento */}
      {service.follow_up_notes && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <SectionHeader icon={<FileText className="w-4 h-4" />} title="Notas de Seguimiento" />
          <div className="p-4 text-sm text-slate-700 whitespace-pre-wrap">{service.follow_up_notes}</div>
        </div>
      )}
      </div>

      {/* ── Floating Chat Widget ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Chat Window */}
        {isChatOpen && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col mb-4 w-[340px] sm:w-[380px] h-[450px] transition-all transform origin-bottom-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-emerald-600 text-white">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span className="font-bold text-sm uppercase tracking-wide">Chat Operativo</span>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="hover:bg-emerald-500 p-1.5 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {!service?.chat_messages?.length && (
                <div className="text-center text-slate-400 text-sm mt-10">El chat está vacío.</div>
              )}
              {service?.chat_messages?.map((msg: any, i: number) => {
                const isAdmin = msg.sender === 'admin'
                return (
                  <div key={i} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                      isAdmin ? 'bg-emerald-100 text-emerald-900 rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
              <input
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                placeholder="Mensaje..."
                className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatMessage.trim()}
                className="w-10 h-10 shrink-0 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Chat Toggle Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`h-14 rounded-full flex items-center justify-center shadow-xl transition-all ${
            isChatOpen ? 'w-14 bg-slate-800 hover:bg-slate-700 text-white' : 'w-14 bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>

    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
      <span className="text-slate-500">{icon}</span>
      <span className="font-bold text-sm text-slate-700 uppercase tracking-wide">{title}</span>
    </div>
  )
}

function InfoRow({ label, value, icon, span }: { label: string; value?: string | null; icon?: React.ReactNode; span?: boolean }) {
  if (!value) return null
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-slate-800 flex items-center gap-1">{icon}{value}</p>
    </div>
  )
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm text-amber-800">
      <span>{label}</span>
      <span>${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
    </div>
  )
}
