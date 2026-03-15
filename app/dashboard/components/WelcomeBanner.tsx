import { createClient } from '@/lib/supabase/server'
import { User } from 'lucide-react'

export default async function WelcomeBanner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const roleLabels: Record<string, string> = {
    superadmin: 'CEO Multi-Tenant',
    admin:      'Administrador',
    dispatcher: 'Despachador',
    operator:   'Operador de Grúa',
  }

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-blue-100">
            <User className="w-5 h-5 text-blue-500" />
          </div>
        )}
      </div>
      {/* Saludo */}
      <div>
        <p className="text-sm font-semibold text-slate-800 leading-tight">
          ¡Bienvenido, {profile.full_name?.split(' ')[0] || 'Usuario'}! 👋
        </p>
        <p className="text-xs text-slate-500">
          {roleLabels[profile.role] || profile.role}
        </p>
      </div>
    </div>
  )
}
