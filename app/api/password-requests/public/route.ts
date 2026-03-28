import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// ─── Cliente con Service Role (bypasses RLS) ────────────────────────────────
// Solo usado server-side para buscar usuario por teléfono sin sesión activa
function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * POST /api/password-requests/public
 * Permite a un operador SIN sesión solicitar ayuda de contraseña
 * Body: { phone: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Número de teléfono requerido.' }, { status: 400 })
    }

    const cleanPhone = String(phone).trim().replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Ingresa un número de teléfono válido (10 dígitos).' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Buscar el perfil por número de teléfono
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, company_id, phone')
      .eq('phone', cleanPhone)
      .single()

    if (profileError || !profile) {
      // Respuesta genérica para no revelar si el número existe
      return NextResponse.json({
        success: true,
        message: 'Si ese número está registrado, se enviará la solicitud a tu administrador.'
      })
    }

    // Solo operadores y empleados usan este flujo
    if (!['operator', 'dispatcher', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Este flujo es solo para operadores y empleados.' }, { status: 400 })
    }

    // 2. Verificar si ya tiene una solicitud pendiente
    const { data: existing } = await supabase
      .from('password_requests')
      .select('id, status')
      .eq('user_id', profile.id)
      .eq('status', 'pending')
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Ya tienes una solicitud pendiente. Tu administrador ya fue notificado, espera su respuesta.'
      })
    }

    // 3. Crear la solicitud
    const { error: insertError } = await supabase
      .from('password_requests')
      .insert({
        user_id: profile.id,
        company_id: profile.company_id,
        status: 'pending',
      })

    if (insertError) {
      console.error('[password-requests/public] insert error:', insertError)
      return NextResponse.json({ error: 'Error al crear la solicitud. Intenta de nuevo.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitud enviada correctamente. Tu administrador recibirá la notificación y te ayudará a restablecer tu contraseña.',
      employeeName: profile.full_name,
    })
  } catch (err: any) {
    console.error('[password-requests/public] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
