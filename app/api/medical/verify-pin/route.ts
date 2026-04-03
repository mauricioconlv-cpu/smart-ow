import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { token, pin } = await req.json()
    if (!token || !pin) {
      return NextResponse.json({ error: 'Token y PIN requeridos.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Buscar el token
    const { data: tokenRow, error: tokenErr } = await admin
      .from('medical_service_tokens')
      .select('id, pin, pin_attempts, is_active, expires_at, service_id')
      .eq('token', token)
      .single()

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: 'Link inválido o no encontrado.' }, { status: 404 })
    }

    // Verificar si está activo y no expirado
    if (!tokenRow.is_active) {
      return NextResponse.json({ error: 'Este link ya no está disponible. El servicio fue concluido o cancelado.' }, { status: 403 })
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      await admin.from('medical_service_tokens').update({ is_active: false }).eq('id', tokenRow.id)
      return NextResponse.json({ error: 'Este link ha expirado (más de 48 horas).' }, { status: 403 })
    }

    // Verificar intentos fallidos (máx 5)
    if (tokenRow.pin_attempts >= 5) {
      return NextResponse.json({ error: 'Link bloqueado por demasiados intentos fallidos. Contacta al despachador.' }, { status: 403 })
    }

    // Verificar PIN
    if (tokenRow.pin !== String(pin).trim()) {
      // Incrementar intentos fallidos
      await admin
        .from('medical_service_tokens')
        .update({ pin_attempts: tokenRow.pin_attempts + 1 })
        .eq('id', tokenRow.id)

      const remaining = 4 - tokenRow.pin_attempts
      return NextResponse.json({
        error: `PIN incorrecto. Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.`,
        remaining,
      }, { status: 401 })
    }

    // PIN correcto — registrar acceso si es primera vez
    await admin
      .from('medical_service_tokens')
      .update({ accessed_at: new Date().toISOString(), pin_attempts: 0 })
      .eq('id', tokenRow.id)

    // Obtener datos del servicio
    const { data: service, error: svcErr } = await admin
      .from('medical_services')
      .select(`
        id, folio, folio_prefix, service_type, status,
        patient_name, patient_phone, patient_address, patient_coords,
        symptoms, scheduled_at, follow_up_notes,
        cobro_cliente, costo_consulta,
        diagnostico, tratamiento, medicamento_recetado,
        signos_vitales, notas_medico, firma_paciente_url, fotos_evidencia,
        doctor:medical_providers(full_name, specialty)
      `)
      .eq('id', tokenRow.service_id)
      .single()

    if (svcErr || !service) {
      return NextResponse.json({ error: 'No se pudo cargar el servicio.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, service, tokenId: tokenRow.id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
