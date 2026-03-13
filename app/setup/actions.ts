'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function setupSuperAdmin(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const companyName = formData.get('companyName') as string

  if (!email || !password || !fullName || !companyName) {
    return { error: 'Por favor llena todos los campos.' }
  }

  // 0. Usamos el Service Role Key internamente para bypass RLS, o dado que la BD está vacía,
  // podríamos usar el Anon Key si tuvieramos permisos pubilcos para consultar.
  // Pero lo ideal es que hagamos la validación.
  const supabase = await createClient()

  // 1. La seguridad se gestionará internamente a través del RPC de PostgreSQL
  // que es "Security Definer" y bloquea cualquier intento de recrear empresas si ya hay una.

  // 2. Crear al usuario de Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      }
    }
  })

  if (authError || !authData.user) {
    return { error: authError?.message || 'Error al crear la cuenta en Auth.' }
  }

  // 3. Implicar a la Base de Datos para que ejecute el RPC de inicialización
  // El usuario ya existe en Auth, por lo que la función RPC detectará su ID al llamarla.
  const { data: rpcData, error: rpcError } = await supabase.rpc('setup_initial_tenant', {
    new_company_name: companyName,
    user_full_name: fullName
  })

  // 4. Si falló la inserción SaaS (ej. ya existía empresa), la info en auth queda huerfana
  // pero garantizamos que no viole el sistema aislando el error.
  if (rpcError || (rpcData as any)?.error) {
    console.error("RPC Setup Error:", rpcError || (rpcData as any)?.error);
    return { error: (rpcData as any)?.error || 'Error interno al configurar el Tenant (Empresa). Asegúrese de haber ejecutado setup_rpc.sql en Supabase.' }
  }

  // 5. Setup Exitoso, Redirigir al panel de control (donde ahora es Súper Admin)
  redirect('/dashboard')
}
