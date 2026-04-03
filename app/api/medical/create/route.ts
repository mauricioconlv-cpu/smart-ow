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

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export async function POST(req: NextRequest) {
  try {
    // Verificar que hay sesión activa (debe ser admin/dispatcher)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    // Obtener perfil y company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id && profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Sin empresa asignada.' }, { status: 403 })
    }

    const companyId = profile.company_id
    const body = await req.json()
    const {
      serviceType, patientName, patientPhone, patientAddress,
      symptoms, aseguradora, expediente, scheduledAt,
      cobroCliente, costoPago, costoMedicamento, costoEnvio, costoConsulta,
      providerId, newDoctor,
      costWasOverridden, overrideReason, costoOriginal, costOverride
    } = body

    if (!serviceType || !patientName?.trim()) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Si se registra un doctor nuevo, crearlo en el directorio
    let finalProviderId: string | null = providerId || null

    if (newDoctor && newDoctor.full_name) {
      const { data: newProv, error: provErr } = await admin
        .from('medical_providers')
        .insert({
          company_id:    companyId,
          full_name:     newDoctor.full_name,
          cedula:        newDoctor.cedula || null,
          phone:         newDoctor.phone,
          specialty:     newDoctor.specialty || 'Medicina General',
          state:         newDoctor.state || null,
          municipality:  newDoctor.municipality || null,
          service_types: newDoctor.service_types || [serviceType],
        })
        .select('id')
        .single()

      if (provErr) {
        console.error('Error creando proveedor:', provErr)
        return NextResponse.json({ error: 'Error al registrar el doctor.' }, { status: 500 })
      }
      finalProviderId = newProv.id
    }

    // Si hay modificación de costo justificada, la agregamos a las notas
    let initialNotes = null
    if (costWasOverridden && overrideReason) {
      initialNotes = `[${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}] ⚠️ COSTO TABULADO MODIFICADO
• Original: $${costoOriginal}
• Nuevo Costo: $${parseFloat(costOverride)}
• Usuario: ${user.email}
• Motivo: ${overrideReason}`
    }

    // 2. Crear el servicio médico
    // El trigger set_medical_folio asigna el folio y folio_prefix automáticamente
    const { data: service, error: svcErr } = await admin
      .from('medical_services')
      .insert({
        company_id:          companyId,
        service_type:        serviceType,
        folio:               0,        // placeholder — el trigger lo sobreescribe
        folio_prefix:        'MD',     // placeholder — el trigger lo sobreescribe
        status:              scheduledAt ? 'programado' : 'cotizacion',
        patient_name:        patientName.trim(),
        patient_phone:       patientPhone?.trim() || null,
        patient_address:     patientAddress?.trim() || null,
        symptoms:            symptoms?.trim() || null,
        aseguradora:         aseguradora?.trim() || null,
        numero_expediente:   expediente?.trim() || null,
        scheduled_at:        scheduledAt || null,
        cobro_cliente:       cobroCliente || 0,
        costo_pago_proveedor: costoPago || 0,
        costo_medicamento:   costoMedicamento || 0,
        costo_envio:         costoEnvio || 0,
        costo_consulta:      costoConsulta || 0,
        doctor_provider_id:  finalProviderId,
        created_by:          user.id,
        follow_up_notes:     initialNotes,
      })
      .select('id, folio, folio_prefix')
      .single()

    if (svcErr || !service) {
      console.error('Error creando servicio médico:', svcErr)
      return NextResponse.json({ error: `Error al crear el servicio: ${svcErr?.message}` }, { status: 500 })
    }

    // 3. Generar token + PIN
    const pin = generatePin()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: tokenRow, error: tokenErr } = await admin
      .from('medical_service_tokens')
      .insert({
        service_id: service.id,
        pin,
        expires_at: expiresAt,
        is_active:  true,
      })
      .select('token')
      .single()

    if (tokenErr || !tokenRow) {
      console.error('Error creando token:', tokenErr)
      // Servicio fue creado igual, solo no se pudo generar el link
      return NextResponse.json({
        error: 'Servicio creado pero falló la generación del link. Recarga e intenta de nuevo.',
      }, { status: 500 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smart-tow.vercel.app'
    const folioStr = `${service.folio_prefix}-${String(service.folio).padStart(4, '0')}`
    const link = `${siteUrl}/doc/${tokenRow.token}`

    return NextResponse.json({
      folio: folioStr,
      link,
      pin,
      serviceId: service.id,
    })

  } catch (err) {
    console.error('Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
