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

  // 1. Actualizar nombre del cliente
  await supabase.from('clients').update({ name: clientName }).eq('id', clientId)

  // 2. Construir los costos
  const costs: Record<string, number> = {}
  for (const t of ['a', 'b', 'c', 'd', 'paso_corriente', 'cambio_llanta', 'gasolina']) {
    costs[`costo_local_tipo_${t}`] = parseFloat(formData.get(`costo_local_tipo_${t}`) as string) || 0
    costs[`costo_bande_tipo_${t}`] = parseFloat(formData.get(`costo_bande_tipo_${t}`) as string) || 0
    costs[`costo_km_tipo_${t}`]    = parseFloat(formData.get(`costo_km_tipo_${t}`) as string) || 0
  }
  for (const field of [
    'costo_maniobra', 'costo_hora_espera', 'costo_abanderamiento', 'costo_resguardo',
    'costo_dollys', 'costo_patines', 'costo_go_jacks', 
    'costo_pistola_impacto', 'costo_dardos', 'costo_bidon',
    'costo_rescate_subterraneo', 'costo_adaptacion',
    'costo_blindaje_1', 'costo_blindaje_2', 'costo_blindaje_3', 'costo_blindaje_4',
    'costo_blindaje_5', 'costo_blindaje_6', 'costo_blindaje_7', 'costo_kg_carga'
  ]) {
    costs[field] = parseFloat(formData.get(field) as string) || 0
  }

  // 3. SOLO UPDATE — el trigger SQL garantiza que pricing_rules SIEMPRE existe
  //    No se necesita INSERT ni DELETE desde el código
  await supabase
    .from('pricing_rules')
    .update({ tipo: 'general', ...costs })
    .eq('client_id', clientId)

  revalidatePath('/dashboard/clients')
  redirect('/dashboard/clients')
}
