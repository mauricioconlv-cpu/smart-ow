'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Camera, User, Loader2, AlertTriangle, ChevronDown } from 'lucide-react'
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
  if (mins < 0) mins += 24 * 60 // turno nocturno
  return parseFloat((mins / 60).toFixed(2))
}

export default function NewUserClientForm({
  isSuperAdmin,
  companies,
}: {
  isSuperAdmin: boolean
  companies: { id: string; name: string }[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [selectedRole, setSelectedRole] = useState('dispatcher')
  const [diasDescanso, setDiasDescanso] = useState<string[]>(['sabado', 'domingo'])
  const [horaEntrada, setHoraEntrada] = useState('08:00')
  const [horaSalida, setHoraSalida] = useState('17:00')
  const [tipoJornada, setTipoJornada] = useState('normal')

  const horasLaboradas = calcularHoras(horaEntrada, horaSalida)

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
    setError('')

    const form = e.currentTarget
    const fd = new FormData(form)

    const phone    = (fd.get('phone') as string || '').replace(/\D/g, '')
    const password = fd.get('password') as string
    const fullName = fd.get('fullName') as string
    const role     = fd.get('role') as string
    const nss      = fd.get('nss') as string
    const salario  = fd.get('salario_mensual') as string
    const grua     = fd.get('grua') as string
    const companyId = fd.get('companyId') as string

    if (!phone || phone.length < 10) {
      setError('El número de teléfono debe tener al menos 10 dígitos.')
      setIsSaving(false)
      return
    }

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, password, fullName, role, nss,
          salario_mensual: salario ? parseFloat(salario) : null,
          grua: grua || null,
          companyId: companyId || null,
          hora_entrada: horaEntrada || null,
          hora_salida: horaSalida || null,
          dias_descanso: diasDescanso,
          tipo_jornada: tipoJornada,
        }),
      })

      const result = await res.json()
      if (!res.ok || result.error) throw new Error(result.error || 'Error al crear usuario.')

      const newUserId = result.userId

      // Subir avatar si existe
      if (avatarFile && newUserId) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${newUserId}/avatar.${ext}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })

        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', newUserId)
        }
      }

      router.push('/dashboard/users')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Error inesperado.')
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        <Link href="/dashboard/users" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevas Credenciales</h2>
          <p className="mt-1 text-sm text-gray-500">Registra un nuevo empleado. El acceso será por número de teléfono.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── FOTO DE PERFIL ── */}
        <div className="bg-white shadow rounded-xl p-6">
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="text-sm text-slate-500">
              <p className="font-medium text-slate-700">Foto del empleado</p>
              <p>JPG, PNG o WEBP. Máx. 5 MB.</p>
              <p className="mt-1 text-blue-600">Esta foto aparecerá en su bienvenida al iniciar sesión.</p>
            </div>
          </div>
        </div>

        {/* ── DATOS PERSONALES ── */}
        <div className="bg-white shadow rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Datos Personales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
              <input
                type="text" name="fullName" required
                placeholder="Ej. Juan Pérez García"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Teléfono (Usado para Iniciar Sesión) *
              </label>
              <input
                type="tel" name="phone" required
                placeholder="5512345678"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
              <p className="text-xs text-slate-500 mt-1">Este número será el usuario de acceso al sistema.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NSS (Número de Seguridad Social)</label>
              <input
                type="text" name="nss"
                placeholder="Ej. 12345678901"
                maxLength={11}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Provisional *</label>
              <input
                type="text" name="password" required
                placeholder="Genera una clave segura..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Salario Mensual</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm">$</span>
                <input
                  type="number" name="salario_mensual" min="0" step="0.01"
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── ROL Y EMPRESA ── */}
        <div className="bg-white shadow rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Rol y Acceso</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol en el Sistema *</label>
              <select
                name="role" required
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                {isSuperAdmin && <option value="admin">Administrador (Dueño de Empresa)</option>}
                <option value="dispatcher">Despachador (Call Center)</option>
                <option value="operator">Operador (Grúa)</option>
              </select>
            </div>

            {isSuperAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asignar a Empresa *</label>
                <select
                  name="companyId" required={isSuperAdmin}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="">Seleccione una empresa...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedRole === 'operator' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ID de Grúa (Opcional)</label>
                <input
                  type="text" name="grua"
                  placeholder="Ej. Unidad 04"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── JORNADA LABORAL ── */}
        <div className="bg-white shadow rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-1">Jornada Laboral</h3>
          <p className="text-xs text-slate-500 mb-4">Define el horario de trabajo. Las horas se calculan automáticamente.</p>

          {/* Tipo de jornada (especial para operadores) */}
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
                    key={j.val}
                    type="button"
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

          {/* Horas entrada/salida - solo para jornadas distintas a 24x24 y 48h */}
          {!(selectedRole === 'operator' && (tipoJornada === '24x24' || tipoJornada === '48h')) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Entrada</label>
                <input
                  type="time" name="hora_entrada"
                  value={horaEntrada}
                  onChange={e => setHoraEntrada(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Salida</label>
                <input
                  type="time" name="hora_salida"
                  value={horaSalida}
                  onChange={e => setHoraSalida(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              🔄 Jornada 24×24: 24 horas de servicio continuo, seguidas de 24 horas de descanso. El sistema alternará automáticamente.
            </div>
          )}
          {selectedRole === 'operator' && tipoJornada === '48h' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
              ⏱ Jornada 48 Horas: Turno continuo de 48 horas seguidas de descanso según acuerdo laboral.
            </div>
          )}

          {/* Días de descanso */}
          {!(tipoJornada === '24x24' || tipoJornada === '48h') && (
            <div className="mt-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Días de Descanso</label>
              <div className="flex gap-2 flex-wrap">
                {DIAS_SEMANA.map(dia => (
                  <button
                    key={dia.id}
                    type="button"
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

        {/* ── BOTÓN SUBMIT ── */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Creando credenciales...</>
          ) : (
            <><User className="w-5 h-5" /> Crear Credenciales</>
          )}
        </button>
      </form>
    </div>
  )
}
