import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // 1. Validar sesión del admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!currentProfile || !['admin', 'superadmin'].includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Sin autorización para crear usuarios.' }, { status: 403 })
    }

    // 2. Extraer datos del body
    const body = await req.json()
    const {
      phone, password, fullName, role, nss,
      salario_mensual, grua, companyId,
      hora_entrada, hora_salida,
      dias_descanso, tipo_jornada,
    } = body

    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: 'Teléfono inválido. Mínimo 10 dígitos.' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 })
    }

    // 3. Email interno auto-generado a partir del teléfono
    const email = `${phone.replace(/\D/g, '')}@smarttow.internal`

    // 4. Determinar company_id
    let targetCompanyId = companyId
    if (currentProfile.role === 'admin') {
      targetCompanyId = currentProfile.company_id
    }
    if (!targetCompanyId) {
      return NextResponse.json({ error: 'ID de empresa no válido.' }, { status: 400 })
    }

    // 5. Crear usuario en auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authErr || !authData.user) {
      const msg = authErr?.message || 'Error al crear cuenta.'
      // Mensaje amigable si el email ya existe (teléfono duplicado)
      const friendly = msg.includes('already registered')
        ? 'Ya existe un usuario con ese número de teléfono.'
        : msg
      return NextResponse.json({ error: friendly }, { status: 400 })
    }

    const newUserId = authData.user.id

    // 6. Calcular horas laboradas
    let horas_laboradas: number | null = null
    if (hora_entrada && hora_salida) {
      const [eh, em] = hora_entrada.split(':').map(Number)
      const [sh, sm] = hora_salida.split(':').map(Number)
      let mins = (sh * 60 + sm) - (eh * 60 + em)
      if (mins < 0) mins += 24 * 60
      horas_laboradas = parseFloat((mins / 60).toFixed(2))
    }

    // 7. Crear perfil en public.profiles
    const profilePayload: any = {
      id:         newUserId,
      company_id: targetCompanyId,
      role,
      full_name:  fullName,
      phone,
      nss:        nss || null,
      salario_mensual: salario_mensual || null,
      hora_entrada:    hora_entrada || null,
      hora_salida:     hora_salida  || null,
      dias_descanso:   dias_descanso || [],
      tipo_jornada:    tipo_jornada || 'normal',
    }

    if (role === 'operator' && grua) {
      profilePayload.grua_asignada = grua
      profilePayload.tow_truck_id  = grua
    }

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert(profilePayload)

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: 'Error al crear perfil: ' + profileErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId: newUserId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 })
  }
}
