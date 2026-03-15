'use server'

import { redirect } from 'next/navigation'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Cliente de sesión normal
async function createSessionClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Cliente con service role (para crear usuarios admin)
function createAdminClient() {
  return createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function registerCompany(prevState: any, formData: FormData) {
  const companyName = (formData.get('companyName') as string)?.trim()
  const fullName    = (formData.get('fullName') as string)?.trim()
  const email       = (formData.get('email') as string)?.trim().toLowerCase()
  const password    = formData.get('password') as string
  const confirmPass = formData.get('confirmPassword') as string

  // Validaciones básicas
  if (!companyName || !fullName || !email || !password) {
    return { error: 'Todos los campos son obligatorios.' }
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }
  if (password !== confirmPass) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase      = await createSessionClient()
  const supabaseAdmin = createAdminClient()

  try {
    // 1. Crear la empresa (usar admin client para evitar bloqueo de RLS antes de que exista sesión)
    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies')
      .insert({ name: companyName })
      .select('id')
      .single()

    if (companyErr || !company) {
      return { error: `Error al crear empresa: ${companyErr?.message ?? 'desconocido'}` }
    }

    // 2. Crear usuario en Supabase Auth (con service role para confirmar email automáticamente)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authErr || !authData.user) {
      // Limpiar empresa creada (admin client para poder borrar sin sesión)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      return { error: `Error al crear cuenta: ${authErr?.message ?? 'desconocido'}` }
    }

    // 3. Insertar perfil del admin
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: fullName,
        company_id: company.id,
        role: 'admin',
      })

    if (profileErr) {
      return { error: `Error al crear perfil: ${profileErr.message}` }
    }

    // 4. Iniciar sesión con las credenciales recién creadas
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr) {
      return { error: 'Empresa creada. Inicia sesión manualmente en /login.' }
    }

  } catch (e: any) {
    return { error: e.message ?? 'Error inesperado.' }
  }

  redirect('/dashboard')
}
