'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function addTowTruck(prevState: any, formData: FormData) {
  const supabase = await createClient()

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

  const tools = formData.getAll('tools') as string[]

  // Usar RPC con JSONB único para evitar validación de schema en parámetros individuales
  const { data: result, error } = await supabase.rpc('upsert_tow_truck', {
    payload: {
      company_id:      profile.company_id,
      brand:           formData.get('brand') as string,
      model:           formData.get('model') as string,
      serial_number:   (formData.get('serial_number') as string) || '',
      economic_number: formData.get('economic_number') as string,
      plates:          formData.get('plates') as string,
      unit_type:       (formData.get('unit_type') as string) || null,
      tools:           tools,
      photo_url:       (formData.get('photo_url') as string) || null,
    }
  })

  if (error) {
    console.error('Error adding tow truck:', error)
    return { error: `Error al registrar: ${error.message}` }
  }

  const res = result as any
  if (res?.error) return { error: res.error }

  revalidatePath('/dashboard/fleet')
  redirect('/dashboard/fleet')
}

export async function updateTowTruck(id: string, formData: FormData) {
  const supabase = await createClient()

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

  const { data: result, error } = await supabase.rpc('upsert_tow_truck', {
    payload: {
      id:              id,
      brand:           formData.get('brand') as string,
      model:           formData.get('model') as string,
      serial_number:   (formData.get('serial_number') as string) || '',
      economic_number: formData.get('economic_number') as string,
      plates:          formData.get('plates') as string,
      unit_type:       (formData.get('unit_type') as string) || null,
      tools:           tools,
      is_active:       formData.get('is_active') === 'true',
    }
  })

  if (error) {
    console.error('Error updating tow truck:', error)
    return { error: `Error al actualizar: ${error.message}` }
  }

  const res = result as any
  if (res?.error) return { error: res.error }

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

  const { error } = await supabase
    .from('tow_trucks')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/fleet')
  return { success: true }
}
