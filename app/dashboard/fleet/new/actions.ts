'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function addTowTruck(prevState: any, formData: FormData) {
  const supabase = await createClient()

  // 1. Obtener la compañía del administrador actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    return { error: 'No tienes permisos para agregar unidades.' }
  }

  // 2. Extraer datos del formulario
  const tools = formData.getAll('tools') as string[]

  // 3. Usar RPC para evitar el problema del schema cache de PostgREST
  const { data: result, error } = await supabase.rpc('rpc_insert_tow_truck', {
    p_company_id:      profile.company_id,
    p_brand:           formData.get('brand') as string,
    p_model:           formData.get('model') as string,
    p_serial_number:   (formData.get('serial_number') as string) || '',
    p_economic_number: formData.get('economic_number') as string,
    p_plates:          formData.get('plates') as string,
    p_unit_type:       (formData.get('unit_type') as string) || null,
    p_tools:           tools.length > 0 ? tools : [],
    p_current_lat:     19.4326,
    p_current_lng:     -99.1332,
  })

  if (error) {
    console.error('RPC error adding tow truck:', error)
    return { error: `Error al registrar: ${error.message}` }
  }

  const res = result as any
  if (res?.error) {
    return { error: res.error }
  }

  revalidatePath('/dashboard/fleet')
  redirect('/dashboard/fleet')
}

export async function updateTowTruck(id: string, formData: FormData) {
  const supabase = await createClient()

  // 1. Verificar permisos
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    return { error: 'No tienes permisos para modificar unidades.' }
  }

  const tools = formData.getAll('tools') as string[]

  // 2. Usar RPC para evitar el schema cache de PostgREST
  const { data: result, error } = await supabase.rpc('rpc_update_tow_truck', {
    p_id:              id,
    p_brand:           formData.get('brand') as string,
    p_model:           formData.get('model') as string,
    p_serial_number:   (formData.get('serial_number') as string) || '',
    p_economic_number: formData.get('economic_number') as string,
    p_plates:          formData.get('plates') as string,
    p_unit_type:       (formData.get('unit_type') as string) || null,
    p_tools:           tools.length > 0 ? tools : [],
    p_is_active:       formData.get('is_active') === 'true',
  })

  if (error) {
    console.error('RPC error updating tow truck:', error)
    return { error: `Error al actualizar: ${error.message}` }
  }

  const res = result as any
  if (res?.error) {
    return { error: res.error }
  }

  revalidatePath('/dashboard/fleet')
  return { success: true }
}

export async function deleteTowTruck(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    return { error: 'Acción denegada por seguridad.' }
  }

  const { data: deleted, error } = await supabase
    .from('tow_trucks')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }

  if (!deleted || deleted.length === 0) {
    return { error: 'No se pudo eliminar la grúa. Verifica que tus permisos de BD estén correctos (RLS).' }
  }

  revalidatePath('/dashboard/fleet')
  return { success: true }
}
