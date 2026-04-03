'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Phone, Award, Plus, Pencil, X, Check, Stethoscope, Package, Video, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const SPECIALTY_OPTIONS = ['Medicina General', 'Pediatría', 'Cardiología', 'Ginecología', 'Traumatología', 'Dermatología', 'Farmacia', 'Otro']
const SERVICE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  medico_domicilio:    { label: 'Médico Domicilio', color: 'bg-emerald-100 text-emerald-700' },
  reparto_medicamento: { label: 'Reparto Medicamento', color: 'bg-blue-100 text-blue-700' },
  telemedicina:        { label: 'Telemedicina', color: 'bg-violet-100 text-violet-700' },
}

const ESTADOS_MEXICO = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
]

interface Provider {
  id: string
  full_name: string
  cedula: string | null
  phone: string
  specialty: string
  service_types: string[]
  is_active: boolean
  state: string | null
  municipality: string | null
  notes?: string | null
  created_at: string
}

export default function MedicalProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')
  const [filterState, setFilterState] = useState<string>('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')

  // Form state
  const [fullName, setFullName] = useState('')
  const [cedula, setCedula] = useState('')
  const [phone, setPhone] = useState('')
  const [specialty, setSpecialty] = useState('Medicina General')
  const [serviceTypes, setServiceTypes] = useState<string[]>(['medico_domicilio'])
  const [stateForm, setStateForm] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [notes, setNotes] = useState('')

  const supabase = createClient()

  const fetchProviders = useCallback(async () => {
    const { data } = await supabase
      .from('medical_providers')
      .select('*')
      .order('full_name')
    if (data) setProviders(data)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchProviders()
    // Obtener company_id del usuario actual
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('company_id').eq('id', user.id).single()
          .then(({ data }) => setCompanyId(data?.company_id ?? null))
      }
    })
  }, [fetchProviders]) // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setFullName(''); setCedula(''); setPhone(''); setSpecialty('Medicina General')
    setServiceTypes(['medico_domicilio']); setStateForm(''); setMunicipality(''); setNotes(''); 
    setEditingId(null); setShowForm(false)
  }

  function startEdit(p: Provider) {
    setFullName(p.full_name); setCedula(p.cedula ?? ''); setPhone(p.phone)
    setSpecialty(p.specialty); setServiceTypes(p.service_types ?? []); 
    setStateForm(p.state ?? ''); setMunicipality(p.municipality ?? ''); setNotes(p.notes ?? '')
    setEditingId(p.id); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleServiceType(type: string) {
    setServiceTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  async function handleSave() {
    if (!fullName.trim() || !phone.trim() || !stateForm) {
      setSaveError('Nombre, teléfono y estado son requeridos.')
      return
    }
    setSaveError('')
    setSaving(true)
    const payload = {
      full_name: fullName.trim(), cedula: cedula.trim() || null,
      phone: phone.trim(), specialty, service_types: serviceTypes,
      state: stateForm, municipality: municipality.trim() || null,
      notes: notes.trim() || null,
    }

    if (editingId) {
      const { error } = await supabase.from('medical_providers').update(payload).eq('id', editingId)
      if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }
    } else {
      if (!companyId) { setSaveError('No se pudo detectar tu empresa. Recarga la página.'); setSaving(false); return }
      const { error } = await supabase.from('medical_providers').insert({ ...payload, company_id: companyId, is_active: true })
      if (error) { setSaveError(`Error: ${error.message}`); setSaving(false); return }
    }
    await fetchProviders()
    resetForm()
    setSaving(false)
  }

  async function toggleActive(p: Provider) {
    await supabase.from('medical_providers').update({ is_active: !p.is_active }).eq('id', p.id)
    await fetchProviders()
  }

  const filtered = providers.filter(p => {
    let match = true
    if (filterActive === 'active')   match = p.is_active
    else if (filterActive === 'inactive') match = !p.is_active
    
    if (match && filterState) {
      match = p.state === filterState
    }
    return match
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/medical" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" /> Directorio de Doctores
            </h2>
            <p className="text-sm text-slate-500">{providers.filter(p => p.is_active).length} doctores activos</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo Doctor
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-emerald-50 border-b border-emerald-100">
            <h3 className="font-bold text-emerald-800 text-sm uppercase tracking-wide">
              {editingId ? 'Editar Doctor' : 'Registrar Nuevo Doctor'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 space-y-4">
            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                ⚠️ {saveError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Nombre Completo *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Dr. Juan Pérez"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Cédula Profesional</label>
                <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="12345678"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Teléfono *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="55XXXXXXXX" type="tel"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Especialidad</label>
                <select value={specialty} onChange={e => setSpecialty(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none">
                  {SPECIALTY_OPTIONS.map(s => <option key={s} className="text-slate-900">{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Estado *</label>
                <select value={stateForm} onChange={e => setStateForm(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">Seleccione un Estado...</option>
                  {ESTADOS_MEXICO.map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 pt-3 sm:pt-0">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Municipio / Alcaldía (Opcional)</label>
                <input value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="Ej: Naucalpan"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Tipos de servicio que puede atender</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SERVICE_TYPE_LABELS).map(([key, { label, color }]) => (
                    <button key={key} type="button" onClick={() => toggleServiceType(key)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                        serviceTypes.includes(key) ? `${color} border-current` : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                      {serviceTypes.includes(key) && <Check className="w-3 h-3 inline mr-1" />}{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={resetForm} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!fullName.trim() || !phone.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm transition-colors">
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 shrink-0">
          {(['active','all','inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilterActive(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filterActive === f ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}>
              {f === 'active' ? 'Activos' : f === 'inactive' ? 'Inactivos' : 'Todos'}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs relative">
          <select 
            value={filterState} 
            onChange={e => setFilterState(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-600 font-semibold rounded-full px-4 py-1.5 text-sm appearance-none outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">🌎 Todos los Estados</option>
            {ESTADOS_MEXICO.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay doctores en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className={`bg-white border rounded-2xl p-5 shadow-sm flex gap-4 items-start ${p.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-emerald-700 font-black text-lg">{p.full_name[0]?.toUpperCase()}</span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-bold text-slate-800">{p.full_name}</p>
                    <p className="text-sm text-slate-500 font-medium">{p.specialty}</p>
                    {p.state && (
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        📍 {p.municipality ? `${p.municipality}, ` : ''}{p.state}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(p)}
                      className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${
                        p.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}>
                      {p.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                  {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {p.phone}</span>}
                  {p.cedula && <span className="flex items-center gap-1"><Award className="w-3 h-3" /> Céd: {p.cedula}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(p.service_types ?? []).map(t => (
                    <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SERVICE_TYPE_LABELS[t]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                      {SERVICE_TYPE_LABELS[t]?.label ?? t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
