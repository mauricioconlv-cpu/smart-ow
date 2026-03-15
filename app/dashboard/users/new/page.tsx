import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewUserForm from './NewUserForm'

export default async function NewUserPage() {
  const supabase = await createClient()

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

  let companies: { id: string; name: string }[] = []
  if (isSuperAdmin) {
    const { data } = await supabase.from('companies').select('id, name').order('name')
    companies = data || []
  }

  return <NewUserForm isSuperAdmin={isSuperAdmin} companies={companies} />
}
