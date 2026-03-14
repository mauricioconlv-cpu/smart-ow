import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Shield, MapPin, Truck } from 'lucide-react'
import UserRowActions from './components/UserRowActions'

export default async function UsersPage() {
  const supabase = await createClient()
  
  // Obtenemos el perfil activo para validar su rol.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  // Lista de usuarios correspondientes a la empresa (o todos si es superadmin)
  // Nota: Gracias al RLS que diseñamos en schema.sql, `supabase.from('profiles').select()`
  // SOLO DEVOLVERA los perfiles de su propia empresa (o todos si es superadmin).
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      role,
      grua_asignada,
      created_at,
      companies ( name )
    `)
    .order('created_at', { ascending: false })

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      superadmin: 'bg-purple-100 text-purple-800 border-purple-200',
      admin: 'bg-blue-100 text-blue-800 border-blue-200',
      dispatcher: 'bg-orange-100 text-orange-800 border-orange-200',
      operator: 'bg-green-100 text-green-800 border-green-200'
    }
    const labels: Record<string, string> = {
      superadmin: 'CEO Multi-Tenant',
      admin: 'Dueño de Empresa',
      dispatcher: 'Despachador Call Center',
      operator: 'Operador de Grúa'
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[role] || styles.operator}`}>
        {labels[role] || role}
      </span>
    )
  }

  // Un Despachador u Operador no deberían poder entrar aquí, esto sería re-bloqueado por middleware o UI state.
  const canInvite = currentProfile?.role === 'superadmin' || currentProfile?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Accesos</h2>
          <p className="mt-1 text-sm text-gray-500">
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
            profiles.map((profile) => (
              <li key={profile.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                     <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 mt-1">
                        {profile.role === 'operator' ? <Truck className="h-5 w-5 text-slate-500" /> : <Shield className="h-5 w-5 text-slate-500" />}
                     </div>
                     <div>
                        <h3 className="text-sm font-bold text-gray-900">
                          {profile.full_name || 'Usuario Anónimo'}
                          {user.id === profile.id && <span className="ml-2 text-xs text-blue-600 italic font-normal">(Tú)</span>}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                           {profile.role === 'superadmin' 
                              ? <span>Sistema Smart Tow Global</span>
                              : <span>Empresa: {(profile.companies as any)?.name}</span>}
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-2">
                    {getRoleBadge(profile.role)}
                    {profile.role === 'operator' && profile.grua_asignada && (
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Unidad asignada: {profile.grua_asignada}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Nuevos Botones de Control Empleado */}
                {canInvite && (
                   <UserRowActions 
                      userId={profile.id} 
                      fullName={profile.full_name || 'Sin Nombre'} 
                      isSelf={user.id === profile.id}
                      role={profile.role}
                   />
                )}

              </li>
            ))
          )}
        </ul>
      </div>

    </div>
  )
}
