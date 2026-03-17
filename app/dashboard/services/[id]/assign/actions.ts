'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignOperator(serviceId: string, operatorId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // 1. Obtener nombre del despachador
  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  
  const dispatcherName = prof?.full_name || 'Despachador'

  // 2. Asignar la grúa al servicio (cambiamos a 'asignado')
  const { error } = await supabase
    .from('services')
    .update({
      operator_id: operatorId,
      status: 'asignado',
    })
    .eq('id', serviceId)

  if (error) return { error: error.message }

  // 3. Registrar en la bitácora
  await supabase.from('service_logs').insert({
    service_id: serviceId,
    action: 'Asignación Logística',
    description: `Grúa asignada exitosamente. Estatus cambiado a "asignado".`,
    created_by: user.id,
    created_by_name: dispatcherName
  })

  // 4. Limpiar caché de Next.js
  revalidatePath('/dashboard/services')
  return { success: true }
}

