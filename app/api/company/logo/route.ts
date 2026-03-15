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

export async function POST(req: NextRequest) {
  try {
    // 1. Validar sesión (solo admins/superadmins)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sin autorización.' }, { status: 403 })
    }

    // 2. Extraer datos
    const { companyId, logo_url } = await req.json()

    // Verificar que el companyId coincide con el del admin (o es superadmin)
    if (profile.role !== 'superadmin' && profile.company_id !== companyId) {
      return NextResponse.json({ error: 'No puedes modificar otra empresa.' }, { status: 403 })
    }

    // 3. Actualizar con service role (sin restricciones RLS)
    const adminClient = createAdminClient()
    const { error: updateErr } = await adminClient
      .from('companies')
      .update({ logo_url })
      .eq('id', companyId)

    if (updateErr) {
      return NextResponse.json({ error: 'Error al guardar: ' + updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, logo_url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
