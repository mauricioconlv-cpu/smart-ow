'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteEmployee(userId: string) {
    const supabase = await createClient()

    // Invocar Procedimiento Almacenado Elevado (RPC)
    const { error } = await supabase.rpc('delete_user', { user_id: userId })
    
    if (error) {
        return { error: error.message }
    }

    revalidatePath('/dashboard/users')
    return { success: true }
}

export async function updateEmployee(userId: string, formData: FormData) {
    const supabase = await createClient()

    // 1. Validar Permisos (SuperAdmin o Admin)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No Autorizado.' }
    const { data: currentProfile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()
    if (!currentProfile || !['admin', 'superadmin'].includes(currentProfile.role)) {
        return { error: 'No tienes permisos para modificar usuarios.' }
    }

    // 2. Extracción Limpia de Formulario
    const fullName = formData.get('fullName') as string
    const role = formData.get('role') as string
    const grua_asignada = formData.get('grua_asignada') as string

    if (!fullName || !role) {
        return { error: 'Nombre de conductor y rol son obligatorios.' }
    }

    const payload: any = { full_name: fullName, role: role }
    
    if (role === 'operator') {
        payload.grua_asignada = grua_asignada ? grua_asignada : null
        payload.tow_truck_id = grua_asignada ? grua_asignada : null // Adaptación al nuevo paradigma
    } else {
        payload.grua_asignada = null
        payload.tow_truck_id = null
    }

    // 3. Ejecutar Update
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/dashboard/users')
    return { success: true }
}
