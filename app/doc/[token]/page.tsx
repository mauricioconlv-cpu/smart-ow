'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Stethoscope, Package, Video, MapPin, Phone, User,
  ChevronRight, CheckCircle2, Camera, FileText, Lock,
  AlertTriangle, Loader2, Activity
} from 'lucide-react'
import { SignaturePad } from '@/components/ui/SignaturePad'

// ── Tipos ──────────────────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  medico_domicilio:    { label: 'Médico a Domicilio',    color: 'text-emerald-700', bg: 'bg-emerald-600', icon: <Stethoscope className="w-6 h-6" /> },
  reparto_medicamento: { label: 'Reparto de Medicamento', color: 'text-blue-700',    bg: 'bg-blue-600',    icon: <Package className="w-6 h-6" /> },
  telemedicina:        { label: 'Telemedicina',           color: 'text-violet-700',  bg: 'bg-violet-600',  icon: <Video className="w-6 h-6" /> },
}

const STATUS_LABELS: Record<string, string> = {
  cotizacion:'Cotización', programado:'Programado', rumbo_consulta:'Rumbo a consulta',
  en_sitio:'En sitio', contacto_paciente:'Contacto paciente', en_consulta:'En consulta',
  preparando:'Preparando pedido', en_camino:'En camino', entregado:'Entregado',
  concluido:'Concluido', cancelado:'Cancelado',
}

const NEXT_STATUS: Record<string, Record<string, string>> = {
  medico_domicilio:    { cotizacion:'programado', programado:'rumbo_consulta', rumbo_consulta:'en_sitio', en_sitio:'contacto_paciente', contacto_paciente:'en_consulta', en_consulta:'concluido' },
  reparto_medicamento: { cotizacion:'programado', programado:'preparando', preparando:'en_camino', en_camino:'entregado', entregado:'concluido' },
  telemedicina:        { cotizacion:'programado', programado:'en_consulta', en_consulta:'concluido' },
}

const NEXT_LABELS: Record<string, string> = {
  programado:'Iniciar', rumbo_consulta:'Salir hacia el domicilio',
  en_sitio:'Llegué al domicilio', contacto_paciente:'Contacté al paciente',
  en_consulta:'Iniciar consulta', entregado:'Entregué los medicamentos',
  preparando:'Preparando pedido', en_camino:'Salí a entregar',
  concluido:'Finalizar y cerrar servicio',
}

// ── Componente Principal ────────────────────────────────────────────────────
export default function DoctorAccessPage() {
  const { token } = useParams<{ token: string }>()

  // Auth state
  const [phase, setPhase] = useState<'pin'|'service'|'expired'|'error'>('pin')
  const [pin, setPin] = useState(['','','',''])
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [service, setService] = useState<any>(null)
  const [authHeader, setAuthHeader] = useState('')

  // Service actions
  const [advancing, setAdvancing]       = useState(false)
  const [activeSection, setActiveSection] = useState<'status'|'form'|'photos'>('status')
  const [saving, setSaving]             = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [gpsActive, setGpsActive]       = useState(false)
  const [successMsg, setSuccessMsg]     = useState('')

  // Medical form
  const [diagnostico, setDiagnostico]   = useState('')
  const [tratamiento, setTratamiento]   = useState('')
  const [medicamento, setMedicamento]   = useState('')
  const [notas, setNotas]               = useState('')
  
  const [peso, setPeso]                 = useState('')
  const [talla, setTalla]               = useState('')
  const [anamnesis, setAnamnesis]       = useState('')
  const [exploracion, setExploracion]   = useState('')

  const [presion, setPresion]           = useState('')
  const [pulso, setPulso]               = useState('')
  const [temperatura, setTemperatura]   = useState('')
  const [frecResp, setFrecResp]         = useState('')
  const [spO2, setSpO2]                 = useState('')
  const [glucosa, setGlucosa]           = useState('')
  
  const [firmaPaciente, setFirmaPaciente] = useState<string | null>(null)
  const [firmaMedico, setFirmaMedico]     = useState<string | null>(null)

  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Auto-Login (Caché) ──────────────────────────────────────────────────
  useEffect(() => {
    const cachedPin = localStorage.getItem(`smart_tow_doc_${token}`)
    if (cachedPin && cachedPin.length === 4) {
      setPin(cachedPin.split(''))
      verifyPinRequest(cachedPin)
    }
  }, [token])

  // ── PIN verification ────────────────────────────────────────────────────
  async function handleVerifyPin() {
    const fullPin = pin.join('')
    if (fullPin.length < 4) return
    verifyPinRequest(fullPin)
  }

  async function verifyPinRequest(fullPin: string) {
    setVerifying(true)
    setPinError('')

    let data;
    try {
      const res = await fetch('/api/medical/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin: fullPin }),
      })
      
      const isJson = res.headers.get('content-type')?.includes('application/json')
      if (!isJson) {
        throw new Error(`Error en el servidor (${res.status}). Intenta nuevamente.`)
      }
      
      data = await res.json()
      setVerifying(false)

      if (!res.ok || data.error) {
        // Falló el login: Borramos caché
        localStorage.removeItem(`smart_tow_doc_${token}`)
        
        if (res.status === 403 && (data.error?.includes('expirado') || data.error?.includes('concluido'))) {
          setPhase('expired')
        } else {
          setPinError(data.error || 'PIN incorrecto o hubo un error.')
          setPin(['','','',''])
          pinRefs[0].current?.focus()
        }
        return
      }
    } catch (err: any) {
      setVerifying(false)
      setPinError(err.message || 'Error de conexión. Revisa tu internet.')
      setPin(['','','',''])
      pinRefs[0].current?.focus()
      return
    }

    setService(data.service)
    setAuthHeader(`Bearer ${token}:${fullPin}`)
    localStorage.setItem(`smart_tow_doc_${token}`, fullPin)

    // Pre-fill form if doctor already saved data
    if (data.service.diagnostico)  setDiagnostico(data.service.diagnostico)
    if (data.service.tratamiento)  setTratamiento(data.service.tratamiento)
    if (data.service.medicamento_recetado) setMedicamento(data.service.medicamento_recetado)
    if (data.service.notas_medico) setNotas(data.service.notas_medico)
    if (data.service.anamnesis) setAnamnesis(data.service.anamnesis)
    if (data.service.exploracion_fisica) setExploracion(data.service.exploracion_fisica)
    if (data.service.patient_weight) setPeso(data.service.patient_weight.toString())
    if (data.service.patient_height) setTalla(data.service.patient_height.toString())
    if (data.service.firma_paciente_url) setFirmaPaciente(data.service.firma_paciente_url)
    if (data.service.firma_medico_url) setFirmaMedico(data.service.firma_medico_url)
    
    if (data.service.signos_vitales) {
      const sv = data.service.signos_vitales
      setPresion(sv.presion ?? ''); setPulso(sv.pulso ?? ''); setTemperatura(sv.temperatura ?? '')
      setFrecResp(sv.frecResp ?? ''); setSpO2(sv.spO2 ?? ''); setGlucosa(sv.glucosa ?? '')
    }

    setPhase('service')
    startGPS(`Bearer ${token}:${fullPin}`)
  }

  // ── GPS tracking ────────────────────────────────────────────────────────
  function startGPS(auth: string) {
    if (!navigator.geolocation) return
    setGpsActive(true)
    const sendGPS = () => {
      navigator.geolocation.getCurrentPosition(pos => {
        fetch('/api/medical/doctor-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': auth },
          body: JSON.stringify({ action: 'update_gps', lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => {})
      }, () => {}, { enableHighAccuracy: true })
    }
    sendGPS()
    gpsIntervalRef.current = setInterval(sendGPS, 15000)
  }

  useEffect(() => () => { if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current) }, [])

  // ── Avanzar status ──────────────────────────────────────────────────────
  async function advanceStatus() {
    if (!service) return
    const next = NEXT_STATUS[service.service_type]?.[service.status]
    if (!next) return
    
    if (next === 'concluido') {
      if (!service.firma_medico_url || !service.firma_paciente_url) {
        alert('Debes recolectar la firma del médico y del paciente antes de poder finalizar el servicio.')
        setActiveSection('form')
        return
      }
    }

    setAdvancing(true)
    const res = await fetch('/api/medical/doctor-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify({ action: 'update_status', newStatus: next }),
    })
    const data = await res.json()
    setAdvancing(false)
    if (data.success) {
      setService((prev: any) => ({ ...prev, status: next }))
      if (next === 'concluido') {
        localStorage.removeItem(`smart_tow_doc_${token}`)
        setPhase('expired') // Link ya no sirve
      } else {
        showSuccess(`✓ ${STATUS_LABELS[next]}`)
      }
    }
  }

  // ── Guardar formulario médico ───────────────────────────────────────────
  async function saveForm() {
    setSaving(true)
    await fetch('/api/medical/doctor-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify({
        action: 'save_form',
        anamnesis: anamnesis || null,
        exploracion_fisica: exploracion || null,
        patient_weight: peso ? parseFloat(peso) : null,
        patient_height: talla ? parseFloat(talla) : null,
        diagnostico, tratamiento, medicamento_recetado: medicamento, notas_medico: notas,
        signos_vitales: (presion || pulso || temperatura || frecResp || spO2 || glucosa)
          ? { 
              presion: presion || null, 
              pulso: pulso || null, 
              temperatura: temperatura || null,
              frecResp: frecResp || null,
              spO2: spO2 || null,
              glucosa: glucosa || null
            }
          : null,
      }),
    })
    setSaving(false)
    showSuccess('✓ Formulario guardado')
  }

  // ── Guardar Firma ────────────────────────────────────────────────────────
  async function saveSignature(dataUrl: string, type: 'medico' | 'paciente') {
    setSaving(true)
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const filename = `medical/${service.id}/firma_${type}_${Date.now()}.png`
      const formData = new FormData()
      formData.append('file', blob)
      
      const uploadRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/evidence/${filename}`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` }, body: formData }
      )
      
      if (uploadRes.ok) {
        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidence/${filename}`
        await fetch('/api/medical/doctor-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify({ action: 'save_signature', signatureUrl: publicUrl, type })
        })
        if (type === 'medico') setFirmaMedico(publicUrl)
        else setFirmaPaciente(publicUrl)
        setService((prev: any) => ({ ...prev, [type === 'medico' ? 'firma_medico_url' : 'firma_paciente_url']: publicUrl }))
        showSuccess(`✓ Firma guardada`)
      }
    } catch(err) { console.error('Error guardando firma', err) }
    setSaving(false)
  }

  // ── Upload foto ──────────────────────────────────────────────────────────
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)

    // Subir directamente a Supabase Storage (bucket: evidence)
    const ext = file.name.split('.').pop()
    const filename = `medical/${service.id}/${Date.now()}.${ext}`

    const formData = new FormData()
    formData.append('file', file)

    // Usamos la API pública de Supabase Storage con anon key
    const uploadRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/evidence/${filename}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: formData,
      }
    )

    if (uploadRes.ok) {
      const photoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidence/${filename}`
      await fetch('/api/medical/doctor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ action: 'add_photo', photoUrl }),
      })
      setService((prev: any) => ({ ...prev, fotos_evidencia: [...(prev.fotos_evidencia ?? []), photoUrl] }))
      showSuccess('✓ Foto subida')
    }
    setPhotoUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 2500)
  }

  // ── Pantalla PIN ──────────────────────────────────────────────────────────
  if (phase === 'pin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Acceso al Servicio</h1>
            <p className="text-slate-500 text-sm mt-1">Ingresa tu PIN de 4 dígitos para continuar</p>
          </div>

          {/* PIN inputs */}
          <div className="flex justify-center gap-3">
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={pinRefs[i]}
                type="number"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => {
                  const val = e.target.value.slice(-1)
                  const newPin = [...pin]
                  newPin[i] = val
                  setPin(newPin)
                  if (val && i < 3) pinRefs[i + 1].current?.focus()
                }}
                onKeyDown={e => {
                  if (e.key === 'Backspace' && !pin[i] && i > 0) pinRefs[i - 1].current?.focus()
                }}
                className="w-14 h-14 text-center text-2xl font-black border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ))}
          </div>

          {pinError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {pinError}
            </div>
          )}

          <button
            onClick={handleVerifyPin}
            disabled={pin.join('').length < 4 || verifying}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black py-4 rounded-2xl text-base transition-colors"
          >
            {verifying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Ingresar →'}
          </button>

          <p className="text-xs text-slate-400">
            SmartTow · Acceso seguro de un solo uso
          </p>
        </div>
      </div>
    )
  }

  // ── Pantalla expirado / concluido ─────────────────────────────────────────
  if (phase === 'expired' || phase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-black text-slate-800">
            {service?.status === 'concluido' ? '¡Servicio Concluido!' : 'Link no disponible'}
          </h2>
          <p className="text-slate-500 text-sm">
            {service?.status === 'concluido'
              ? 'El servicio fue marcado como concluido. Este link ya no está activo. ¡Gracias!'
              : 'Este link ha expirado o fue desactivado. Contacta al despachador para más información.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Vista del servicio ─────────────────────────────────────────────────────
  if (!service) return null

  const cfg = TYPE_CFG[service.service_type] ?? TYPE_CFG.medico_domicilio
  const folio = `${service.folio_prefix}-${String(service.folio).padStart(4, '0')}`
  const nextStatus = NEXT_STATUS[service.service_type]?.[service.status]
  const isClosed = ['concluido','cancelado'].includes(service.status)
  const showForm = service.service_type !== 'reparto_medicamento' && ['en_consulta','concluido'].includes(service.status)

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Success toast */}
      {successMsg && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background:'rgba(16,185,129,0.95)', color:'white', fontWeight:700, fontSize:14,
          padding:'10px 20px', borderRadius:12, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,0.3)' }}>
          {successMsg}
        </div>
      )}

      {/* Header */}
      <div className={`${cfg.bg} text-white px-4 pt-safe pt-6 pb-4 safe-top`} style={{ background: cfg.bg.replace('bg-', '') }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              {cfg.icon}
            </div>
            <div>
              <p className="font-black text-white text-lg">{folio}</p>
              <p className="text-white/80 text-sm">{cfg.label}</p>
            </div>
            {gpsActive && (
              <div className="ml-auto flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                <Activity className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-bold">GPS</span>
              </div>
            )}
          </div>

          {/* Status badge */}
          <div className="bg-white/20 rounded-2xl px-4 py-3">
            <p className="text-white/70 text-xs uppercase tracking-wide font-semibold mb-1">Estado actual</p>
            <p className="text-white font-black text-lg">{STATUS_LABELS[service.status] ?? service.status}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-10">

        {/* Datos del paciente */}
        <Card>
          <CardHeader icon={<User className="w-4 h-4" />} title="Paciente" />
          <div className="p-4 space-y-2 text-sm">
            <p className="font-bold text-slate-800 text-base">{service.patient_name}</p>
            {service.patient_phone && (
              <a href={`tel:${service.patient_phone}`} className="flex items-center gap-2 text-emerald-600 font-semibold">
                <Phone className="w-4 h-4" /> {service.patient_phone}
              </a>
            )}
            {service.patient_address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(service.patient_address)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2 text-blue-600 font-semibold"
              >
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{service.patient_address}</span>
              </a>
            )}
            {service.symptoms && (
              <div className="bg-slate-50 rounded-xl p-3 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Motivo / Síntomas</p>
                <p className="text-slate-700">{service.symptoms}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Botón avance de status */}
        {!isClosed && nextStatus && (
          <button
            onClick={advanceStatus}
            disabled={advancing}
            className={`w-full flex items-center justify-center gap-3 ${cfg.bg} text-white font-black py-5 rounded-2xl text-base shadow-lg active:scale-95 transition-transform disabled:opacity-60`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {advancing
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><ChevronRight className="w-5 h-5" /> {NEXT_LABELS[nextStatus] ?? STATUS_LABELS[nextStatus]}</>
            }
          </button>
        )}

        {isClosed && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="font-bold text-green-800">Servicio finalizado</p>
            <p className="text-green-600 text-sm mb-4">Gracias por tu atención.</p>

            <a 
              href={`/doc/${token}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white border border-green-300 text-green-700 font-bold py-2.5 px-6 rounded-xl shadow-sm hover:bg-green-50 transition-colors"
            >
              <FileText className="w-4 h-4" /> Imprimir Receta / PDF
            </a>
          </div>
        )}

        {/* Tabs: formulario / fotos */}
        {(showForm || !isClosed) && (
          <div className="flex gap-1 bg-slate-200 rounded-2xl p-1">
            {!isClosed && (
              <TabBtn active={activeSection === 'status'} onClick={() => setActiveSection('status')}>Estado</TabBtn>
            )}
            {showForm && (
              <TabBtn active={activeSection === 'form'} onClick={() => setActiveSection('form')}>
                <FileText className="w-3.5 h-3.5" /> Formulario
              </TabBtn>
            )}
            <TabBtn active={activeSection === 'photos'} onClick={() => setActiveSection('photos')}>
              <Camera className="w-3.5 h-3.5" /> Fotos
            </TabBtn>
          </div>
        )}

        {/* Formulario médico */}
        {activeSection === 'form' && showForm && (
          <Card>
            <CardHeader icon={<FileText className="w-4 h-4" />} title="Formulario Médico" />
            <div className="p-4 space-y-4">
              <FormField label="Motivo de Consulta (Anamnesis)" value={anamnesis} onChange={setAnamnesis} multiline />
              <FormField label="Exploración Física" value={exploracion} onChange={setExploracion} multiline />

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Antropometría</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Peso (kg)</label>
                    <input type="number" step="0.1" value={peso} onChange={e => setPeso(e.target.value)} placeholder="Ej: 75.5"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Talla (m)</label>
                    <input type="number" step="0.01" value={talla} onChange={e => setTalla(e.target.value)} placeholder="Ej: 1.75"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">IMC</label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 font-semibold flex items-center h-[38px]">
                      {peso && talla && parseFloat(talla) > 0 ? (parseFloat(peso) / Math.pow(parseFloat(talla), 2)).toFixed(2) : '--'}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Signos Vitales</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Presión (T/A)</label>
                    <input value={presion} onChange={e => setPresion(e.target.value)} placeholder="120/80" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Frec. Cardíaca</label>
                    <input value={pulso} onChange={e => setPulso(e.target.value)} placeholder="72 lpm" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Frec. Respiratoria</label>
                    <input value={frecResp} onChange={e => setFrecResp(e.target.value)} placeholder="16 rpm" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Temp. (°C)</label>
                    <input type="number" step="0.1" value={temperatura} onChange={e => setTemperatura(e.target.value)} placeholder="36.5" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">SpO2 (%)</label>
                    <input type="number" value={spO2} onChange={e => setSpO2(e.target.value)} placeholder="98" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Glucosa (Opc)</label>
                    <input value={glucosa} onChange={e => setGlucosa(e.target.value)} placeholder="95 mg/dL" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                </div>
              </div>

              <FormField label="Diagnóstico" value={diagnostico} onChange={setDiagnostico} multiline />
              <FormField label="Tratamiento indicado" value={tratamiento} onChange={setTratamiento} multiline />
              <FormField label="Medicamento recetado" value={medicamento} onChange={setMedicamento} multiline />

              <FormField label="Observaciones del médico" value={notas} onChange={setNotas} multiline />

              <div className="border-t border-slate-200 pt-4 space-y-4">
                <SignaturePad 
                  label="Firma del Médico *" 
                  onSave={(dataUrl) => saveSignature(dataUrl, 'medico')}
                  initialUrl={firmaMedico || undefined}
                  disabled={!!firmaMedico || isClosed}
                />
                <SignaturePad 
                  label="Firma del Paciente / Responsable *" 
                  onSave={(dataUrl) => saveSignature(dataUrl, 'paciente')}
                  initialUrl={firmaPaciente || undefined}
                  disabled={!!firmaPaciente || isClosed}
                />
              </div>

              <button
                onClick={saveForm}
                disabled={saving || isClosed}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors shadow-md active:scale-[0.98]"
              >
                {saving ? 'Guardando...' : '✓ Guardar Clínica'}
              </button>
            </div>
          </Card>
        )}

        {/* Fotos de evidencia */}
        {activeSection === 'photos' && (
          <Card>
            <CardHeader icon={<Camera className="w-4 h-4" />} title="Fotos de Evidencia" />
            <div className="p-4 space-y-4">
              {!isClosed && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                    className="hidden" onChange={handlePhotoUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                    className="w-full border-2 border-dashed border-emerald-300 rounded-2xl py-8 flex flex-col items-center gap-2 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                  >
                    {photoUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                    <span className="font-semibold text-sm">{photoUploading ? 'Subiendo...' : 'Tomar o elegir foto'}</span>
                  </button>
                </>
              )}

              {service.fotos_evidencia && service.fotos_evidencia.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {service.fotos_evidencia.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                      <img src={url} alt={`Foto ${i+1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 text-sm py-2">Sin fotos aún.</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// ── UI Helpers ────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">{children}</div>
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
      <span className="text-slate-500">{icon}</span>
      <span className="font-bold text-sm text-slate-700 uppercase tracking-wide">{title}</span>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
      active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
    }`}>
      {children}
    </button>
  )
}

function FormField({ label, value, onChange, multiline }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
        : <input value={value} onChange={e => onChange(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      }
    </div>
  )
}
