'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { logClockIn } from '@/lib/attendance'

function createAnonymousClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const anonClient = createAnonymousClient()

  const phone    = (formData.get('phone') as string || '').trim().replace(/\D/g, '')
  const password = formData.get('password') as string

  if (!phone || !password) {
    redirect(`/login?message=${encodeURIComponent('Teléfono y contraseña son obligatorios.')}`)
  }

  // 1. Buscar el email interno asociado al número telefónico via RPC
  const { data: email, error: rpcError } = await anonClient.rpc('get_email_by_phone', { p_phone: phone })

  if (rpcError || !email) {
    redirect(`/login?message=${encodeURIComponent('Número de teléfono no registrado en el sistema.')}`)
  }

  // 2. Autenticar con el email interno + contraseña
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email as string,
    password,
  })

  if (authError) {
    // Mensaje amigable en español
    const msg = authError.message.toLowerCase().includes('invalid')
      ? 'Contraseña incorrecta. Verifica e intenta de nuevo.'
      : authError.message
    redirect(`/login?message=${encodeURIComponent(msg)}`)
  }

  // Si login exitoso, registrar entrada del empleado en Asistencia (solo despachadores u operadores, no admin)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    // pasamos supabase client con los permisos de autenticacion del usuario que acaba de entrar
    await logClockIn(supabase, user.id)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
