'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function inviteUserAction(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const role = formData.get('role') as string
  const grua = formData.get('grua') as string
  const overrideCompanyId = formData.get('companyId') as string // Solo viene del superadmin

  // 1. Identificamos a quién está solicitando esto
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'superadmin' && currentProfile?.role !== 'admin') {
    throw new Error('Sin autorización.')
  }

  // 2. Determinamos el Company ID final para este nuevo usuario
  let targetCompanyId = overrideCompanyId;
  if (currentProfile.role === 'admin') {
     // Un Admin siempre registrará usuarios en su propia empresa, ignoramos lo que envíe el formulario por seguridad.
     targetCompanyId = currentProfile.company_id;
  }

  if (!targetCompanyId) {
     throw new Error('Imposible crear sin un ID de empresa válido.');
  }

  // 3. Crear Autenticación usando admin auth bypass (Service Role)
  // Como estamos en Next.js, lamentablemente el Supabase Auth standard no deja crear 
  // otros usuarios si hay uno logueado sin hacerle bypass de Admin API.
  // ¿Cómo creamos el auth internamente? Tenemos 2 opciones:
  // (A) Usar una Postgres Function con RPC que contenga la logica insertando directo a auth.users (No recomendado sin extensiones pgcrypto complejas).
  // (B) Usar el Supabase Service Role Key de este proyecto. (Opción Recomendada, pero Mauricio no nos dio la key)
  
  // SOLUCIÓN ALTERNATIVA (Edge Case): Llevaremos esto a un endpoint RPC que sí tiene seguridad de Postgres.
  // Al igual que inicializar el SaaS, la creación de Empleados del SaaS usará un RPC Postgres.
  
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_employee_account', {
    n_email: email,
    n_password: password,
    n_full_name: fullName,
    n_role: role,
    n_company_id: targetCompanyId,
    n_grua: grua || null
  })

  // Validar
  if (rpcError) {
     console.error("Employee Creation Error:", rpcError)
     // Si falla, es porque no la hemos inyectado a base de datos
     if (rpcError.message.includes("could not find the function")) {
          // Vamos a pedir a Mauricio que meta el SQL
          throw new Error("Falta instalar el Script RPC de create_employee_account en Supabase.")
     }
     throw new Error(rpcError.message)
  }

  redirect('/dashboard/users')
}
