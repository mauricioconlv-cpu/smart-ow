'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Stethoscope, Package, Video, ArrowLeft, ArrowRight, Plus,
  User, Phone, MapPin, ClipboardList, DollarSign, Calendar,
  CheckCircle2, Copy, Share2, ChevronDown, ChevronUp
} from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────────
type ServiceType = 'medico_domicilio' | 'reparto_medicamento' | 'telemedicina'

const SERVICE_TYPES = [
  {
    key: 'medico_domicilio' as ServiceType,
    label: 'Médico a Domicilio',
    desc: 'Un médico se traslada al domicilio del paciente para consulta presencial.',
    icon: Stethoscope,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    activeBg: 'bg-emerald-600',
  },
  {
    key: 'reparto_medicamento' as ServiceType,
    label: 'Reparto de Medicamento',
    desc: 'Entrega de medicamentos a domicilio directamente desde farmacia.',
    icon: Package,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    activeBg: 'bg-blue-600',
  },
  {
    key: 'telemedicina' as ServiceType,
    label: 'Telemedicina',
    desc: 'Consulta médica en línea. Sin desplazamiento, solo seguimiento y control de costos.',
    icon: Video,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    activeBg: 'bg-violet-600',
  },
]

// ── Componente Principal ────────────────────────────────────────────────────
export default function NewMedicalServicePage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [serviceType, setServiceType] = useState<ServiceType | null>(null)

  // Step 2 fields — comunes
  const [patientName, setPatientName]     = useState('')
  const [patientPhone, setPatientPhone]   = useState('')
  const [patientAddress, setPatientAddress] = useState('')
  const [symptoms, setSymptoms]           = useState('')
  const [aseguradora, setAseguradora]     = useState('')
  const [expediente, setExpediente]       = useState('')
  const [scheduledAt, setScheduledAt]     = useState('')
  const [cobroCliente, setCobroCliente]   = useState('')

  // Costos internos (solo admin/superadmin verán esto en la UI de detalle)
  const [costoPago, setCostoPago]         = useState('')  // costo_pago_proveedor
  const [costoMedicamento, setCostoMedicamento] = useState('')
  const [costoEnvio, setCostoEnvio]       = useState('')
  const [costoConsulta, setCostoConsulta] = useState('')

  // Doctor
  const [providers, setProviders]         = useState<any[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [showNewDoctor, setShowNewDoctor]  = useState(false)
  const [doctorName, setDoctorName]       = useState('')
  const [doctorCedula, setDoctorCedula]   = useState('')
  const [doctorPhone, setDoctorPhone]     = useState('')
  const [doctorSpecialty, setDoctorSpecialty] = useState('Medicina General')

  // Estado final
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [result, setResult]               = useState<{ folio: string; link: string; pin: string } | null>(null)
  const [error, setError]                 = useState('')
  const [copied, setCopied]               = useState<'link'|'pin'|null>(null)

  // Cargar directorio de médicos
  useEffect(() => {
    supabase
      .from('medical_providers')
      .select('id, full_name, specialty, phone')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => { if (data) setProviders(data) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCfg = SERVICE_TYPES.find(t => t.key === serviceType)

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!serviceType || !patientName.trim()) return
    setIsSubmitting(true)
    setError('')

    const res = await fetch('/api/medical/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType,
        patientName:    patientName.trim(),
        patientPhone:   patientPhone.trim(),
        patientAddress: patientAddress.trim(),
        symptoms:       symptoms.trim(),
        aseguradora:    aseguradora.trim(),
        expediente:     expediente.trim(),
        scheduledAt:    scheduledAt || null,
        cobroCliente:   parseFloat(cobroCliente) || 0,
        costoPago:      parseFloat(costoPago) || 0,
        costoMedicamento: parseFloat(costoMedicamento) || 0,
        costoEnvio:     parseFloat(costoEnvio) || 0,
        costoConsulta:  parseFloat(costoConsulta) || 0,
        // Doctor: si se registró uno nuevo o se seleccionó uno existente
        providerId:     selectedProvider || null,
        newDoctor:      showNewDoctor && doctorName ? {
          full_name: doctorName.trim(),
          cedula:    doctorCedula.trim(),
          phone:     doctorPhone.trim(),
          specialty: doctorSpecialty,
          service_types: [serviceType],
        } : null,
      }),
    })

    const data = await res.json()
    setIsSubmitting(false)

    if (!res.ok || data.error) {
      setError(data.error || 'Error al crear el servicio.')
      return
    }

    setResult(data) // { folio, link, pin }
  }

  // ── Pantalla de Resultado ─────────────────────────────────────────────────
  if (result) {
    const whatsappMsg = encodeURIComponent(
      `Hola Dr. ${doctorName || ''},\n\nSe le ha asignado el servicio *${result.folio}*.\n\nAcceda desde este link:\n${result.link}\n\nSu PIN de acceso es: *${result.pin}*\n\nEl link expirará al concluir el servicio.`
    )
    return (
      <div className="max-w-lg mx-auto mt-8 space-y-5">
        <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">¡Servicio Creado!</h2>
          <p className="text-slate-500 text-sm mb-6">Folio: <strong className="text-slate-800">{result.folio}</strong></p>

          {/* Link */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3 text-left">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Link del Doctor</p>
            <p className="text-sm font-mono text-slate-700 break-all mb-3">{result.link}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(result.link); setCopied('link'); setTimeout(() => setCopied(null), 2000) }}
              className="flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              <Copy className="w-4 h-4" />
              {copied === 'link' ? '¡Copiado!' : 'Copiar link'}
            </button>
          </div>

          {/* PIN */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-left">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">PIN de acceso (4 dígitos)</p>
            <p className="text-4xl font-black text-amber-800 tracking-widest mb-2">{result.pin}</p>
            <p className="text-xs text-amber-600">Envía este PIN al doctor por teléfono o WhatsApp, separado del link.</p>
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <a
              href={`https://wa.me/?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              <Share2 className="w-4 h-4" />
              Enviar por WhatsApp
            </a>
            <button
              onClick={() => router.push('/dashboard/medical')}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              Ver Servicios
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 1: Selección de tipo ─────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="max-w-2xl mx-auto mt-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Nuevo Servicio Médico</h2>
            <p className="text-sm text-slate-500">Paso 1 de 2 — Selecciona el tipo de servicio</p>
          </div>
        </div>

        <div className="grid gap-4">
          {SERVICE_TYPES.map(t => {
            const Icon = t.icon
            const isSelected = serviceType === t.key
            return (
              <button
                key={t.key}
                onClick={() => setServiceType(t.key)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? `${t.border} bg-white shadow-md ring-2 ring-offset-1 ${t.border.replace('border-', 'ring-')}`
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${isSelected ? t.activeBg : t.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : t.color}`} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-base">{t.label}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{t.desc}</p>
                  </div>
                  {isSelected && (
                    <div className="ml-auto shrink-0">
                      <CheckCircle2 className={`w-6 h-6 ${t.color}`} />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end">
          <button
            disabled={!serviceType}
            onClick={() => setStep(2)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: Formulario de datos ───────────────────────────────────────────
  const typeCfg = selectedCfg!
  const TypeIcon = typeCfg.icon

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setStep(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${typeCfg.activeBg} flex items-center justify-center`}>
            <TypeIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{typeCfg.label}</h2>
            <p className="text-sm text-slate-500">Paso 2 de 2 — Datos del servicio</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Sección: Paciente */}
      <Section title="Datos del Paciente" icon={<User className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nombre del Paciente *</Label>
            <Input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="55XXXXXXXX" type="tel" />
          </div>
          <div>
            <Label>No. Expediente</Label>
            <Input value={expediente} onChange={e => setExpediente(e.target.value)} placeholder="Exp-001" />
          </div>
          {serviceType !== 'telemedicina' && (
            <div className="col-span-2">
              <Label>Dirección del Paciente</Label>
              <Input value={patientAddress} onChange={e => setPatientAddress(e.target.value)} placeholder="Calle, Colonia, Ciudad" />
            </div>
          )}
          <div className="col-span-2">
            <Label>{serviceType === 'reparto_medicamento' ? 'Medicamentos solicitados' : 'Síntomas / Motivo de consulta'}</Label>
            <textarea
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              rows={3}
              placeholder={serviceType === 'reparto_medicamento' ? 'Ej: Paracetamol 500mg x20, Ibuprofeno...' : 'Describe los síntomas'}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
            />
          </div>
          <div>
            <Label>Aseguradora (opcional)</Label>
            <Input value={aseguradora} onChange={e => setAseguradora(e.target.value)} placeholder="Ej: AXA Seguros" />
          </div>
          <div>
            <Label>Fecha / Hora de Cita</Label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>
      </Section>

      {/* Sección: Doctor / Proveedor */}
      <Section title="Doctor / Proveedor Asignado" icon={<User className="w-4 h-4" />}>
        {!showNewDoctor ? (
          <div className="space-y-3">
            <div>
              <Label>Seleccionar del directorio</Label>
              <select
                value={selectedProvider}
                onChange={e => setSelectedProvider(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">-- Sin asignar --</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} — {p.specialty}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => { setShowNewDoctor(true); setSelectedProvider('') }}
              className="flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              <Plus className="w-4 h-4" /> Registrar nuevo doctor
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nombre completo *</Label>
                <Input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Juan Pérez" />
              </div>
              <div>
                <Label>Cédula Profesional</Label>
                <Input value={doctorCedula} onChange={e => setDoctorCedula(e.target.value)} placeholder="12345678" />
              </div>
              <div>
                <Label>Teléfono *</Label>
                <Input value={doctorPhone} onChange={e => setDoctorPhone(e.target.value)} placeholder="55XXXXXXXX" type="tel" />
              </div>
              <div className="col-span-2">
                <Label>Especialidad</Label>
                <Input value={doctorSpecialty} onChange={e => setDoctorSpecialty(e.target.value)} placeholder="Medicina General" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNewDoctor(false)}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ChevronUp className="w-4 h-4" /> Seleccionar del directorio mejor
            </button>
          </div>
        )}
      </Section>

      {/* Sección: Costos */}
      <Section title="Costos del Servicio" icon={<DollarSign className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-3">
          {/* Costo interno al proveedor */}
          <div>
            <Label>Pago al proveedor (interno)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number" min="0" step="0.01"
                value={costoPago}
                onChange={e => setCostoPago(e.target.value)}
                placeholder="0.00"
                className="w-full border border-amber-300 bg-amber-50 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
            <p className="text-xs text-amber-600 mt-0.5">Solo visible para admin y supervisor</p>
          </div>

          {/* Cobro al cliente */}
          <div>
            <Label>Cobro al cliente / aseguradora</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number" min="0" step="0.01"
                value={cobroCliente}
                onChange={e => setCobroCliente(e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Campos específicos por tipo */}
          {serviceType === 'reparto_medicamento' && (
            <>
              <div>
                <Label>Costo medicamentos (farmacia)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={costoMedicamento} onChange={e => setCostoMedicamento(e.target.value)} placeholder="0.00"
                    className="w-full border border-amber-300 bg-amber-50 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-amber-400 outline-none" />
                </div>
              </div>
              <div>
                <Label>Costo de envío</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={costoEnvio} onChange={e => setCostoEnvio(e.target.value)} placeholder="0.00"
                    className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
            </>
          )}
          {(serviceType === 'medico_domicilio' || serviceType === 'telemedicina') && (
            <div>
              <Label>Costo de consulta</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={costoConsulta} onChange={e => setCostoConsulta(e.target.value)} placeholder="0.00"
                  className="w-full border border-amber-300 bg-amber-50 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-amber-400 outline-none" />
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Botón submit */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-5 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          disabled={!patientName.trim() || isSubmitting}
          onClick={handleSubmit}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          {isSubmitting ? 'Creando...' : <><CheckCircle2 className="w-4 h-4" /> Crear Servicio y Generar Link</>}
        </button>
      </div>
    </div>
  )
}

// ── Helpers de UI ─────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50">
        <span className="text-slate-500">{icon}</span>
        <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{children}</label>
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
    />
  )
}
