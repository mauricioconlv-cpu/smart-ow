import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Status permitidos por tipo
const STATUS_FLOW: Record<string, string[]> = {
  medico_domicilio:    ['cotizacion','programado','rumbo_consulta','en_sitio','contacto_paciente','en_consulta','concluido','cancelado'],
  reparto_medicamento: ['cotizacion','programado','preparando','en_camino','entregado','concluido','cancelado'],
  telemedicina:        ['cotizacion','programado','en_consulta','concluido','cancelado'],
}

/**
 * Esta API es llamada desde la página pública /doc/[token]
 * Autenticación: token + PIN enviados en el header Authorization como "Bearer token:pin"
 */
async function verifyTokenAuth(req: NextRequest, admin: ReturnType<typeof createAdminClient>) {
  const auth = req.headers.get('authorization') ?? ''
  const [, credentials] = auth.split('Bearer ')
  if (!credentials) return null

  const [token, pin] = credentials.split(':')
  if (!token || !pin) return null

  const { data: tokenRow } = await admin
    .from('medical_service_tokens')
    .select('id, pin, is_active, expires_at, service_id')
    .eq('token', token)
    .single()

  if (!tokenRow) return null
  if (!tokenRow.is_active) return null
  if (new Date(tokenRow.expires_at) < new Date()) return null
  if (tokenRow.pin !== pin) return null

  return tokenRow
}

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const tokenRow = await verifyTokenAuth(req, admin)

    if (!tokenRow) {
      return NextResponse.json({ error: 'Acceso no autorizado.' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    // ── Acción: actualizar status ────────────────────────────────────────
    if (action === 'update_status') {
      const { newStatus } = body

      const { data: svc } = await admin
        .from('medical_services')
        .select('service_type')
        .eq('id', tokenRow.service_id)
        .single()

      if (!svc) return NextResponse.json({ error: 'Servicio no encontrado.' }, { status: 404 })

      const allowed = STATUS_FLOW[svc.service_type] ?? []
      if (!allowed.includes(newStatus)) {
        return NextResponse.json({ error: 'Status no válido.' }, { status: 400 })
      }

      await admin
        .from('medical_services')
        .update({ status: newStatus })
        .eq('id', tokenRow.service_id)

      return NextResponse.json({ success: true })
    }

    // ── Acción: actualizar GPS del doctor ────────────────────────────────
    if (action === 'update_gps') {
      const { lat, lng } = body
      if (!lat || !lng) return NextResponse.json({ error: 'lat y lng requeridos.' }, { status: 400 })

      await admin
        .from('medical_services')
        .update({ doctor_lat: lat, doctor_lng: lng })
        .eq('id', tokenRow.service_id)

      return NextResponse.json({ success: true })
    }

    // ── Acción: guardar formulario médico ────────────────────────────────
    if (action === 'save_form') {
      const { 
        diagnostico, tratamiento, medicamento_recetado, signos_vitales, notas_medico,
        anamnesis, exploracion_fisica, patient_weight, patient_height
      } = body

      await admin
        .from('medical_services')
        .update({
          diagnostico:          diagnostico ?? null,
          tratamiento:          tratamiento ?? null,
          medicamento_recetado: medicamento_recetado ?? null,
          signos_vitales:       signos_vitales ?? null,
          notas_medico:         notas_medico ?? null,
          anamnesis:            anamnesis ?? null,
          exploracion_fisica:   exploracion_fisica ?? null,
          patient_weight:       patient_weight ?? null,
          patient_height:       patient_height ?? null,
        })
        .eq('id', tokenRow.service_id)

      return NextResponse.json({ success: true })
    }

    // ── Acción: guardar URL de foto ──────────────────────────────────────
    if (action === 'add_photo') {
      const { photoUrl } = body
      if (!photoUrl) return NextResponse.json({ error: 'photoUrl requerida.' }, { status: 400 })

      // Append a fotos_evidencia array
      const { data: current } = await admin
        .from('medical_services')
        .select('fotos_evidencia')
        .eq('id', tokenRow.service_id)
        .single()

      const existing = current?.fotos_evidencia ?? []
      await admin
        .from('medical_services')
        .update({ fotos_evidencia: [...existing, photoUrl] })
        .eq('id', tokenRow.service_id)

      return NextResponse.json({ success: true })
    }

    // ── Acción: guardar firma digital ────────────────────────────────────
    if (action === 'save_signature') {
      const { signatureUrl, type = 'paciente' } = body
      if (!signatureUrl) return NextResponse.json({ error: 'signatureUrl requerida.' }, { status: 400 })

      const column = type === 'medico' ? 'firma_medico_url' : 'firma_paciente_url'

      await admin
        .from('medical_services')
        .update({ [column]: signatureUrl })
        .eq('id', tokenRow.service_id)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
