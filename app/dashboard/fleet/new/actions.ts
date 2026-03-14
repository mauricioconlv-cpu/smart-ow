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
  const data = {
    company_id: profile.company_id,
    brand: formData.get('brand') as string,
    model: formData.get('model') as string,
    serial_number: formData.get('serial_number') as string,
    economic_number: formData.get('economic_number') as string,
    plates: formData.get('plates') as string,
    // Coordenadas simuladas de base/encendido
    current_lat: 19.4326,
    current_lng: -99.1332, 
    is_active: true
  }

  // 3. Insertar en BD
  const { error } = await supabase.from('tow_trucks').insert(data)

  if (error) {
    console.error('Error adding tow truck:', error)
    return { error: 'Error al registrar la grúa. Verifica que el número económico no exista.' }
  }

  revalidatePath('/dashboard/fleet')
  redirect('/dashboard/fleet')
}

export async function updateTowTruck(id: string, formData: FormData) {
  const supabase = await createClient()

  // 1. Obtener la compañía del administrador actual
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

  const payload = {
    brand: formData.get('brand') as string,
    model: formData.get('model') as string,
    serial_number: formData.get('serial_number') as string,
    economic_number: formData.get('economic_number') as string,
    plates: formData.get('plates') as string,
    is_active: formData.get('is_active') === 'true'
  }

  const { error } = await supabase.from('tow_trucks').update(payload).eq('id', id)
  if (error) return { error: error.message }
  
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

  // Si no se eliminó ninguna fila, RLS bloqueó silenciosamente la operación
  if (!deleted || deleted.length === 0) {
    return { error: 'No se pudo eliminar la grúa. Verifica que tus permisos de BD estén correctos (RLS).' }
  }

  revalidatePath('/dashboard/fleet')
  return { success: true }
}
