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

// POST — Operador ingresa placas, se vincula al camión
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'operator') {
      return NextResponse.json({ error: 'Solo operadores pueden usar este endpoint.' }, { status: 403 })
    }

    const { plates } = await req.json()
    if (!plates) return NextResponse.json({ error: 'Placas requeridas.' }, { status: 400 })

    const normalizedPlates = plates.trim().toUpperCase()

    // Buscar grúa por placas (dentro de la misma empresa)
    const { data: truck, error: truckErr } = await supabase
      .from('tow_trucks')
      .select('id, unit_number, brand, model, plates, is_active')
      .ilike('plates', normalizedPlates)
      .eq('company_id', profile.company_id)
      .single()

    if (truckErr || !truck) {
      return NextResponse.json({
        error: `No se encontró ninguna grúa con placas "${normalizedPlates}" en tu empresa. Verifica e intenta de nuevo.`
      }, { status: 404 })
    }

    if (!truck.is_active) {
      return NextResponse.json({
        error: `La grúa ${truck.unit_number} (${truck.plates}) está en mantenimiento y no puede operar.`
      }, { status: 409 })
    }

    // Vincular: actualizar tow_truck_id y grua_asignada en profiles
    const adminClient = createAdminClient()

    // Primero, desvincular cualquier operador que tenga esta grúa asignada
    await adminClient
      .from('profiles')
      .update({ tow_truck_id: null })
      .eq('tow_truck_id', truck.id)

    // Luego vincular al operador actual
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({
        tow_truck_id: truck.id,
        grua_asignada: `${truck.unit_number} (${truck.plates})`,
      })
      .eq('id', user.id)

    if (profileErr) {
      return NextResponse.json({ error: 'Error al vincular grúa: ' + profileErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      truck: {
        id: truck.id,
        unit_number: truck.unit_number,
        brand: truck.brand,
        model: truck.model,
        plates: truck.plates,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}

// DELETE — Operador cierra sesión de la grúa al final del turno
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const adminClient = createAdminClient()
    await adminClient
      .from('profiles')
      .update({ tow_truck_id: null, grua_asignada: null })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
