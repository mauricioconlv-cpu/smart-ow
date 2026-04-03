import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Status permitidos por tipo de servicio
const STATUS_FLOW: Record<string, string[]> = {
  medico_domicilio:    ['cotizacion','programado','rumbo_consulta','en_sitio','contacto_paciente','en_consulta','concluido','cancelado'],
  reparto_medicamento: ['cotizacion','programado','preparando','en_camino','entregado','concluido','cancelado'],
  telemedicina:        ['cotizacion','programado','en_consulta','concluido','cancelado'],
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

    const { serviceId, newStatus, notes } = await req.json()
    if (!serviceId || !newStatus) {
      return NextResponse.json({ error: 'serviceId y newStatus son requeridos.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Obtener el servicio actual
    const { data: svc, error: fetchErr } = await admin
      .from('medical_services')
      .select('id, status, service_type, company_id')
      .eq('id', serviceId)
      .single()

    if (fetchErr || !svc) return NextResponse.json({ error: 'Servicio no encontrado.' }, { status: 404 })

    // Validar que el status es válido para este tipo
    const allowed = STATUS_FLOW[svc.service_type] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({ error: `Status "${newStatus}" no válido para ${svc.service_type}.` }, { status: 400 })
    }

    // Actualizar status
    const updatePayload: Record<string, any> = { status: newStatus }
    if (notes?.trim()) updatePayload.follow_up_notes = notes.trim()

    const { error: updateErr } = await admin
      .from('medical_services')
      .update(updatePayload)
      .eq('id', serviceId)

    if (updateErr) {
      return NextResponse.json({ error: `Error al actualizar: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, newStatus })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
