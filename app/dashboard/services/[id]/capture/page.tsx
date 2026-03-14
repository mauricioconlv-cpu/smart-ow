'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  User, Phone, FileText, Car, Wrench, MapPin, Package,
  ChevronDown, CheckCircle, XCircle, Upload, Loader2, ArrowLeft, Save, X
} from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Catálogos ───────────────────────────────────────────────
const YEARS = Array.from({ length: 2028 - 1990 + 1 }, (_, i) => 2028 - i)
const BRANDS = ['Chevrolet','Nissan','Volkswagen','Toyota','Ford','Honda','Hyundai','Kia','Mazda','Dodge','Jeep','Audi','BMW','Mercedes-Benz','Renault']
const COLORS = ['Blanco','Negro','Gris/Plata','Rojo','Azul','Verde','Amarillo','Naranja','Café/Beige','Otro']
const ESTADOS = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala',
  'Veracruz','Yucatán','Zacatecas'
]

// ─── Helper: reverse geocode con Nominatim ───────────────────
async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'es' } }
    )
    const data = await res.json()
    const a = data.address || {}
    return {
      state: a.state ?? '',
      municipality: a.city ?? a.county ?? a.state_district ?? '',
      colonia: a.suburb ?? a.neighbourhood ?? a.quarter ?? '',
      street: a.road ?? a.pedestrian ?? ''
    }
  } catch { return null }
}

// ─── Helpers UI ───────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color = 'text-blue-600' }: any) {
  return (
    <div className={`flex items-center gap-2 pb-2 border-b border-slate-200 mb-4 ${color}`}>
      <Icon className="w-5 h-5" />
      <h3 className="font-bold text-base text-slate-800">{title}</h3>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
const selectCls = inputCls

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[true, false].map(opt => (
        <button key={String(opt)} type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${
            value === opt
              ? opt ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {opt ? '✓ Sí' : '✗ No'}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────
export default function ServiceCapturePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [service, setService] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [isGeoLoading, setIsGeoLoading] = useState(false)

  // ── Formulario estado ────────────────────────────────────────
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [insuranceContact, setInsuranceContact] = useState('')
  const [insuranceFolio, setInsuranceFolio] = useState('')

  const [serviceReason, setServiceReason] = useState<'siniestro'|'asistencia'|''>('')
  const [assistanceType, setAssistanceType] = useState<'mecanica'|'electrica'|''>('')
  const [assistanceNotes, setAssistanceNotes] = useState('')

  const [vehicleYear, setVehicleYear] = useState('')
  const [vehicleBrand, setVehicleBrand] = useState('')
  const [vehiclePlates, setVehiclePlates] = useState('')
  const [vehicleColor, setVehicleColor] = useState('')

  const [neutral, setNeutral] = useState<boolean|null>(null)
  const [transmissionType, setTransmissionType] = useState<'estandar'|'automatico'|''>('')
  const [wheelsSpin, setWheelsSpin] = useState<boolean|null>(null)
  const [steeringSpin, setSteeringSpin] = useState<boolean|null>(null)
  const [vehicleAt, setVehicleAt] = useState<'calle'|'garage'|''>('')
  const [parkingType, setParkingType] = useState<'techado'|'aire_libre'|''>('')
  const [parkingNotes, setParkingNotes] = useState('')

  const [originState, setOriginState] = useState('')
  const [originMunicipality, setOriginMunicipality] = useState('')
  const [originColonia, setOriginColonia] = useState('')
  const [originStreet, setOriginStreet] = useState('')
  const [originCrossStreets, setOriginCrossStreets] = useState('')
  const [originReferences, setOriginReferences] = useState('')

  const [destinationType, setDestinationType] = useState<'agencia'|'taller'|'domicilio'|''>('')
  const [travelsInventory, setTravelsInventory] = useState<boolean|null>(null)
  const [destinationReceiver, setDestinationReceiver] = useState('')

  const [destState, setDestState] = useState('')
  const [destMunicipality, setDestMunicipality] = useState('')
  const [destColonia, setDestColonia] = useState('')
  const [destStreet, setDestStreet] = useState('')
  const [destCrossStreets, setDestCrossStreets] = useState('')
  const [destReferences, setDestReferences] = useState('')

  // ── Cargar servicio y auto-geocodificar ─────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('services')
        .select('*, clients(name), profiles(full_name)')
        .eq('id', id)
        .single()
      if (!data) return
      setService(data)

      // Auto-geocode origen
      if (data.origen_coords?.lat && data.origen_coords?.lng) {
        setIsGeoLoading(true)
        const geo = await reverseGeocode(data.origen_coords.lat, data.origen_coords.lng)
        if (geo) {
          setOriginState(matchEstado(geo.state))
          setOriginMunicipality(geo.municipality)
          setOriginColonia(geo.colonia)
          setOriginStreet(geo.street)
        }
        setIsGeoLoading(false)
      }

      // Auto-geocode destino
      if (data.destino_coords?.lat && data.destino_coords?.lng) {
        const geo = await reverseGeocode(data.destino_coords.lat, data.destino_coords.lng)
        if (geo) {
          setDestState(matchEstado(geo.state))
          setDestMunicipality(geo.municipality)
          setDestColonia(geo.colonia)
          setDestStreet(geo.street)
        }
      }
    }
    load()
  }, [id])

  function matchEstado(name: string) {
    const n = name.toLowerCase()
    return ESTADOS.find(e => e.toLowerCase().includes(n) || n.includes(e.toLowerCase())) ?? name
  }

  // ── Fotos ─────────────────────────────────────────────────
  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setPhotos(prev => [...prev, ...files])
    files.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => setPhotoUrls(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  const removePhoto = (i: number) => {
    setPhotos(p => p.filter((_, idx) => idx !== i))
    setPhotoUrls(p => p.filter((_, idx) => idx !== i))
  }

  // ── Upload fotos a Supabase Storage ──────────────────────
  async function uploadPhotos(serviceId: string) {
    const urls: string[] = []
    for (const file of photos) {
      const ext = file.name.split('.').pop()
      const path = `services/${serviceId}/contact_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
      if (!error) {
        const { data: pub } = supabase.storage.from('photos').getPublicUrl(path)
        urls.push(pub.publicUrl)
      }
    }
    return urls
  }

  // ── Guardar ────────────────────────────────────────────────
  async function handleSave(newStatus: 'asignando'|'cotizacion'|'cancelado_cliente') {
    setIsSaving(true)
    setSaveErr('')
    try {
      // 1. Subir fotos
      const uploadedUrls = await uploadPhotos(id)

      // 2. Actualizar servicio
      const { error } = await supabase.from('services').update({
        status: newStatus,
        contact_name: contactName,
        contact_phone: contactPhone,
        insurance_contact: insuranceContact,
        insurance_folio: insuranceFolio,
        service_reason: serviceReason,
        assistance_type: assistanceType || null,
        assistance_notes: assistanceNotes || null,
        vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
        vehicle_brand: vehicleBrand || null,
        vehicle_plates: vehiclePlates || null,
        vehicle_color: vehicleColor || null,
        maneuver_neutral: neutral,
        transmission_type: transmissionType || null,
        wheels_spin: wheelsSpin,
        steering_spins: steeringSpin,
        vehicle_at: vehicleAt || null,
        parking_type: parkingType || null,
        parking_notes: parkingNotes || null,
        origin_state: originState,
        origin_municipality: originMunicipality,
        origin_colonia: originColonia,
        origin_street: originStreet,
        origin_cross_streets: originCrossStreets || null,
        origin_references: originReferences || null,
        destination_type: destinationType || null,
        travels_inventory: travelsInventory,
        destination_receiver: destinationReceiver || null,
        dest_state: destState,
        dest_municipality: destMunicipality,
        dest_colonia: destColonia,
        dest_street: destStreet,
        dest_cross_streets: destCrossStreets || null,
        dest_references: destReferences || null,
      }).eq('id', id)

      if (error) throw new Error(error.message)

      if (newStatus === 'asignando') {
        router.push(`/dashboard/services/${id}`)
      } else {
        router.push('/dashboard/services')
      }
    } catch (err: any) {
      setSaveErr(err.message)
      setIsSaving(false)
    }
  }

  if (!service) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Captura de Servicio</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Folio Interno: <span className="font-bold text-blue-600">#{service.folio}</span>
            {' · '} Cliente: <span className="font-semibold">{service.clients?.name}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">

        {/* ── Sección 1: Contacto ─────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <SectionHeader icon={User} title="Información de Contacto" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre del Usuario / Asegurado">
              <input className={inputCls} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Ej. Juan García" />
            </Field>
            <Field label="Teléfono de Contacto">
              <input className={inputCls} type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="55 1234 5678" />
            </Field>
            <Field label="Nombre del Ejecutivo / Agente Aseguradora">
              <input className={inputCls} value={insuranceContact} onChange={e => setInsuranceContact(e.target.value)} placeholder="Ej. María López (AXA)" />
            </Field>
            <Field label="Folio / Expediente Aseguradora">
              <input className={inputCls} value={insuranceFolio} onChange={e => setInsuranceFolio(e.target.value)} placeholder="Ej. EXP-2024-789456" />
            </Field>
          </div>
        </div>

        {/* ── Sección 2: Motivo ───────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <SectionHeader icon={FileText} title="Motivo del Servicio" color="text-orange-600" />
          <Field label="Tipo de Solicitud">
            <div className="flex gap-3 mt-1">
              {(['siniestro', 'asistencia'] as const).map(r => (
                <button key={r} type="button" onClick={() => setServiceReason(r)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 capitalize transition ${
                    serviceReason === r
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                  }`}
                >
                  {r === 'siniestro' ? '🚨 Siniestro' : '🔧 Asistencia'}
                </button>
              ))}
            </div>
          </Field>

          {serviceReason === 'asistencia' && (
            <div className="mt-4 space-y-4 pl-4 border-l-4 border-orange-200">
              <Field label="Tipo de Falla">
                <div className="flex gap-3 mt-1">
                  {([['mecanica','⚙️ Falla Mecánica'],['electrica','⚡ Falla Eléctrica']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setAssistanceType(v)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition ${
                        assistanceType === v ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                      }`}
                    >{label}</button>
                  ))}
                </div>
              </Field>
              {assistanceType && (
                <Field label="Descripción de la Falla">
                  <textarea className={inputCls} rows={3} value={assistanceNotes} onChange={e => setAssistanceNotes(e.target.value)}
                    placeholder="Detalla la falla específica, síntomas o información relevante..." />
                </Field>
              )}
            </div>
          )}
        </div>

        {/* ── Sección 3: Vehículo ─────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <SectionHeader icon={Car} title="Datos del Vehículo" color="text-indigo-600" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Año">
              <select className={selectCls} value={vehicleYear} onChange={e => setVehicleYear(e.target.value)}>
                <option value="">Año</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="Marca">
              <select className={selectCls} value={vehicleBrand} onChange={e => setVehicleBrand(e.target.value)}>
                <option value="">Marca</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Placas">
              <input className={`${inputCls} uppercase`} value={vehiclePlates} onChange={e => setVehiclePlates(e.target.value.toUpperCase())} placeholder="ABC-1234" />
            </Field>
            <Field label="Color">
              <select className={selectCls} value={vehicleColor} onChange={e => setVehicleColor(e.target.value)}>
                <option value="">Color</option>
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* ── Sección 4: Maniobras ────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <SectionHeader icon={Wrench} title="Maniobras y Condiciones" color="text-red-600" />
          <div className="space-y-5">

            <Field label="¿Vehículo en Neutral?">
              <YesNo value={neutral} onChange={setNeutral} />
            </Field>
            {neutral === false && (
              <div className="pl-4 border-l-4 border-red-200">
                <Field label="Tipo de Transmisión">
                  <div className="flex gap-2">
                    {([['estandar','Estándar'],['automatico','Automático']] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setTransmissionType(v)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${transmissionType === v ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            <Field label="¿Las Llantas Giran?">
              <YesNo value={wheelsSpin} onChange={setWheelsSpin} />
            </Field>
            {wheelsSpin === false && (
              <div className="pl-4 border-l-4 border-red-200">
                <Field label="¿El Volante Gira?">
                  <YesNo value={steeringSpin} onChange={setSteeringSpin} />
                </Field>
              </div>
            )}

            <Field label="¿Dónde se encuentra el Vehículo?">
              <div className="flex gap-3">
                {([['calle','🛣️ Pie de Calle'],['garage','🏢 Garage / Estacionamiento']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setVehicleAt(v)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition ${vehicleAt === v ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>

            {vehicleAt === 'garage' && (
              <div className="pl-4 border-l-4 border-slate-300 space-y-4">
                <Field label="Tipo de Estacionamiento">
                  <div className="flex gap-2">
                    {([['techado','Techado'],['aire_libre','Al Aire Libre']] as const).map(([v,l]) => (
                      <button key={v} type="button" onClick={() => setParkingType(v)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${parkingType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Condiciones del Estacionamiento (acceso, altura máxima, tipo de rampa)">
                  <textarea className={inputCls} rows={3} value={parkingNotes} onChange={e => setParkingNotes(e.target.value)}
                    placeholder="Ej: Acceso en rampa de caracol, altura máxima 2.10m, nivel -2, estacionamiento subterráneo..." />
                </Field>
              </div>
            )}

            {/* Fotos de evidencia */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Fotos de Evidencia (Estado del Vehículo)</label>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 transition">
                <Upload className="w-4 h-4" /> Subir Fotos
              </button>
              {photoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {photoUrls.map((url, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sección 5: Ubicación Origen ─────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <SectionHeader icon={MapPin} title="Ubicación de Origen (Siniestro)" color="text-emerald-600" />
          {isGeoLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Geocodificando coordenadas...
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Estado">
              <select className={selectCls} value={originState} onChange={e => setOriginState(e.target.value)}>
                <option value="">Seleccionar estado</option>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Municipio / Alcaldía">
              <input className={inputCls} value={originMunicipality} onChange={e => setOriginMunicipality(e.target.value)} placeholder="Auto-completado con coordenadas" />
            </Field>
            <Field label="Colonia">
              <input className={inputCls} value={originColonia} onChange={e => setOriginColonia(e.target.value)} placeholder="Auto-completado con coordenadas" />
            </Field>
            <Field label="Calle / Avenida">
              <input className={inputCls} value={originStreet} onChange={e => setOriginStreet(e.target.value)} placeholder="Auto-completado con coordenadas" />
            </Field>
            <Field label="Entre Calles">
              <input className={inputCls} value={originCrossStreets} onChange={e => setOriginCrossStreets(e.target.value)} placeholder="Ej. Entre Insurgentes y Reforma" />
            </Field>
            <Field label="Referencias Visuales">
              <input className={inputCls} value={originReferences} onChange={e => setOriginReferences(e.target.value)} placeholder="Ej. Frente al OXXO, edificio azul" />
            </Field>
          </div>
        </div>

        {/* ── Sección 6: Destino del Vehículo ─────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <SectionHeader icon={Package} title="Destino del Vehículo" color="text-purple-600" />
          <div className="space-y-4">
            <Field label="¿A dónde se traslada el Vehículo?">
              <div className="flex gap-3">
                {([['agencia','🏪 Agencia'],['taller','🔩 Taller'],['domicilio','🏠 Domicilio']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setDestinationType(v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition ${destinationType === v ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="¿El Vehículo Viaja Bajo Inventario?">
              <YesNo value={travelsInventory} onChange={setTravelsInventory} />
            </Field>

            {travelsInventory === true && (
              <div className="pl-4 border-l-4 border-purple-200">
                <Field label="¿Quién Recibe en el Destino?">
                  <input className={inputCls} value={destinationReceiver} onChange={e => setDestinationReceiver(e.target.value)} placeholder="Nombre y cargo de quien recibe" />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* ── Sección 7: Ubicación Destino ────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <SectionHeader icon={MapPin} title="Ubicación de Destino" color="text-rose-600" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Estado">
              <select className={selectCls} value={destState} onChange={e => setDestState(e.target.value)}>
                <option value="">Seleccionar estado</option>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Municipio / Alcaldía">
              <input className={inputCls} value={destMunicipality} onChange={e => setDestMunicipality(e.target.value)} placeholder="Auto-completado con coordenadas" />
            </Field>
            <Field label="Colonia">
              <input className={inputCls} value={destColonia} onChange={e => setDestColonia(e.target.value)} placeholder="Auto-completado con coordenadas" />
            </Field>
            <Field label="Calle / Avenida">
              <input className={inputCls} value={destStreet} onChange={e => setDestStreet(e.target.value)} placeholder="Auto-completado con coordenadas" />
            </Field>
            <Field label="Entre Calles">
              <input className={inputCls} value={destCrossStreets} onChange={e => setDestCrossStreets(e.target.value)} placeholder="Ej. Entre Insurgentes y Reforma" />
            </Field>
            <Field label="Referencias Visuales">
              <input className={inputCls} value={destReferences} onChange={e => setDestReferences(e.target.value)} placeholder="Ej. Estacionamiento del centro comercial" />
            </Field>
          </div>
        </div>

      </div>

      {/* ── Barra de Acciones Fija ────────────────────────── */}
      {saveErr && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-50">
          <div className="bg-red-50 border border-red-300 text-red-700 px-6 py-3 rounded-xl shadow-lg text-sm font-medium max-w-lg w-full">
            ⚠️ {saveErr}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl px-6 py-4 z-40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => handleSave('cancelado_cliente')}
            disabled={isSaving}
            className="w-full sm:w-auto px-5 py-2.5 border-2 border-red-300 text-red-600 font-semibold text-sm rounded-xl hover:bg-red-50 transition disabled:opacity-40"
          >
            <XCircle className="w-4 h-4 inline mr-1.5" />
            Cancelado al Momento
          </button>
          <button
            onClick={() => handleSave('cotizacion')}
            disabled={isSaving}
            className="w-full sm:w-auto px-5 py-2.5 border-2 border-amber-400 text-amber-700 font-semibold text-sm rounded-xl hover:bg-amber-50 transition disabled:opacity-40"
          >
            <FileText className="w-4 h-4 inline mr-1.5" />
            Solo Cotización
          </button>
          <div className="flex-1" />
          <button
            onClick={() => handleSave('asignando')}
            disabled={isSaving}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Guardando...' : 'Guardar Datos → Asignar Grúa'}
          </button>
        </div>
      </div>

    </div>
  )
}
