import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST — SuperAdmin resetea la contraseña de cualquier usuario
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!currentProfile || !['admin', 'superadmin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sin autorización.' }, { status: 403 })
    }

    const { targetUserId, newPassword, requestId } = await req.json()

    if (!targetUserId || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Datos inválidos. La contraseña debe tener al menos 6 caracteres.' }, { status: 400 })
    }

    // Verificar que el usuario target pertenece a la misma empresa
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', targetUserId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    // Admin solo puede resetear users de su empresa. SuperAdmin puede resetear cualquiera excepto otro superadmin.
    if (currentProfile.role === 'admin' && targetProfile.company_id !== currentProfile.company_id) {
      return NextResponse.json({ error: 'No puedes modificar usuarios de otra empresa.' }, { status: 403 })
    }
    if (targetProfile.role === 'superadmin' && currentProfile.role !== 'superadmin') {
      return NextResponse.json({ error: 'No puedes cambiar la clave de un SuperAdmin.' }, { status: 403 })
    }

    // Resetear contraseña con service role
    const adminClient = createAdminClient()
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    })

    if (updateErr) {
      return NextResponse.json({ error: 'Error al cambiar contraseña: ' + updateErr.message }, { status: 500 })
    }

    // Marcar solicitud como resuelta (si viene con requestId)
    if (requestId) {
      await adminClient
        .from('password_requests')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id })
        .eq('id', requestId)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
