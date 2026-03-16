'use server'

import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function createAdminClient() {
  return createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function approveRegistration(requestId: string) {
  const supabaseAdmin = createAdminClient()

  const { data: req, error: fetchErr } = await supabaseAdmin
    .from('registration_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchErr || !req) return { error: 'No se encontró la solicitud.' }

  // 1. Crear empresa
  const { data: company, error: companyErr } = await supabaseAdmin
    .from('companies')
    .insert({ name: req.company_name })
    .select('id')
    .single()

  if (companyErr || !company) return { error: `Error al crear empresa: ${companyErr?.message}` }

  // 2. Invitar al usuario por email (Supabase envía correo con link para establecer contraseña)
  const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    req.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smart-ow.vercel.app'}/auth/set-password`,
      data: { full_name: req.admin_name },
    }
  )

  if (inviteErr || !inviteData.user) {
    await supabaseAdmin.from('companies').delete().eq('id', company.id)
    return { error: `Error al enviar invitación: ${inviteErr?.message}` }
  }

  // 3. Crear perfil con role admin
  await supabaseAdmin.from('profiles').insert({
    id:         inviteData.user.id,
    full_name:  req.admin_name,
    company_id: company.id,
    role:       'admin',
    phone:      req.phone,
  })

  // 4. Marcar solicitud como aprobada
  await supabaseAdmin
    .from('registration_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  revalidatePath('/dashboard/users')
  return { success: true }
}

export async function rejectRegistration(requestId: string) {
  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('registration_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/users')
  return { success: true }
}
