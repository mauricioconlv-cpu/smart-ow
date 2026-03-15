import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import SettingsForm from './SettingsForm'
import PasswordChangeSection from './PasswordChangeSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  const { data: company } = profile?.company_id ? await supabase
    .from('companies')
    .select('id, name, logo_url')
    .eq('id', profile.company_id)
    .single() : { data: null }

  const isSuperAdmin = profile?.role === 'superadmin'
  const canEdit      = isSuperAdmin || profile?.role === 'admin'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Configuración</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Identidad visual y seguridad de tu cuenta
          </p>
        </div>
      </div>

      {/* Logo de empresa (solo admin/superadmin) */}
      {canEdit && company ? (
        <SettingsForm
          companyId={company.id}
          companyName={company.name}
          currentLogoUrl={company.logo_url || null}
          isSuperAdmin={isSuperAdmin}
        />
      ) : (
        !canEdit && (
          <div className="glass-card p-6 text-slate-400 text-sm">
            Solo administradores pueden modificar la identidad de la empresa.
          </div>
        )
      )}

      {/* Cambio de contraseña (todos los usuarios) */}
      {profile && (
        <PasswordChangeSection
          role={profile.role}
          userId={user.id}
        />
      )}
    </div>
  )
}
