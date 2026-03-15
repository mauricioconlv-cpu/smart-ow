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

  // 2. Construir los costos del nuevo formato
  const costs: Record<string, number> = {}
  for (const t of ['a', 'b', 'c', 'd']) {
    costs[`costo_local_tipo_${t}`] = parseFloat(formData.get(`costo_local_tipo_${t}`) as string) || 0
    costs[`costo_bande_tipo_${t}`] = parseFloat(formData.get(`costo_bande_tipo_${t}`) as string) || 0
    costs[`costo_km_tipo_${t}`]    = parseFloat(formData.get(`costo_km_tipo_${t}`) as string) || 0
  }
  for (const field of [
    'costo_maniobra', 'costo_hora_espera', 'costo_abanderamiento', 'costo_resguardo',
    'costo_dollys', 'costo_patines', 'costo_go_jacks',
    'costo_rescate_subterraneo', 'costo_adaptacion',
    'costo_blindaje_1', 'costo_blindaje_2', 'costo_blindaje_3', 'costo_blindaje_4',
    'costo_blindaje_5', 'costo_blindaje_6', 'costo_blindaje_7', 'costo_kg_carga'
  ]) {
    costs[field] = parseFloat(formData.get(field) as string) || 0
  }

  // 3. Obtener company_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) return

  // 4. ELIMINAR todas las reglas viejas (cualquier tipo: local, foraneo, general)
  //    e insertar UNA sola regla en el nuevo formato. Esto es lo que migra datos viejos.
  await supabase.from('pricing_rules').delete().eq('client_id', clientId)

  // 5. Insertar la nueva regla unificada (tipo=general)
  const { error: insertErr } = await supabase.from('pricing_rules').insert({
    client_id:  clientId,
    company_id: profile.company_id,
    tipo:       'general',
    costo_base: 0,
    costo_km:   0,
    ...costs,
  })

  if (insertErr) {
    console.error('Error guardando tarifas:', insertErr.message)
  }

  revalidatePath('/dashboard/clients')
  redirect('/dashboard/clients')
}
