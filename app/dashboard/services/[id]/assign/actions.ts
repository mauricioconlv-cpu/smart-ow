'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Traemos el helper de la otra acción para asegurar consistencia en la Bitácora
async function getProfileInfo(supabase: any, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, role, company_id')
    .eq('id', userId)
    .single()
  return data
}

export async function assignOperator(serviceId: string, operatorId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const profile = await getProfileInfo(supabase, user.id)
  if (!profile) return { error: 'Perfil no encontrado' }

  // 1. Asignar la grúa al servicio (estado oficial inicial: 'rumbo_contacto')
  const { error } = await supabase
    .from('services')
    .update({
      operator_id: operatorId,
      status: 'rumbo_contacto',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', serviceId)

  if (error) return { error: error.message }

  // 2. Registrar en la bitácora con la estructura correcta
  await supabase.from('service_logs').insert({
    service_id: serviceId,
    company_id: profile.company_id,
    created_by: user.id,
    type: 'assignment',
    note: `Grúa asignada exitosamente. Operador notificado.`,
    event_label: `🚚 Asignación Logística por ${profile.full_name}`,
    actor_role: profile.role,
  })

  // 3. Limpiar caché de Next.js
  revalidatePath('/dashboard/services')
  revalidatePath(`/dashboard/services/${serviceId}/capture`)
  
  return { success: true }
}


