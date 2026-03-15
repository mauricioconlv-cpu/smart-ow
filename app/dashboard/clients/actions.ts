'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateClient(clientId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const name        = formData.get('name') as string
  const localCost   = parseFloat(formData.get('localCost') as string)
  const foraneoBase = parseFloat(formData.get('foraneoBase') as string)
  const foraneoKm   = parseFloat(formData.get('foraneoKm') as string)

  // 1. Actualizar nombre del cliente
  const { error: clientErr } = await supabase
    .from('clients')
    .update({ name })
    .eq('id', clientId)

  if (clientErr) return { error: clientErr.message }

  // 2. Actualizar tarifa local
  await supabase
    .from('pricing_rules')
    .update({ costo_base: localCost, costo_km: 0 })
    .eq('client_id', clientId)
    .eq('tipo', 'local')

  // 3. Actualizar tarifa foránea
  await supabase
    .from('pricing_rules')
    .update({ costo_base: foraneoBase, costo_km: foraneoKm })
    .eq('client_id', clientId)
    .eq('tipo', 'foraneo')

  revalidatePath('/dashboard/clients')
  redirect('/dashboard/clients')
}

export async function deleteClient(clientId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  // 1. Verificar si tiene servicios asociados antes de intentar borrar
  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if (count && count > 0) {
    return {
      error: `No se puede eliminar: este cliente tiene ${count} servicio${count === 1 ? '' : 's'} registrado${count === 1 ? '' : 's'} en el historial. Primero elimina o reasigna esos servicios.`
    }
  }

  // 2. Eliminar reglas de precio
  await supabase.from('pricing_rules').delete().eq('client_id', clientId)

  // 3. Eliminar cliente
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/clients')
  return { success: true }
}
