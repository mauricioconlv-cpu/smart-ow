'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateClientWithRates(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId   = formData.get('clientId') as string
  const clientName = formData.get('name') as string
  if (!clientId) return

  // Actualizar nombre del cliente
  await supabase.from('clients').update({ name: clientName }).eq('id', clientId)

  // Construir payload de costos
  const payload: Record<string, any> = { client_id: clientId }

  for (const t of ['a', 'b', 'c', 'd']) {
    payload[`costo_local_tipo_${t}`] = parseFloat(formData.get(`costo_local_tipo_${t}`) as string) || 0
    payload[`costo_bande_tipo_${t}`] = parseFloat(formData.get(`costo_bande_tipo_${t}`) as string) || 0
    payload[`costo_km_tipo_${t}`]    = parseFloat(formData.get(`costo_km_tipo_${t}`) as string) || 0
  }

  const extraFields = [
    'costo_maniobra', 'costo_hora_espera', 'costo_abanderamiento', 'costo_resguardo',
    'costo_dollys', 'costo_patines', 'costo_go_jacks',
    'costo_rescate_subterraneo', 'costo_adaptacion',
    'costo_blindaje_1', 'costo_blindaje_2', 'costo_blindaje_3', 'costo_blindaje_4',
    'costo_blindaje_5', 'costo_blindaje_6', 'costo_blindaje_7',
    'costo_kg_carga'
  ]
  for (const field of extraFields) {
    payload[field] = parseFloat(formData.get(field) as string) || 0
  }

  // Usar RPC para guardar: bypasea schema cache y migra formato viejo → nuevo
  const { data: result, error } = await supabase.rpc('upsert_client_rates', { payload })

  if (error) {
    console.error('RPC error saving client rates:', error.message)
  }

  const res = result as any
  if (res?.error) {
    console.error('Business error saving rates:', res.error)
  }

  revalidatePath('/dashboard/clients')
  redirect('/dashboard/clients')
}
