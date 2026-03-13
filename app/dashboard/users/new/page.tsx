import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { inviteUserAction } from './actions'

export default async function NewUserPage() {
  const supabase = await createClient()
  
  // Validamos rol antes de renderizar
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin' && profile?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        No tienes permisos para crear credenciales.
      </div>
    )
  }

  const isSuperAdmin = profile?.role === 'superadmin'

  // Si es superadmin, necesitamos cargar las Empresas para que elija a quién asignarle el usuario
  let companies: any[] = []
  if (isSuperAdmin) {
    const { data } = await supabase.from('companies').select('id, name').order('name')
    companies = data || []
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        <Link href="/dashboard/users" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevas Credenciales</h2>
          <p className="mt-1 text-sm text-gray-500">
            Registra a un nuevo empleado o dueño de empresa y envíale sus accesos.
          </p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <form action={inviteUserAction} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
              <input 
                type="text" 
                name="fullName" 
                required 
                placeholder="Ej. Juan Pérez"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico (Acceso)</label>
              <input 
                type="email" 
                name="email" 
                required 
                placeholder="juan@empresa.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Provisional</label>
              <input 
                type="text" 
                name="password" 
                required 
                placeholder="Genere una clave..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol en el Sistema</label>
              <select 
                name="role" 
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {/* Un Admin normal no puede crear superadmins ni otros admins (usualmente), pero demosle flexibilidad de rol 'admin' de sucursal. */}
                {isSuperAdmin && <option value="admin">Administrador (Dueño de Empresa)</option>}
                <option value="dispatcher">Despachador (Call Center)</option>
                <option value="operator">Operador (Grúa)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
             {isSuperAdmin && (
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Asignar a Empresa (SaaS)</label>
                  <select 
                    name="companyId" 
                    required={isSuperAdmin}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">Seleccione un inquilino...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
               </div>
             )}

             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ID de Grúa (Opcional - Solo Operadores)</label>
                <input 
                  type="text" 
                  name="grua" 
                  placeholder="Ej. Unidad 04"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
             </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Crear Credenciales
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
