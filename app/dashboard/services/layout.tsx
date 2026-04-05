import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ServicesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (profile?.company_id && profile.role !== 'superadmin') {
    const { data: company } = await supabase
      .from('companies')
      .select('has_tow_module')
      .eq('id', profile.company_id)
      .single()

    if (company && company.has_tow_module === false) {
      redirect('/dashboard') // Redireccionar si no tienen el módulo contratado
    }
  }

  return <>{children}</>
}
