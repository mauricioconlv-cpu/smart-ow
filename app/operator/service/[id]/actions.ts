'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function advanceServiceStatus(serviceId: string, nextStatus: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('services')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', serviceId)

  if (error) {
    console.error("Error advancing status:", error)
    return { success: false, error: error.message }
  }

  // Registrar en bitácora (Log Automático)
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
     await supabase.from('service_logs').insert({
       service_id: serviceId,
       created_by: user.id,
       type: 'system_note',
       note: `El operador actualizó el estado a: ${nextStatus}`
     })
  }

  revalidatePath(`/operator/service/${serviceId}`)
  revalidatePath('/dashboard/services') // También refrescar panel de call center
  return { success: true }
}
