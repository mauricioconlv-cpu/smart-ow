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

// POST — Operador ingresa placas para vincular grúa
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'operator') {
      return NextResponse.json({ error: 'Solo operadores pueden usar este endpoint.' }, { status: 403 })
    }

    const body = await req.json()
    const plates = (body.plates || '').trim().toUpperCase()
    if (!plates) return NextResponse.json({ error: 'Placas requeridas.' }, { status: 400 })

    // Normalizamos las placas ingresadas quitando todos los espacios
    const normalizedInput = plates.replace(/\s+/g, '')

    // Buscar grúa por placas — obtenemos todas para filtrar en JS inmune a espacios
    // Usamos service role para saltarnos RLS
    const adminClient = createAdminClient()
    const { data: allTrucks, error: searchErr } = await adminClient
      .from('tow_trucks')
      .select('id, economic_number, brand, model, plates, is_active')

    if (searchErr || !allTrucks) {
      return NextResponse.json({ error: `Error DB: ${searchErr?.message || 'sin datos'}` }, { status: 500 })
    }

    const truck = allTrucks.find(t => {
      const dbPlate = (t.plates || '').toUpperCase().replace(/\s+/g, '')
      return dbPlate === normalizedInput
    })

    if (!truck) {
      return NextResponse.json({
        error: `No se encontró ninguna grúa con placas "${plates}" en la flotilla. Verifica e intenta de nuevo.`
      }, { status: 404 })
    }

    if (!truck.is_active) {
      return NextResponse.json({
        error: `La grúa ${truck.economic_number} (${truck.plates}) está en mantenimiento y no puede operar.`
      }, { status: 409 })
    }

    // Desvincular cualquier operador previo que tenga esta grúa
    await adminClient
      .from('profiles')
      .update({ tow_truck_id: null, grua_asignada: null })
      .eq('tow_truck_id', truck.id)

    // Vincular al operador actual
    const grua_label = `${truck.economic_number} (${truck.plates})`
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({
        tow_truck_id: truck.id,
        grua_asignada: grua_label,
      })
      .eq('id', user.id)

    if (profileErr) {
      return NextResponse.json({ error: 'Error al vincular grúa: ' + profileErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      truck: {
        id: truck.id,
        economic_number: truck.economic_number,
        brand: truck.brand,
        model: truck.model,
        plates: truck.plates,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}

// DELETE — Operador cierra turno, desvincula su grúa
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
