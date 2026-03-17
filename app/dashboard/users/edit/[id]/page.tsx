'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, User, Loader2, AlertTriangle, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const DIAS_SEMANA = [
  { id: 'lunes', label: 'Lun' },
  { id: 'martes', label: 'Mar' },
  { id: 'miercoles', label: 'Mié' },
  { id: 'jueves', label: 'Jue' },
  { id: 'viernes', label: 'Vie' },
  { id: 'sabado', label: 'Sáb' },
  { id: 'domingo', label: 'Dom' },
]

function calcularHoras(entrada: string, salida: string): number | null {
  if (!entrada || !salida) return null
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = salida.split(':').map(Number)
  let mins = (sh * 60 + sm) - (eh * 60 + em)
  if (mins < 0) mins += 24 * 60
  return parseFloat((mins / 60).toFixed(2))
}

export default function EditUserPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile]         = useState<any>(null)
  const [towTrucks, setTowTrucks]     = useState<any[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [isSaving, setIsSaving]       = useState(false)
  const [errorMsg, setErrorMsg]       = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [diasDescanso, setDiasDescanso] = useState<string[]>([])
  const [horaEntrada, setHoraEntrada]   = useState('08:00')
  const [horaSalida, setHoraSalida]     = useState('17:00')
  const [tipoJornada, setTipoJornada]   = useState('normal')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile]       = useState<File | null>(null)

  const horasLaboradas = calcularHoras(horaEntrada, horaSalida)

  useEffect(() => {
    async function loadData() {
      const { data: pData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (pError || !pData) {
        setErrorMsg('No se pudo encontrar el empleado o no tienes permisos.')
        setIsLoading(false)
        return
      }
      setProfile(pData)
      setSelectedRole(pData.role)
      setDiasDescanso(pData.dias_descanso || [])
      setHoraEntrada(pData.hora_entrada?.slice(0,5) || '08:00')
      setHoraSalida(pData.hora_salida?.slice(0,5) || '17:00')
      setTipoJornada(pData.tipo_jornada || 'normal')
      if (pData.avatar_url) setAvatarPreview(pData.avatar_url)

      const { data: tData } = await supabase.from('tow_trucks').select('*').eq('is_active', true)
      if (tData) setTowTrucks(tData)

      setIsLoading(false)
    }
    loadData()
  }, [id])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function toggleDia(dia: string) {
    setDiasDescanso(prev =>
      prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    setErrorMsg('')

    const form = e.currentTarget
    const fd   = new FormData(form)

    try {
      // 1. Upload avatar si hay uno nuevo
      let avatar_url = profile.avatar_url || null
      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop()
        const path = `${id}/avatar.${ext}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
        if (uploadErr) {
          throw new Error(`Error al subir foto: ${uploadErr.message}`)
        }
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          avatar_url = urlData.publicUrl + `?t=${Date.now()}` // cache-bust
        }
      }

      // 2. Construir payload
      const payload: any = {
        full_name:       fd.get('fullName') as string,
        role:            selectedRole,
        phone:           (fd.get('phone') as string || '').replace(/\D/g, '') || null,
        nss:             fd.get('nss') as string || null,
        salario_mensual: fd.get('salario_mensual') ? parseFloat(fd.get('salario_mensual') as string) : null,
        hora_entrada:    horaEntrada || null,
        hora_salida:     horaSalida  || null,
        dias_descanso:   diasDescanso,
        tipo_jornada:    tipoJornada,
        avatar_url,
      }

      if (selectedRole === 'operator') {
        const grua = fd.get('grua_asignada') as string
        payload.grua_asignada = grua || null
        payload.tow_truck_id  = grua || null
      } else {
        payload.grua_asignada = null
        payload.tow_truck_id  = null
      }

      const { error: updateErr } = await supabase.from('profiles').update(payload).eq('id', id)
      if (updateErr) throw new Error(updateErr.message)

      router.push('/dashboard/users')
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar.')
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="p-8 text-center text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/>
    </div>
  )

  if (!profile) return (
    <div className="p-8 text-center text-red-500 font-bold">{errorMsg}</div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/users" className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Modificar Perfil: {profile.full_name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            ID: <span className="font-mono text-xs bg-slate-100 px-1 rounded">{profile.id}</span>
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm border border-red-100 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── FOTO DE PERFIL ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Foto de Perfil</h3>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group flex-shrink-0 w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors flex items-center justify-center overflow-hidden"
            >
              {avatarPreview ? (
                <>
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Camera className="w-7 h-7 text-slate-400" />
                  <span className="text-xs text-slate-400">Subir foto</span>
                </div>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <div className="text-sm text-slate-500">
              <p className="font-medium text-slate-700">Foto del empleado</p>
              <p>JPG, PNG o WEBP. Máx. 5 MB.</p>
              {avatarPreview && <p className="text-green-600 mt-1">✓ Foto cargada</p>}
            </div>
          </div>
        </div>

        {/* ── DATOS PERSONALES ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Datos Personales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
              <input
                type="text" name="fullName" required
                defaultValue={profile.full_name}
                className="bg-white text-slate-900 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (Login)</label>
              <input
                type="tel" name="phone"
                defaultValue={profile.phone || ''}
                placeholder="5512345678"
                className="bg-white text-slate-900 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NSS (Número de Seguridad Social)</label>
              <input
                type="text" name="nss" maxLength={11}
                defaultValue={profile.nss || ''}
                placeholder="12345678901"
                className="bg-white text-slate-900 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Salario Mensual</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">$</span>
                <input
                  type="number" name="salario_mensual" min="0" step="0.01"
                  defaultValue={profile.salario_mensual || ''}
                  placeholder="0.00"
                  className="bg-white text-slate-900 w-full pl-7 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol de Acceso *</label>
              <select
                name="role" value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="bg-white text-slate-900 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Administrador</option>
                <option value="dispatcher">Despachador (Call Center)</option>
                <option value="operator">Operador / Chófer de Grúa</option>
              </select>
            </div>
          </div>

          {selectedRole === 'operator' && (
            <div className="mt-4 bg-slate-50 border border-slate-200 p-4 rounded-lg">
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-500"/>
                Asignación de Unidad
              </label>
              <select
                name="grua_asignada"
                defaultValue={profile.tow_truck_id || profile.grua_asignada || ''}
                className="mt-2 bg-white text-slate-900 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Sin Vehículo Asignado --</option>
                {towTrucks.map(truck => (
                  <option key={truck.id} value={truck.id}>
                    Eco: {truck.economic_number} | {truck.brand} - {truck.plates}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── JORNADA LABORAL ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-1">Jornada Laboral</h3>
          <p className="text-xs text-slate-500 mb-4">Edita el horario. Las horas laboradas se calculan automáticamente.</p>

          {selectedRole === 'operator' && (
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Jornada del Operador</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { val: 'normal', label: 'Normal', desc: 'Lun–Vie' },
                  { val: '24x24', label: '24 × 24', desc: '24h trabajo / 24h descanso' },
                  { val: '48h', label: '48 Horas', desc: '48h continuas' },
                  { val: '5x2', label: '5 × 2', desc: '5 días / 2 descanso' },
                ].map(j => (
                  <button
                    key={j.val} type="button"
                    onClick={() => setTipoJornada(j.val)}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 text-center transition-all ${
                      tipoJornada === j.val
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-sm">{j.label}</span>
                    <span className="text-xs mt-0.5">{j.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!(selectedRole === 'operator' && (tipoJornada === '24x24' || tipoJornada === '48h')) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Entrada</label>
                <input
                  type="time" value={horaEntrada}
                  onChange={e => setHoraEntrada(e.target.value)}
                  className="bg-white text-slate-900 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Salida</label>
                <input
                  type="time" value={horaSalida}
                  onChange={e => setHoraSalida(e.target.value)}
                  className="bg-white text-slate-900 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horas Laboradas / Turno</label>
                <div className={`w-full px-4 py-2.5 rounded-lg border text-center font-bold text-lg ${
                  horasLaboradas && horasLaboradas > 0
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  {horasLaboradas !== null && horasLaboradas > 0 ? `${horasLaboradas} hrs` : '--'}
                </div>
              </div>
            </div>
          )}

          {selectedRole === 'operator' && tipoJornada === '24x24' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mt-2">
              🔄 Jornada 24×24: 24 horas de servicio continuo, seguidas de 24 horas de descanso.
            </div>
          )}
          {selectedRole === 'operator' && tipoJornada === '48h' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700 mt-2">
              ⏱ Jornada 48 Horas: Turno continuo de 48 horas seguidas de descanso.
            </div>
          )}

          {!(tipoJornada === '24x24' || tipoJornada === '48h') && (
            <div className="mt-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Días de Descanso</label>
              <div className="flex gap-2 flex-wrap">
                {DIAS_SEMANA.map(dia => (
                  <button
                    key={dia.id} type="button"
                    onClick={() => toggleDia(dia.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                      diasDescanso.includes(dia.id)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
              {diasDescanso.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  Descansan: {diasDescanso.map(d => DIAS_SEMANA.find(x => x.id === d)?.label).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/users"
            className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
          >
            Cancelar
          </Link>
          <button
            type="submit" disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4"/>}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
