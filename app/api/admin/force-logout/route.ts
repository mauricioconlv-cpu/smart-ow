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

// POST — Admin o Dispatcher-Supervisor fuerza cierre de turno de un operador
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    // Verificar rol y nivel del solicitante
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, supervisor_level, company_id, full_name')
      .eq('id', user.id)
      .single()

    if (!callerProfile) {
      return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 403 })
    }

    const isAdmin = callerProfile.role === 'admin' || callerProfile.role === 'superadmin'
    const isSupervisorDispatcher =
      callerProfile.role === 'dispatcher' && (callerProfile.supervisor_level ?? 0) >= 1

    if (!isAdmin && !isSupervisorDispatcher) {
      return NextResponse.json({
        error: 'Permiso denegado. Necesitas ser administrador o despachador supervisor.'
      }, { status: 403 })
    }

    const body = await req.json()
    const { operatorId } = body
    if (!operatorId) {
      return NextResponse.json({ error: 'operatorId requerido.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Verificar que el operador pertenece a la misma empresa (seguridad multi-tenant)
    const { data: opProfile } = await adminClient
      .from('profiles')
      .select('id, full_name, company_id, role, grua_asignada')
      .eq('id', operatorId)
      .single()

    if (!opProfile) {
      return NextResponse.json({ error: 'Operador no encontrado.' }, { status: 404 })
    }

    if (callerProfile.role !== 'superadmin' && opProfile.company_id !== callerProfile.company_id) {
      return NextResponse.json({ error: 'Permiso denegado: empresa distinta.' }, { status: 403 })
    }

    if (opProfile.role !== 'operator') {
      return NextResponse.json({ error: 'Solo se puede cerrar sesión de operadores.' }, { status: 400 })
    }

    // Limpiar vinculación de grúa
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ tow_truck_id: null, grua_asignada: null })
      .eq('id', operatorId)

    if (updateErr) {
      return NextResponse.json({ error: 'Error al cerrar sesión: ' + updateErr.message }, { status: 500 })
    }

    // Registrar en logs del sistema (si existen servicios activos del operador, este campo es informativo)
    console.log(`[ForceLogout] ${callerProfile.full_name} (${callerProfile.role}) cerró turno de ${opProfile.full_name} a las ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      operatorName: opProfile.full_name,
      gruaLiberada: opProfile.grua_asignada,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
