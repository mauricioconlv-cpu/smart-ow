import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — SuperAdmin/Admin obtiene solicitudes pendientes de su empresa
export async function GET() {
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
      return NextResponse.json({ requests: [] })
    }

    const { data: requests, error } = await supabase
      .from('password_requests')
      .select(`
        id, status, created_at,
        profiles!password_requests_user_id_fkey ( id, full_name, phone, role )
      `)
      .eq('company_id', currentProfile.company_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ requests: requests || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Empleado crea una solicitud de cambio de contraseña
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 })

    // Superadmin no usa este flujo
    if (profile.role === 'superadmin') {
      return NextResponse.json({ error: 'Los SuperAdmin cambian su contraseña directamente.' }, { status: 400 })
    }

    // Verificar si ya tiene una solicitud pendiente
    const { data: existing } = await supabase
      .from('password_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Ya tienes una solicitud pendiente. Espera a que tu administrador la procese.' }, { status: 409 })
    }

    const { error: insertErr } = await supabase
      .from('password_requests')
      .insert({ user_id: user.id, company_id: profile.company_id })

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Solicitud enviada. Tu administrador recibirá la notificación.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — Admin deniega una solicitud
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { requestId } = await req.json()

    const { error } = await supabase
      .from('password_requests')
      .update({ status: 'denied', resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('id', requestId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
