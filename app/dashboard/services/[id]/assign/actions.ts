'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignOperator(serviceId: string, operatorId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('services')
    .update({
      operator_id: operatorId,
      status: 'rumbo_contacto',
    })
    .eq('id', serviceId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/services')
  return { success: true }
}
