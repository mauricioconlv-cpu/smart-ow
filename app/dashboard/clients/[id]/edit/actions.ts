'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateClientWithRates(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const clientId   = formData.get('clientId') as string
  const clientName = formData.get('name') as string
  if (!clientId) return { error: 'ID de cliente no encontrado' }

  const tipoFields = ['a', 'b', 'c', 'd']
  const costs: Record<string, number> = {}

  for (const t of tipoFields) {
    costs[`costo_local_tipo_${t}`] = parseFloat(formData.get(`costo_local_tipo_${t}`) as string) || 0
    costs[`costo_bande_tipo_${t}`] = parseFloat(formData.get(`costo_bande_tipo_${t}`) as string) || 0
    costs[`costo_km_tipo_${t}`]    = parseFloat(formData.get(`costo_km_tipo_${t}`) as string) || 0
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
    costs[field] = parseFloat(formData.get(field) as string) || 0
  }

  // 1. Actualizar nombre
  const { error: nameErr } = await supabase.from('clients').update({ name: clientName }).eq('id', clientId)
  if (nameErr) return { error: nameErr.message }

  // 2. Verificar si existen reglas de pricing
  const { data: existingRules } = await supabase
    .from('pricing_rules')
    .select('id')
    .eq('client_id', clientId)

  if (existingRules && existingRules.length > 0) {
    await supabase.from('pricing_rules').update(costs).eq('client_id', clientId)
  } else {
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    await supabase.from('pricing_rules').insert({
      client_id:  clientId,
      company_id: profile?.company_id,
      tipo:       'general',
      costo_base: 0,
      costo_km:   0,
      ...costs
    })
  }

  revalidatePath('/dashboard/clients')
  redirect('/dashboard/clients')
}
