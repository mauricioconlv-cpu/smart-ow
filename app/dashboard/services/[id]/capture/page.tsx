'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  User, Phone, FileText, Car, Wrench, MapPin, Package,
  Loader2, ArrowLeft, Save, X, Upload, XCircle, Lock, Unlock,
  Clock, AlertTriangle, CheckCircle2, BookOpen
} from 'lucide-react'
import { unlockWithReason, closeService } from './actions'
import ServiceLog from '../components/ServiceLog'
import DispatcherMessageBar from '../components/DispatcherMessageBar'
import EvidencePhotosPanel from '../components/EvidencePhotosPanel'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Catálogos ───────────────────────────────────────────────
const YEARS  = Array.from({ length: 2028 - 1990 + 1 }, (_, i) => 2028 - i)
const BRANDS = ['Chevrolet','Nissan','Volkswagen','Toyota','Ford','Honda','Hyundai','Kia','Mazda','Dodge','Jeep','Audi','BMW','Mercedes-Benz','Renault']
const COLORS = ['Blanco','Negro','Gris / Plata','Rojo','Azul','Verde','Amarillo','Naranja','Café / Beige','Otro']
const ESTADOS = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas'
]

async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'es' } }
    )
    const data = await res.json()
    const a = data.address || {}

    // Para CDMX, Nominatim devuelve a.city = 'Ciudad de México' para todos.
    // La alcaldía (Cuauhtémoc, Benito Juárez, etc.) viene en city_district o suburb.
    // Para el resto del país, usamos city, town o county.
    const isCDMX = (a.state || '').toLowerCase().includes('ciudad de méxico') ||
                   (a.state || '').toLowerCase().includes('cdmx')

    let municipality = ''
    if (isCDMX) {
      // Alcaldía real para CDMX
      municipality = a.city_district ?? a.borough ?? a.suburb ?? a.county ?? 'Ciudad de México'
    } else {
      municipality = a.city ?? a.town ?? a.municipality ?? a.county ?? a.state_district ?? ''
    }

    return {
      state: a.state ?? '',
      municipality,
      colonia: a.suburb ?? a.neighbourhood ?? a.quarter ?? '',
      street: a.road ?? a.pedestrian ?? ''
    }
  } catch { return null }
}

function matchEstado(name: string) {
  const n = name.toLowerCase()
  return ESTADOS.find(e => e.toLowerCase().includes(n) || n.includes(e.toLowerCase())) ?? name
}

// ─── Small UI helpers ─────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color = 'text-blue-600' }: any) {
  return (
    <div className={`flex items-center gap-2 pb-2 border-b border-slate-200 mb-5 ${color}`}>
      <Icon className="w-5 h-5" />
      <h3 className="font-bold text-base text-slate-800">{title}</h3>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inputCls  = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder:text-slate-400"
const inputROCls = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 cursor-not-allowed"
const selectCls  = inputCls
const selectROCls = inputROCls

function YesNo({ label, value, onChange, readOnly }: { label: string; value: boolean | null; onChange: (v: boolean) => void; readOnly: boolean }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 mt-1">
        {([true, false] as const).map(opt => (
          <button key={String(opt)} type="button"
            onClick={() => !readOnly && onChange(opt)}
            disabled={readOnly}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition ${
              value === opt
                ? opt ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                : readOnly ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}>
            {opt ? '✓ Sí' : '✗ No'}
          </button>
        ))}
      </div>
    </Field>
  )
}

function PhotoUploader({ label, photos, onAdd, onRemove, readOnly }: {
  label: string; photos: string[]; onAdd: (files: File[]) => void; onRemove: (i: number) => void; readOnly: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAdd(Array.from(e.target.files ?? []))
    e.target.value = ''
  }
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
      {!readOnly && (
        <>
          <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
          <button type="button" onClick={() => ref.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 transition">
            <Upload className="w-4 h-4" /> Subir Fotos
          </button>
        </>
      )}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {photos.map((url, i) => (
            <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              {!readOnly && (
                <button onClick={() => onRemove(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Reading mode display ─────────────────────────────────────
function ReadValue({ value }: { value: any }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400 italic text-sm">Sin registrar</span>
  }
  if (typeof value === 'boolean') {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{value ? 'Sí' : 'No'}</span>
  }
  return <span className="text-sm text-slate-800">{String(value)}</span>
}

// ─── Main ─────────────────────────────────────────────────────
export default function ServiceCapturePage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [service, setService] = useState<any>(null)
  const [isSaving, setIsSaving]   = useState(false)
  const [saveErr, setSaveErr]     = useState('')
  const [isGeoLoading, setIsGeoLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasData, setHasData] = useState(false)

  // Modal de desbloqueo
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [unlockReason, setUnlockReason] = useState('')
  const [isUnlocking, startUnlock] = useTransition()
  const [isClosing, startClose] = useTransition()

  // Countdown para cotización (20 min)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cotVencida, setCotVencida] = useState(false)
  const notifiedRef = useRef(false)

  // Photos state
  const [contactPhotos,  setContactPhotos]  = useState<File[]>([])
  const [contactUrls,    setContactUrls]    = useState<string[]>([])
  const [damagePhotos,   setDamagePhotos]   = useState<File[]>([])
  const [damageUrls,     setDamageUrls]     = useState<string[]>([])

  const addPhotos = (setter: any, urlSetter: any) => (files: File[]) => {
    setter((p: File[]) => [...p, ...files])
    files.forEach(f => {
      const r = new FileReader()
      r.onload = ev => urlSetter((p: string[]) => [...p, ev.target?.result as string])
      r.readAsDataURL(f)
    })
  }
  const removePhoto = (setter: any, urlSetter: any) => (i: number) => {
    setter((p: any[]) => p.filter((_: any, idx: number) => idx !== i))
    urlSetter((p: any[]) => p.filter((_: any, idx: number) => idx !== i))
  }

  // ── Contacto ──
  const [contactName,       setContactName]       = useState('')
  const [contactPhone,      setContactPhone]       = useState('')
  const [insuranceContact,  setInsuranceContact]   = useState('')
  const [insuranceFolio,    setInsuranceFolio]     = useState('')

  // ── Motivo ──
  const [serviceReason,   setServiceReason]   = useState<'siniestro'|'asistencia'|''>('')
  const [assistanceType,  setAssistanceType]  = useState<'mecanica'|'electrica'|''>('')
  const [assistanceNotes, setAssistanceNotes] = useState('')
  const [adjusterPresent,     setAdjusterPresent]     = useState<boolean|null>(null)
  const [causedDamage,        setCausedDamage]         = useState<boolean|null>(null)
  const [authorityIntervened, setAuthorityIntervened]  = useState<boolean|null>(null)
  const [vehicleDamageDesc,   setVehicleDamageDesc]    = useState('')

  // ── Vehículo ──
  const [vehicleYear,   setVehicleYear]   = useState('')
  const [vehicleBrand,  setVehicleBrand]  = useState('')
  const [vehicleType,   setVehicleType]   = useState('')
  const [vehiclePlates, setVehiclePlates] = useState('')
  const [vehicleColor,  setVehicleColor]  = useState('')

  // ── Maniobras ──
  const [neutral,          setNeutral]          = useState<boolean|null>(null)
  const [transmissionType, setTransmissionType] = useState<'estandar'|'automatico'|''>('')
  const [wheelsSpin,       setWheelsSpin]       = useState<boolean|null>(null)
  const [steeringSpin,     setSteeringSpin]     = useState<boolean|null>(null)
  const [vehicleAt,        setVehicleAt]        = useState<'calle'|'garage'|''>('')
  const [parkingType,      setParkingType]      = useState<'techado'|'aire_libre'|''>('')
  const [parkingNotes,     setParkingNotes]     = useState('')

  // ── Origen ──
  const [originState,        setOriginState]        = useState('')
  const [originMunicipality, setOriginMunicipality] = useState('')
  const [originColonia,      setOriginColonia]      = useState('')
  const [originStreet,       setOriginStreet]       = useState('')
  const [originCrossStreets, setOriginCrossStreets] = useState('')
  const [originReferences,   setOriginReferences]   = useState('')

  // ── Destino ──
  const [destinationType,     setDestinationType]     = useState<'agencia'|'taller'|'domicilio'|''>('')
  const [travelsInventory,    setTravelsInventory]    = useState<boolean|null>(null)
  const [destinationReceiver, setDestinationReceiver] = useState('')
  const [destState,         setDestState]         = useState('')
  const [destMunicipality,  setDestMunicipality]  = useState('')
  const [destColonia,       setDestColonia]        = useState('')
  const [destStreet,        setDestStreet]         = useState('')
  const [destCrossStreets,  setDestCrossStreets]   = useState('')
  const [destReferences,    setDestReferences]     = useState('')

  // ── Asistencia Específica ──
  const [birloSeguridad,    setBirloSeguridad]    = useState<boolean|null>(null)
  const [llantaRefaccion,   setLlantaRefaccion]   = useState<boolean|null>(null)
  const [asistenciaObs,     setAsistenciaObs]     = useState('')
  const [tipoCombustible,   setTipoCombustible]   = useState<'magna'|'premium'|'diesel'|''>('')
  const [litros,            setLitros]            = useState<number|1>({} as any) // handled naturally
  const [pagoCombustible,   setPagoCombustible]   = useState<'usuario'|'cliente'|''>('')

  // ── Cargar servicio ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('services')
        .select('*, clients(name)')
        .eq('id', id)
        .single()
      if (!data) return
      setService(data)

      // ── Poblar estados con datos guardados ──
      if (data.contact_name || data.service_reason || data.vehicle_brand) {
        setHasData(true)
        setIsEditing(false) // modo lectura si ya tiene datos
      } else {
        setIsEditing(true) // modo edición si es nuevo
      }

      setContactName(data.contact_name || '')
      setContactPhone(data.contact_phone || '')
      setInsuranceContact(data.insurance_contact || '')
      // Si ya tiene insurance_folio guardado úsalo, si no pre-llenar con numero_expediente del paso anterior
      setInsuranceFolio(data.insurance_folio || data.numero_expediente || '')

      setServiceReason(data.service_reason || '')
      setAssistanceType(data.assistance_type || '')
      setAssistanceNotes(data.assistance_notes || '')
      setAdjusterPresent(data.adjuster_present ?? null)
      setCausedDamage(data.caused_damage ?? null)
      setAuthorityIntervened(data.authority_intervened ?? null)
      setVehicleDamageDesc(data.vehicle_damage_desc || '')

      setVehicleYear(data.vehicle_year ? String(data.vehicle_year) : '')
      setVehicleBrand(data.vehicle_brand || '')
      setVehicleType(data.vehicle_type || '')
      setVehiclePlates(data.vehicle_plates || '')
      setVehicleColor(data.vehicle_color || '')

      setNeutral(data.maneuver_neutral ?? null)
      setTransmissionType(data.transmission_type || '')
      setWheelsSpin(data.wheels_spin ?? null)
      setSteeringSpin(data.steering_spins ?? null)
      setVehicleAt(data.vehicle_at || '')
      setParkingType(data.parking_type || '')
      setParkingNotes(data.parking_notes || '')

      setOriginState(data.origin_state || '')
      setOriginMunicipality(data.origin_municipality || '')
      setOriginColonia(data.origin_colonia || '')
      setOriginStreet(data.origin_street || '')
      setOriginCrossStreets(data.origin_cross_streets || '')
      setOriginReferences(data.origin_references || '')

      setDestinationType(data.destination_type || '')
      setTravelsInventory(data.travels_inventory ?? null)
      setDestinationReceiver(data.destination_receiver || '')
      setDestState(data.dest_state || '')
      setDestMunicipality(data.dest_municipality || '')
      setDestColonia(data.dest_colonia || '')
      setDestStreet(data.dest_street || '')
      setDestCrossStreets(data.dest_cross_streets || '')
      setDestReferences(data.dest_references || '')

      setBirloSeguridad(data.asistencia_birlo_seguridad ?? null)
      setLlantaRefaccion(data.asistencia_llanta_refaccion ?? null)
      setAsistenciaObs(data.asistencia_observaciones || '')
      setTipoCombustible(data.asistencia_tipo_combustible || '')
      setLitros(data.asistencia_litros ?? null)
      setPagoCombustible(data.asistencia_pago_combustible || '')

      // Auto-geocode origen solo si no hay datos guardados
      if (!data.origin_state) {
        const oc = data.origen_coords
        if (oc?.lat && oc?.lng) {
          setIsGeoLoading(true)
          const geo = await reverseGeocode(oc.lat, oc.lng)
          if (geo) {
            setOriginState(matchEstado(geo.state))
            setOriginMunicipality(geo.municipality)
            setOriginColonia(geo.colonia)
            setOriginStreet(geo.street)
          }
          setIsGeoLoading(false)
        }
      }

      // Si el status es cotizacion, iniciar countdown
      if (data.status === 'cotizacion' && data.updated_at) {
        const updatedMs = new Date(data.updated_at).getTime()
        const LIMIT = 20 * 60 * 1000 // 20 min
        const elapsed = Date.now() - updatedMs
        const remaining = LIMIT - elapsed
        setCountdown(remaining > 0 ? remaining : 0)
        if (remaining <= 0) setCotVencida(true)
      }
      if (!data.dest_state) {
        const dc = data.destino_coords
        if (dc?.lat && dc?.lng) {
          const geo = await reverseGeocode(dc.lat, dc.lng)
          if (geo) {
            setDestState(matchEstado(geo.state))
            setDestMunicipality(geo.municipality)
            setDestColonia(geo.colonia)
            setDestStreet(geo.street)
          }
        }
      }
    }
    load()
  }, [id])

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      setCotVencida(true)
      if (!notifiedRef.current && typeof window !== 'undefined' && 'Notification' in window) {
        notifiedRef.current = true
        if (Notification.permission === 'granted') {
          new Notification(`⏰ Cotización vencida — Folio #${service?.folio}`, {
            body: 'El tiempo de la cotización expiró. Cierra el expediente. '
          })
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission()
        }
      }
      return
    }
    const t = setTimeout(() => setCountdown(c => (c ?? 0) - 1000), 1000)
    return () => clearTimeout(t)
  }, [countdown, service?.folio])

  const fmtCountdown = (ms: number) => {
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  // ── Upload fotos ────────────────────────────────────────────
  async function uploadSet(files: File[], folder: string) {
    const urls: string[] = []
    for (const file of files) {
      const ext  = file.name.split('.').pop()
      const path = `services/${id}/${folder}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
      if (!error) {
        const { data: pub } = supabase.storage.from('photos').getPublicUrl(path)
        urls.push(pub.publicUrl)
      }
    }
    return urls
  }

  // ── Guardar ─────────────────────────────────────────────────
  async function handleSave(newStatus: 'asignando'|'cotizacion'|'cancelado_momento') {
    setIsSaving(true)
    setSaveErr('')
    try {
      await uploadSet(contactPhotos, 'contact')
      await uploadSet(damagePhotos,  'damage')

      const { error } = await supabase.from('services').update({
        status:               newStatus,
        contact_name:         contactName,
        contact_phone:        contactPhone,
        insurance_contact:    insuranceContact,
        insurance_folio:      insuranceFolio,
        service_reason:       serviceReason,
        assistance_type:      assistanceType  || null,
        assistance_notes:     assistanceNotes || null,
        adjuster_present:     adjusterPresent,
        caused_damage:        causedDamage,
        authority_intervened: authorityIntervened,
        vehicle_damage_desc:  vehicleDamageDesc || null,
        vehicle_year:         vehicleYear ? parseInt(vehicleYear) : null,
        vehicle_brand:        vehicleBrand  || null,
        vehicle_type:         vehicleType   || null,
        vehicle_plates:       vehiclePlates || null,
        vehicle_color:        vehicleColor  || null,
        maneuver_neutral:     neutral,
        transmission_type:    transmissionType || null,
        wheels_spin:          wheelsSpin,
        steering_spins:       steeringSpin,
        vehicle_at:           vehicleAt    || null,
        parking_type:         parkingType  || null,
        parking_notes:        parkingNotes || null,
        origin_state:         originState,
        origin_municipality:  originMunicipality,
        origin_colonia:       originColonia,
        origin_street:        originStreet,
        origin_cross_streets: originCrossStreets || null,
        origin_references:    originReferences   || null,
        destination_type:     destinationType    || null,
        travels_inventory:    travelsInventory,
        viaja_bajo_inventario: travelsInventory === true,
        destination_receiver: destinationReceiver || null,
        dest_state:           destState,
        dest_municipality:    destMunicipality,
        dest_colonia:         destColonia,
        dest_street:          destStreet,
        dest_cross_streets:   destCrossStreets || null,
        dest_references:      destReferences   || null,
        asistencia_birlo_seguridad: birloSeguridad,
        asistencia_llanta_refaccion: llantaRefaccion,
        asistencia_observaciones: asistenciaObs || null,
        asistencia_tipo_combustible: tipoCombustible || null,
        asistencia_litros: litros,
        asistencia_pago_combustible: pagoCombustible || null,
      }).eq('id', id)

      if (error) throw new Error(error.message)

      setIsEditing(false)
      setHasData(true)
      setIsSaving(false)

      // Si se va a asignar grúa, navegar a la pantalla de asignación
      if (newStatus === 'asignando') {
        router.push(`/dashboard/services/${id}/assign`)
        return
      }
    } catch (err: any) {
      setSaveErr(err.message)
      setIsSaving(false)
    }
  }

  // Opciones de motivo de desbloqueo según status
  const EARLY_STATUSES = ['creado','en_captura','sin_operador','cotizacion','asignando']
  const isEarlyStatus = service && EARLY_STATUSES.includes(service.status)
  const unlockOptions = isEarlyStatus
    ? [
        'Usuario cambia de ubicación',
        'Cabina seguro/asistencia dio ubicación incorrecta',
        'Usuario corrige número de teléfono',
        'Usuario corrige número de placas',
        'Usuario cambia lugar de destino',
      ]
    : [
        'Usuario cambia de destino',
        'Usuario no estaba en la ubicación proporcionada',
        'Condiciones del vehículo diferentes (requiere maniobra)',
      ]

  function handleUnlockClick() {
    setUnlockReason('')
    setShowUnlockModal(true)
  }

  function handleConfirmUnlock() {
    if (!unlockReason) return
    startUnlock(async () => {
      await unlockWithReason(id, unlockReason)
      setShowUnlockModal(false)
      setIsEditing(true)
    })
  }

  function handleCloseService(note?: string) {
    startClose(async () => {
      const res = await closeService(id, note)
      if (!res.error) router.push('/dashboard')
    })
  }

  if (!service) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )

  const ro = !isEditing // read-only shorthand
  const isArrastre = service?.categoria_servicio === 'arrastre' || !service?.categoria_servicio

  return (
    <div className="max-w-4xl mx-auto pb-28 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Captura de Servicio</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Folio Interno: <span className="font-bold text-blue-600">#{service.folio}</span>
            {' · '} Cliente: <span className="font-semibold">{service.clients?.name}</span>
          </p>
        </div>
        {/* Indicador de modo */}
        {hasData && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
            ro ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'
          }`}>
            {ro ? <Lock className="w-3.5 h-3.5"/> : <Unlock className="w-3.5 h-3.5"/>}
            {ro ? 'Solo Lectura' : 'Editando'}
          </span>
        )}
      </div>

      {/* Banner solo lectura */}
      {ro && hasData && service.status !== 'cancelado_momento' && service.status !== 'cotizacion' && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <Lock className="w-5 h-5 text-slate-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-slate-600">
              Este servicio ya tiene información guardada. Estás en modo de <strong>solo lectura</strong>.
            </p>
            {service.edit_reason && (
              <p className="text-xs text-amber-700 mt-1 font-medium">Último desbloqueo: {service.edit_reason}</p>
            )}
          </div>
          <button
            onClick={handleUnlockClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-lg transition-colors shrink-0"
          >
            <Unlock className="w-4 h-4" />
            Desbloquear Edición
          </button>
        </div>
      )}

      {/* Banner: Cancelado al Momento */}
      {service.status === 'cancelado_momento' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700">Cancelado al Momento</p>
            <p className="text-xs text-red-500">Revisa la información y cierra el expediente para enviarlo al histórico.</p>
          </div>
          <button
            onClick={() => handleCloseService('Expediente cerrado tras cancelación al momento')}
            disabled={isClosing}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg transition disabled:opacity-50 shrink-0"
          >
            {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Cerrar Expediente
          </button>
        </div>
      )}

      {/* Banner: Cotización con countdown */}
      {service.status === 'cotizacion' && (
        <div className={`flex items-center gap-3 rounded-xl p-4 border ${
          cotVencida ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'
        }`}>
          <Clock className={`w-5 h-5 shrink-0 ${cotVencida ? 'text-red-600' : 'text-amber-600'}`} />
          <div className="flex-1">
            {cotVencida ? (
              <>
                <p className="text-sm font-bold text-red-700">Cotización Vencida</p>
                <p className="text-xs text-red-500">El tiempo de 20 minutos expiró. Cierra el expediente.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-amber-700">Solo Cotización — expira en</p>
                <p className="text-3xl font-black font-mono text-amber-700 mt-0.5">
                  {countdown !== null ? fmtCountdown(countdown) : '--:--'}
                </p>
              </>
            )}
          </div>
          <button
            onClick={() => handleCloseService('Expediente cerrado: solo cotización')}
            disabled={isClosing}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-white font-bold text-sm rounded-lg transition disabled:opacity-50 shrink-0 ${
              cotVencida ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Cerrar Expediente
          </button>
        </div>
      )}

      {/* ── 1. Contacto ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader icon={User} title="Información de Contacto" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre del Usuario / Asegurado">
            {ro
              ? <ReadValue value={contactName} />
              : <input className={inputCls} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Ej. Juan García" />
            }
          </Field>
          <Field label="Teléfono de Contacto">
            {ro
              ? <ReadValue value={contactPhone} />
              : <input className={inputCls} type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="55 1234 5678" />
            }
          </Field>
          <Field label="Ejecutivo / Agente de la Aseguradora">
            {ro
              ? <ReadValue value={insuranceContact} />
              : <input className={inputCls} value={insuranceContact} onChange={e => setInsuranceContact(e.target.value)} placeholder="Ej. María López (AXA)" />
            }
          </Field>
          <Field label="Folio / Expediente Aseguradora">
            {ro
              ? <ReadValue value={insuranceFolio} />
              : <input className={inputCls} value={insuranceFolio} onChange={e => setInsuranceFolio(e.target.value)} placeholder="Ej. EXP-2024-789456" />
            }
          </Field>
        </div>
      </div>

      {/* ── 2. Motivo ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader icon={FileText} title="Motivo del Servicio" color="text-orange-600" />

        {isArrastre ? (
          <Field label="Tipo de Solicitud">
            {ro ? (
              <ReadValue value={serviceReason === 'siniestro' ? '🚨 Siniestro' : serviceReason === 'asistencia' ? '🔧 Asistencia' : null} />
            ) : (
              <div className="flex gap-3 mt-1">
                {([['siniestro','🚨 Siniestro'],['asistencia','🔧 Asistencia']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setServiceReason(v)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 capitalize transition ${
                      serviceReason === v ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                    }`}>{l}</button>
                ))}
              </div>
            )}
          </Field>
        ) : (
          <div className="mb-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Tipo de Solicitud: Asistencia Vial
          </div>
        )}

        {/* SINIESTRO FLOW */}
        {isArrastre && serviceReason === 'siniestro' && (
          <div className="mt-5 space-y-4 pl-4 border-l-4 border-orange-300">
            <YesNo label="¿Ya se encuentra el Ajustador en sitio?" value={adjusterPresent} onChange={setAdjusterPresent} readOnly={ro} />
            <YesNo label="¿Causó daños al asfalto, banquetas o monumentos?" value={causedDamage} onChange={setCausedDamage} readOnly={ro} />
            {causedDamage === true && (
              <div className="pl-4 border-l-4 border-red-200 space-y-4">
                <YesNo label="¿Intervino la Autoridad?" value={authorityIntervened} onChange={setAuthorityIntervened} readOnly={ro} />
              </div>
            )}
            <Field label="Descripción de Daños del Vehículo">
              {ro
                ? <ReadValue value={vehicleDamageDesc} />
                : <textarea className={inputCls} rows={3} value={vehicleDamageDesc} onChange={e => setVehicleDamageDesc(e.target.value)}
                    placeholder="Describe los daños visibles..." />
              }
            </Field>
            <PhotoUploader
              label="Fotos de Daños del Vehículo (Evidencia)"
              photos={damageUrls}
              onAdd={addPhotos(setDamagePhotos, setDamageUrls)}
              onRemove={removePhoto(setDamagePhotos, setDamageUrls)}
              readOnly={ro}
            />
          </div>
        )}

        {/* ASISTENCIA FLOW */}
        {(!isArrastre || serviceReason === 'asistencia') && (
          <div className="mt-5 space-y-4 pl-4 border-l-4 border-amber-300">
            <Field label="Tipo de Falla">
              {ro ? (
                <ReadValue value={assistanceType === 'mecanica' ? '⚙️ Falla Mecánica' : assistanceType === 'electrica' ? '⚡ Falla Eléctrica' : null} />
              ) : (
                <div className="flex gap-3 mt-1">
                  {([['mecanica','⚙️ Falla Mecánica'],['electrica','⚡ Falla Eléctrica']] as const).map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setAssistanceType(v)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition ${
                        assistanceType === v ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                      }`}>{l}</button>
                  ))}
                </div>
              )}
            </Field>
            {(assistanceType || ro) && (
              <Field label="Descripción de la Falla">
                {ro
                  ? <ReadValue value={assistanceNotes} />
                  : <textarea className={inputCls} rows={3} value={assistanceNotes} onChange={e => setAssistanceNotes(e.target.value)}
                      placeholder="Detalla la falla específica..." />
                }
              </Field>
            )}
          </div>
        )}

        {/* CUESTIONARIO ESPECÍFICO ASISTENCIA */}
        {service?.categoria_servicio === 'cambio_llanta' && (
          <div className="mt-5 space-y-4 pl-4 border-l-4 border-indigo-400">
            <h4 className="font-bold text-xs text-indigo-600 uppercase tracking-wide">Detalles de Cambio de Llanta</h4>
            <YesNo label="¿Cuenta con birlo de seguridad?" value={birloSeguridad} onChange={setBirloSeguridad} readOnly={ro} />
            <YesNo label="¿Cuenta con llanta de refacción (En buen estado)?" value={llantaRefaccion} onChange={setLlantaRefaccion} readOnly={ro} />
            <Field label="Observaciones">
              {ro ? <ReadValue value={asistenciaObs} />
                : <textarea className={inputCls} rows={2} value={asistenciaObs} onChange={e => setAsistenciaObs(e.target.value)} placeholder="Ej: La llanta a cambiar es la trasera derecha..." />
              }
            </Field>
          </div>
        )}

        {service?.categoria_servicio === 'gasolina' && (
          <div className="mt-5 space-y-4 pl-4 border-l-4 border-pink-400">
            <h4 className="font-bold text-xs text-pink-600 uppercase tracking-wide">Detalles Suministro de Combustible</h4>
            
            <Field label="Tipo de Combustible">
              {ro ? <ReadValue value={tipoCombustible === 'magna' ? '🟢 Magna' : tipoCombustible === 'premium' ? '🔴 Premium' : tipoCombustible === 'diesel' ? '⚫ Diesel' : null} />
                : <div className="flex gap-2 mt-1">
                    {([['magna','🟢 Magna'],['premium','🔴 Premium'],['diesel','⚫ Diesel']] as const).map(([v,l]) => (
                      <button key={v} type="button" onClick={() => setTipoCombustible(v)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition ${tipoCombustible === v ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
              }
            </Field>

            <Field label="¿Cuántos Litros Requiere?">
              {ro ? <ReadValue value={litros ? `${litros} Lts` : null} />
                : <select className={selectCls} value={litros || ''} onChange={e => setLitros(parseInt(e.target.value))}>
                    <option value="">Selecciona Lts...</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} Litro{n>1?'s':''}</option>)}
                  </select>
              }
            </Field>

            <Field label="Cargo del Combustible">
              {ro ? <ReadValue value={pagoCombustible === 'usuario' ? '👤 A cargo del Usuario' : pagoCombustible === 'cliente' ? '🏢 A cargo del Cliente / Aseguradora' : null} />
                : <div className="flex gap-2 flex-col sm:flex-row mt-1">
                    {([['usuario','👤 A cargo del Usuario (Sitio)'],['cliente','🏢 A cargo del Cliente / Aseguradora']] as const).map(([v,l]) => (
                      <button key={v} type="button" onClick={() => setPagoCombustible(v)}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold border-2 transition ${pagoCombustible === v ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
              }
            </Field>
          </div>
        )}
      </div>

      {/* ── 3. Vehículo ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader icon={Car} title="Datos del Vehículo" color="text-indigo-600" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Año">
            {ro ? <ReadValue value={vehicleYear} />
              : <select className={selectCls} value={vehicleYear} onChange={e => setVehicleYear(e.target.value)}>
                  <option value="">Año</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            }
          </Field>
          <Field label="Marca">
            {ro ? <ReadValue value={vehicleBrand} />
              : <select className={selectCls} value={vehicleBrand} onChange={e => setVehicleBrand(e.target.value)}>
                  <option value="">Marca</option>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
            }
          </Field>
          <Field label="Tipo de Vehículo">
            {ro ? <ReadValue value={vehicleType} />
              : <input className={inputCls} value={vehicleType} onChange={e => setVehicleType(e.target.value)} placeholder="Ej. Sedán, SUV..." />
            }
          </Field>
          <Field label="Placas">
            {ro ? <ReadValue value={vehiclePlates} />
              : <input className={`${inputCls} uppercase`} value={vehiclePlates} onChange={e => setVehiclePlates(e.target.value.toUpperCase())} placeholder="ABC-1234" />
            }
          </Field>
          <Field label="Color">
            {ro ? <ReadValue value={vehicleColor} />
              : <select className={selectCls} value={vehicleColor} onChange={e => setVehicleColor(e.target.value)}>
                  <option value="">Color</option>
                  {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            }
          </Field>
        </div>
      </div>

      {/* ── 4. Maniobras ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader icon={Wrench} title="Maniobras y Ubicación" color="text-red-600" />
        <div className="space-y-5">
          {isArrastre && (
            <>
              <YesNo label="¿Vehículo en Neutral?" value={neutral} onChange={setNeutral} readOnly={ro} />
              {neutral === false && (
                <div className="pl-4 border-l-4 border-red-200">
                  <Field label="Tipo de Transmisión">
                    {ro ? <ReadValue value={transmissionType} />
                      : <div className="flex gap-2 mt-1">
                          {([['estandar','Estándar'],['automatico','Automático']] as const).map(([v,l]) => (
                            <button key={v} type="button" onClick={() => setTransmissionType(v)}
                              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition ${transmissionType === v ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200'}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                    }
                  </Field>
                </div>
              )}

              <YesNo label="¿Las Llantas Giran?" value={wheelsSpin} onChange={setWheelsSpin} readOnly={ro} />
              {wheelsSpin === false && (
                <div className="pl-4 border-l-4 border-red-200">
                  <YesNo label="¿El Volante Gira?" value={steeringSpin} onChange={setSteeringSpin} readOnly={ro} />
                </div>
              )}
            </>
          )}

          <Field label="¿Dónde se Encuentra el Vehículo?">
            {ro ? <ReadValue value={vehicleAt === 'calle' ? '🛣️ Pie de Calle' : vehicleAt === 'garage' ? '🏢 Garage / Estacionamiento' : null} />
              : <div className="flex gap-3 mt-1">
                  {([['calle','🛣️ Pie de Calle'],['garage','🏢 Garage / Estacionamiento']] as const).map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setVehicleAt(v)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition ${vehicleAt === v ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                      {l}
                    </button>
                  ))}
                </div>
            }
          </Field>
          {vehicleAt === 'garage' && (
            <div className="pl-4 border-l-4 border-slate-300 space-y-4">
              <Field label="Tipo de Estacionamiento">
                {ro ? <ReadValue value={parkingType} />
                  : <div className="flex gap-2 mt-1">
                      {([['techado','☁️ Techado'],['aire_libre','🌤️ Al Aire Libre']] as const).map(([v,l]) => (
                        <button key={v} type="button" onClick={() => setParkingType(v)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition ${parkingType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                }
              </Field>
              <Field label="Condiciones de acceso">
                {ro ? <ReadValue value={parkingNotes} />
                  : <textarea className={inputCls} rows={3} value={parkingNotes} onChange={e => setParkingNotes(e.target.value)}
                      placeholder="Ej: Acceso en rampa de caracol, altura máxima 2.10m..." />
                }
              </Field>
            </div>
          )}

          <PhotoUploader
            label="Fotos de Evidencia — Estado del Vehículo"
            photos={contactUrls}
            onAdd={addPhotos(setContactPhotos, setContactUrls)}
            onRemove={removePhoto(setContactPhotos, setContactUrls)}
            readOnly={ro}
          />
        </div>
      </div>

      {/* ── 5. Origen ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader icon={MapPin} title="Ubicación de Origen (Siniestro)" color="text-emerald-600" />
        {isGeoLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Geocodificando coordenadas...
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Estado">
            {ro ? <ReadValue value={originState} />
              : <select className={selectCls} value={originState} onChange={e => setOriginState(e.target.value)}>
                  <option value="">Seleccionar estado</option>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            }
          </Field>
          <Field label="Municipio / Alcaldía">
            {ro ? <ReadValue value={originMunicipality} />
              : <input className={inputCls} value={originMunicipality} onChange={e => setOriginMunicipality(e.target.value)} placeholder="Auto-completado con coordenadas" />
            }
          </Field>
          <Field label="Colonia">
            {ro ? <ReadValue value={originColonia} />
              : <input className={inputCls} value={originColonia} onChange={e => setOriginColonia(e.target.value)} placeholder="Auto-completado con coordenadas" />
            }
          </Field>
          <Field label="Calle / Avenida">
            {ro ? <ReadValue value={originStreet} />
              : <input className={inputCls} value={originStreet} onChange={e => setOriginStreet(e.target.value)} placeholder="Auto-completado con coordenadas" />
            }
          </Field>
          <Field label="Entre Calles">
            {ro ? <ReadValue value={originCrossStreets} />
              : <input className={inputCls} value={originCrossStreets} onChange={e => setOriginCrossStreets(e.target.value)} placeholder="Ej. Entre Insurgentes y Reforma" />
            }
          </Field>
          <Field label="Referencias Visuales">
            {ro ? <ReadValue value={originReferences} />
              : <input className={inputCls} value={originReferences} onChange={e => setOriginReferences(e.target.value)} placeholder="Ej. Frente al OXXO" />
            }
          </Field>
        </div>
      </div>



      {/* ── Error ──────────────────────────────────────────── */}
      {saveErr && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center px-4 z-50">
          <div className="bg-red-50 border border-red-300 text-red-700 px-6 py-3 rounded-xl shadow-lg text-sm font-medium max-w-lg w-full">
            ⚠️ {saveErr}
          </div>
        </div>
      )}

      {/* ── Barra fija de acciones ──────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl px-6 py-4 z-40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-3">
          {ro ? (
            // Modo lectura: solo botón desbloquear
            <>
              <button onClick={() => router.back()} className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <div className="flex-1" />
              <button onClick={() => handleUnlockClick()}
                className="w-full sm:w-auto px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2">
                <Unlock className="w-4 h-4" />
                Desbloquear y Editar
              </button>
            </>
          ) : (
            // Modo edición: botones de guardado
            <>
              {hasData && (
                <button onClick={() => setIsEditing(false)} className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" /> Cancelar
                </button>
              )}
              <button onClick={() => handleSave('cancelado_momento')} disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 border-2 border-red-300 text-red-600 font-semibold text-sm rounded-xl hover:bg-red-50 transition disabled:opacity-40 flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" /> Cancelado al Momento
              </button>
              <button onClick={() => handleSave('cotizacion')} disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 border-2 border-amber-400 text-amber-700 font-semibold text-sm rounded-xl hover:bg-amber-50 transition disabled:opacity-40 flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> Solo Cotización
              </button>
              <div className="flex-1" />
              <button onClick={() => handleSave('asignando')} disabled={isSaving}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-40 flex items-center justify-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Guardando...' : (isArrastre ? 'Guardar Datos → Asignar Grúa' : 'Guardar Datos → Asignar Vehículo')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Evidencias Fotográficas del Operador ─────────────── */}
      {hasData && (
        <EvidencePhotosPanel serviceId={id} />
      )}

      {/* ── Bitácora del Expediente ─────────────────────────── */}
      {hasData && (
        <div className="max-w-4xl mx-auto mt-2 mb-28 space-y-4">
          <DispatcherMessageBar serviceId={id} />
          <ServiceLog serviceId={id} canAddNotes={true} />
        </div>
      )}


      {/* ── Modal de desbloqueo ───────────────────────────────── */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-2 p-5 border-b border-slate-200">
              <Unlock className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-slate-800">Motivo del Desbloqueo</h2>
              <button onClick={() => setShowUnlockModal(false)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-2">
              <p className="text-sm text-slate-500 mb-3">Selecciona el motivo por el que se requiere modificar el expediente:</p>
              {unlockOptions.map(opt => (
                <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                  unlockReason === opt ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="unlock_reason"
                    value={opt}
                    checked={unlockReason === opt}
                    onChange={() => setUnlockReason(opt)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm text-slate-700 font-medium">{opt}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowUnlockModal(false)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button
                onClick={handleConfirmUnlock}
                disabled={!unlockReason || isUnlocking}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isUnlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Confirmar y Desbloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
