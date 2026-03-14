'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Cliente con permiso total para crear usuarios sin cerrar la sesión actual
function createAdminClient() {
  return createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function inviteUserAction(formData: FormData) {
  const supabase      = await createClient()
  const supabaseAdmin = createAdminClient()

  const email    = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const role     = formData.get('role') as string
  const grua     = formData.get('grua') as string || null
  const overrideCompanyId = formData.get('companyId') as string

  // 1. Verificar permisos del usuario que hace la solicitud
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado.')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!currentProfile || !['admin', 'superadmin'].includes(currentProfile.role)) {
    throw new Error('Sin autorización para crear usuarios.')
  }

  // 2. Determinar company_id
  let targetCompanyId = overrideCompanyId
  if (currentProfile.role === 'admin') {
    targetCompanyId = currentProfile.company_id
  }
  if (!targetCompanyId) throw new Error('ID de empresa no válido.')

  // 3. Crear usuario con Admin API (no cierra la sesión actual)
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // confirma el email automáticamente
    user_metadata: { full_name: fullName },
  })

  if (authErr || !authData.user) {
    throw new Error(authErr?.message ?? 'Error al crear cuenta de acceso.')
  }

  // 4. Crear perfil en public.profiles
  const profilePayload: any = {
    id:         authData.user.id,
    company_id: targetCompanyId,
    role:       role,
    full_name:  fullName,
  }

  if (role === 'operator' && grua) {
    profilePayload.grua_asignada = grua
    profilePayload.tow_truck_id  = grua
  }

  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .insert(profilePayload)

  if (profileErr) {
    // Limpiar usuario creado si el perfil falla
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    throw new Error('Error al crear perfil: ' + profileErr.message)
  }

  revalidatePath('/dashboard/users')
  redirect('/dashboard/users')
}
