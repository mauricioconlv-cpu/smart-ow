import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.company_id) {
    return (
      <div className="p-8 text-center text-slate-500">
        No tienes empresa asignada.
      </div>
    )
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, logo_url')
    .eq('id', profile.company_id)
    .single()

  const isSuperAdmin = profile.role === 'superadmin'
  const canEdit = isSuperAdmin || profile.role === 'admin'

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
            Personaliza la identidad visual de tu empresa
          </p>
        </div>
      </div>

      {canEdit ? (
        <SettingsForm
          companyId={company?.id || ''}
          companyName={company?.name || ''}
          currentLogoUrl={company?.logo_url || null}
          isSuperAdmin={isSuperAdmin}
        />
      ) : (
        <div className="glass-card p-6 text-slate-400 text-sm">
          Solo administradores pueden modificar la configuración de la empresa.
        </div>
      )}
    </div>
  )
}
