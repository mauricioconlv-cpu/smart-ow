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

export async function requestRegistration(prevState: any, formData: FormData) {
  const companyName = (formData.get('companyName') as string)?.trim()
  const fullName    = (formData.get('fullName') as string)?.trim()
  const email       = (formData.get('email') as string)?.trim().toLowerCase()
  const phone       = (formData.get('phone') as string)?.trim()
  const numTrucks   = parseInt(formData.get('numTrucks') as string) || 0
  const wantsTow    = formData.get('module_tow') === 'true'
  const wantsMedical = formData.get('module_medical') === 'true'

  if (!wantsTow && !wantsMedical) {
    return { error: 'Debes seleccionar al menos un módulo de operación.' }
  }

  if (!companyName || !fullName || !email || !phone) {
    return { error: 'Todos los campos son obligatorios.' }
  }

  const supabaseAdmin = createAdminClient()

  // Verificar si ya existe solicitud pendiente con ese email
  const { data: existingRequest } = await supabaseAdmin
    .from('registration_requests')
    .select('id')
    .eq('email', email)
    .eq('status', 'pending')
    .single()

  if (existingRequest) {
    return { error: 'Ya existe una solicitud pendiente con este correo. Espera a que sea revisada.' }
  }

  const { error: insertErr } = await supabaseAdmin
    .from('registration_requests')
    .insert({
      company_name: companyName,
      admin_name:   fullName,
      email,
      phone,
      num_trucks:   numTrucks,
      status:       'pending',
      wants_tow_module: wantsTow,
      wants_medical_module: wantsMedical,
    })

  if (insertErr) {
    return { error: `Error al enviar solicitud: ${insertErr.message}` }
  }

  return { success: true }
}

export async function approveRegistration(requestId: string) {
  const supabaseAdmin = createAdminClient()

  // Obtener la solicitud
  const { data: req, error: fetchErr } = await supabaseAdmin
    .from('registration_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchErr || !req) {
    return { error: 'No se encontró la solicitud.' }
  }

  // 1. Crear empresa
  const { data: company, error: companyErr } = await supabaseAdmin
    .from('companies')
    .insert({ 
      name: req.company_name,
      has_tow_module: req.wants_tow_module ?? true,
      has_medical_module: req.wants_medical_module ?? false
    })
    .select('id')
    .single()

  if (companyErr || !company) {
    return { error: `Error al crear empresa: ${companyErr?.message}` }
  }

  // 2. Crear usuario auth
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: req.email,
    password: req.password,
    email_confirm: true,
  })

  if (authErr || !authData.user) {
    await supabaseAdmin.from('companies').delete().eq('id', company.id)
    return { error: `Error al crear usuario: ${authErr?.message}` }
  }

  // 3. Crear perfil con role admin
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .insert({
      id:         authData.user.id,
      full_name:  req.admin_name,
      company_id: company.id,
      role:       'admin',
      phone:      req.phone,
    })

  if (profileErr) {
    return { error: `Error al crear perfil: ${profileErr.message}` }
  }

  // 4. Marcar solicitud como aprobada
  await supabaseAdmin
    .from('registration_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  revalidatePath('/dashboard/users')
  return { success: true, companyName: req.company_name, email: req.email }
}

export async function rejectRegistration(requestId: string) {
  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('registration_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/users')
  return { success: true }
}
