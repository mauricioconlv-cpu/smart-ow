import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Shield, MapPin, Truck, User, Phone, DollarSign, BarChart3 } from 'lucide-react'
import UserRowActions from './components/UserRowActions'
import PasswordRequestsPanel from './components/PasswordRequestsPanel'
import SuperadminAnalytics from './components/SuperadminAnalytics'
import RegistrationRequestsPanel from './components/RegistrationRequestsPanel'

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  // ── Superadmin: analytics + su propio equipo ────────────────────────
  if (currentProfile?.role === 'superadmin') {
    // Cargar el equipo de la empresa del superadmin (Proteo Forms, etc.)
    const { data: myTeam } = await supabase
      .from('profiles')
      .select(`
        id, full_name, role, phone, nss, avatar_url,
        salario_mensual, hora_entrada, hora_salida,
        tipo_jornada, dias_descanso, grua_asignada, created_at,
        companies ( name )
      `)
      .order('created_at', { ascending: false })

    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* ── Solicitudes de Registro (solo superadmin) ── */}
        <RegistrationRequestsPanel />

        {/* ── Panel de Plataforma ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-violet-600" />
                Panel de Plataforma
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Métricas agregadas por empresa · Los perfiles individuales son privados por diseño
              </p>
            </div>
          </div>
          <SuperadminAnalytics />
        </div>

        {/* ── Tu Equipo ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Tu Equipo
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">Gestiona los usuarios de tu propia empresa.</p>
            </div>
            <Link
              href="/dashboard/users/new"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo</span>
            </Link>
          </div>
          <PasswordRequestsPanel />
          <div className="bg-white shadow rounded-lg overflow-hidden mt-4">
            <ul role="list" className="divide-y divide-gray-200">
              {(!myTeam || myTeam.length === 0) ? (
                <li className="px-6 py-12 text-center text-gray-500">
                  No hay usuarios en tu empresa aún.
                </li>
              ) : (
                myTeam.map((profile) => {
                  const horasLaboradas = (() => {
                    if (!profile.hora_entrada || !profile.hora_salida) return null
                    const [eh, em] = (profile.hora_entrada as string).split(':').map(Number)
                    const [sh, sm] = (profile.hora_salida as string).split(':').map(Number)
                    let mins = (sh * 60 + sm) - (eh * 60 + em)
                    if (mins < 0) mins += 24 * 60
                    return (mins / 60).toFixed(1)
                  })()
                  return (
                    <li key={profile.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center space-x-4 min-w-0">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt={profile.full_name || 'Avatar'} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {profile.role === 'operator' ? <Truck className="h-5 w-5 text-slate-500" /> : <Shield className="h-5 w-5 text-slate-500" />}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-gray-900">
                              {profile.full_name || 'Usuario Anónimo'}
                              {user.id === profile.id && <span className="ml-2 text-xs text-blue-600 italic font-normal">(Tú)</span>}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                              <span>Empresa: {(profile.companies as any)?.name}</span>
                              {profile.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{profile.phone}</span>}
                              {profile.nss && <span className="text-slate-400">NSS: {profile.nss}</span>}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              {profile.hora_entrada && profile.hora_salida && (
                                <span className="text-slate-500">
                                  Turno: {(profile.hora_entrada as string).slice(0,5)} – {(profile.hora_salida as string).slice(0,5)}
                                  {horasLaboradas && ` (${horasLaboradas} hrs)`}
                                </span>
                              )}
                              {profile.salario_mensual && (
                                <span className="flex items-center gap-0.5 text-green-700 font-medium">
                                  <DollarSign className="h-3 w-3" />
                                  {Number(profile.salario_mensual).toLocaleString('es-MX', { minimumFractionDigits: 2 })}/mes
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                          {(() => {
                            const styles: Record<string,string> = { superadmin:'bg-purple-100 text-purple-800 border-purple-200', admin:'bg-blue-100 text-blue-800 border-blue-200', dispatcher:'bg-orange-100 text-orange-800 border-orange-200', operator:'bg-green-100 text-green-800 border-green-200' }
                            const labels: Record<string,string> = { superadmin:'CEO Multi-Tenant', admin:'Dueño de Empresa', dispatcher:'Despachador Call Center', operator:'Operador de Grúa' }
                            return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[profile.role] || styles.operator}`}>{labels[profile.role] || profile.role}</span>
                          })()}
                          {profile.role === 'operator' && profile.grua_asignada && (
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />Unidad: {profile.grua_asignada}
                            </span>
                          )}
                        </div>
                      </div>
                      <UserRowActions userId={profile.id} fullName={profile.full_name || 'Sin Nombre'} isSelf={user.id === profile.id} role={profile.role} />
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // ── Admin / Dispatcher: lista de usuarios de la empresa ─────────────
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      role,
      phone,
      nss,
      avatar_url,
      salario_mensual,
      hora_entrada,
      hora_salida,
      tipo_jornada,
      dias_descanso,
      grua_asignada,
      created_at,
      companies ( name )
    `)
    .order('created_at', { ascending: false })

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      superadmin: 'bg-purple-100 text-purple-800 border-purple-200',
      admin:      'bg-blue-100 text-blue-800 border-blue-200',
      dispatcher: 'bg-orange-100 text-orange-800 border-orange-200',
      operator:   'bg-green-100 text-green-800 border-green-200',
    }
    const labels: Record<string, string> = {
      superadmin: 'CEO Multi-Tenant',
      admin:      'Dueño de Empresa',
      dispatcher: 'Despachador Call Center',
      operator:   'Operador de Grúa',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[role] || styles.operator}`}>
        {labels[role] || role}
      </span>
    )
  }

  const getJornadaLabel = (tipo: string) => {
    const map: Record<string, string> = {
      normal: 'Normal',
      '24x24': '24 × 24',
      '48h':   '48 Horas',
      '5x2':   '5 días / 2 descanso',
    }
    return map[tipo] || tipo
  }

  const canInvite = currentProfile?.role === 'superadmin' || currentProfile?.role === 'admin'

  return (
    <div className="space-y-6">
      {/* Solicitudes de cambio de contraseña (solo visible para admin) */}
      {canInvite && <PasswordRequestsPanel />}

      <div className="flex justify-between items-center pb-4 border-b border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestión de Accesos</h2>
          <p className="mt-1 text-sm text-slate-400">
            {currentProfile?.role === 'superadmin'
              ? 'Panel maestro. Administra a los dueños de franquicias/empresas y permisos.'
              : 'Administra a tus operadores y personal de la central de despacho.'}
          </p>
        </div>
        {canInvite && (
          <Link
            href="/dashboard/users/new"
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Nuevas Credenciales</span>
          </Link>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <ul role="list" className="divide-y divide-gray-200">
          {(!profiles || profiles.length === 0) ? (
            <li className="px-6 py-12 text-center text-gray-500">
              No hay usuarios registrados aún en tu flotilla.
            </li>
          ) : (
            profiles.map((profile) => {
              const horasLaboradas = (() => {
                if (!profile.hora_entrada || !profile.hora_salida) return null
                const [eh, em] = (profile.hora_entrada as string).split(':').map(Number)
                const [sh, sm] = (profile.hora_salida as string).split(':').map(Number)
                let mins = (sh * 60 + sm) - (eh * 60 + em)
                if (mins < 0) mins += 24 * 60
                return (mins / 60).toFixed(1)
              })()

              return (
                <li key={profile.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Avatar + Nombre */}
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
                        {profile.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={profile.full_name || 'Avatar'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {profile.role === 'operator'
                              ? <Truck className="h-5 w-5 text-slate-500" />
                              : <Shield className="h-5 w-5 text-slate-500" />
                            }
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900">
                          {profile.full_name || 'Usuario Anónimo'}
                          {user.id === profile.id && (
                            <span className="ml-2 text-xs text-blue-600 italic font-normal">(Tú)</span>
                          )}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          {profile.role === 'superadmin'
                            ? <span>Sistema Smart Tow Global</span>
                            : <span>Empresa: {(profile.companies as any)?.name}</span>
                          }
                          {profile.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {profile.phone}
                            </span>
                          )}
                          {profile.nss && (
                            <span className="text-slate-400">NSS: {profile.nss}</span>
                          )}
                        </div>

                        {/* Jornada e info laboral */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {profile.hora_entrada && profile.hora_salida && (
                            <span className="text-slate-500">
                              Turno: {(profile.hora_entrada as string).slice(0,5)} – {(profile.hora_salida as string).slice(0,5)}
                              {horasLaboradas && ` (${horasLaboradas} hrs)`}
                            </span>
                          )}
                          {profile.tipo_jornada && profile.tipo_jornada !== 'normal' && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                              {getJornadaLabel(profile.tipo_jornada)}
                            </span>
                          )}
                          {profile.salario_mensual && (
                            <span className="flex items-center gap-0.5 text-green-700 font-medium">
                              <DollarSign className="h-3 w-3" />
                              {Number(profile.salario_mensual).toLocaleString('es-MX', { minimumFractionDigits: 2 })}/mes
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                      {getRoleBadge(profile.role)}
                      {profile.role === 'operator' && profile.grua_asignada && (
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Unidad: {profile.grua_asignada}
                        </span>
                      )}
                    </div>
                  </div>

                  {canInvite && (
                    <UserRowActions
                      userId={profile.id}
                      fullName={profile.full_name || 'Sin Nombre'}
                      isSelf={user.id === profile.id}
                      role={profile.role}
                    />
                  )}
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
