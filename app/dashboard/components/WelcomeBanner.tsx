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
      <div className="relative flex-shrink-0 w-9 h-9 rounded-full overflow-hidden border border-white/10 shadow-lg"
           style={{ boxShadow: '0 0 12px rgba(59,130,246,0.3)' }}>
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-violet-600">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
        {/* Online dot */}
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-slate-900 rounded-full" />
      </div>

      {/* Info */}
      <div>
        <p className="text-sm font-semibold text-white leading-tight">
          ¡Hola, {profile.full_name?.split(' ')[0] || 'Usuario'} 👋
        </p>
        <p className="text-xs text-slate-400">
          {roleLabels[profile.role] || profile.role}
        </p>
      </div>
    </div>
  )
}
