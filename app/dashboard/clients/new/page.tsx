import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Save, ArrowLeft } from 'lucide-react'

// Helper for a styled currency input
function CurrencyInput({ name, label, placeholder = '0.00' }: { name: string; label: string; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <div className="relative rounded-md shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <span className="text-slate-400 text-sm">$</span>
        </div>
        <input type="number" name={name} id={name} step="0.01" defaultValue="0"
          className="block w-full rounded-md border-0 py-2 pl-7 pr-3 text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-300 focus:ring-2 focus:ring-blue-600 text-sm bg-white shadow-sm"
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}

export default function NewClientPage() {
  
  async function createClientAction(formData: FormData) {
    'use server'
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return

    const companyId = profile.company_id
    const clientName = formData.get('name') as string

    // Tarifas base
    const localCost    = parseFloat(formData.get('localCost') as string) || 0
    const foraneoBase  = parseFloat(formData.get('foraneoBase') as string) || 0
    const foraneoKm    = parseFloat(formData.get('foraneoKm') as string) || 0

    // Costos por tipo de grúa
    const costoTipoA = parseFloat(formData.get('costo_tipo_a') as string) || 0
    const costoTipoB = parseFloat(formData.get('costo_tipo_b') as string) || 0
    const costoTipoC = parseFloat(formData.get('costo_tipo_c') as string) || 0
    const costoTipoD = parseFloat(formData.get('costo_tipo_d') as string) || 0

    // Costos adicionales
    const extras: Record<string, number> = {}
    const extraFields = [
      'costo_maniobra', 'costo_hora_espera', 'costo_abanderamiento', 'costo_resguardo',
      'costo_dollys', 'costo_patines', 'costo_go_jacks',
      'costo_rescate_subterraneo', 'costo_adaptacion',
      'costo_blindaje_1', 'costo_blindaje_2', 'costo_blindaje_3', 'costo_blindaje_4',
      'costo_blindaje_5', 'costo_blindaje_6', 'costo_blindaje_7',
      'costo_kg_carga'
    ]
    for (const field of extraFields) {
      extras[field] = parseFloat(formData.get(field) as string) || 0
    }

    // 1. Insert client
    const res = await supabase
      .from('clients')
      .insert({ name: clientName, company_id: companyId })
      .select('id')
      .single()

    const newClient = res.data as { id: string } | null
    if (res.error || !newClient) {
      console.error('Error creando cliente:', res.error?.message)
      return
    }

    // 2. Insert pricing rules (local + foraneo) with all cost fields
    const baseRule = {
      client_id: newClient.id,
      company_id: companyId,
      costo_tipo_a: costoTipoA,
      costo_tipo_b: costoTipoB,
      costo_tipo_c: costoTipoC,
      costo_tipo_d: costoTipoD,
      ...extras
    }

    const { error: rulesErr } = await supabase.from('pricing_rules').insert([
      { ...baseRule, tipo: 'local',   costo_base: localCost,  costo_km: 0 },
      { ...baseRule, tipo: 'foraneo', costo_base: foraneoBase, costo_km: foraneoKm }
    ])

    if (rulesErr) console.error('Error creando tarifas:', rulesErr.message)

    redirect('/dashboard/clients')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        <Link href="/dashboard/clients" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Registrar Nueva Aseguradora</h2>
          <p className="mt-1 text-sm text-gray-500">Define los tabuladores de cobro que el sistema usará para cotizar servicios.</p>
        </div>
      </div>

      <form action={createClientAction} className="space-y-8">
        {/* Información General */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">Nombre de la Aseguradora o Cliente</label>
            <input type="text" name="name" id="name" required
              className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm"
              placeholder="Ej. Seguros AXA"/>
          </div>
        </div>

        {/* Tarifas Base */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Tarifas Base de Arrastre</h3>
          <p className="text-xs text-slate-500 mb-4">Costo base local (fijo) y foráneo (banderazo + km).</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="localCost" className="block text-xs font-semibold text-slate-600 mb-1">Costo Local (MXN fijo)</label>
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-slate-400 text-sm">$</span>
                </div>
                <input type="number" name="localCost" id="localCost" step="0.01" required
                  className="block w-full rounded-md border-0 py-2.5 pl-7 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 text-sm bg-white shadow-sm"
                  placeholder="800.00"/>
              </div>
            </div>
            <div>
              <label htmlFor="foraneoBase" className="block text-xs font-semibold text-slate-600 mb-1">Banderazo Foráneo (MXN)</label>
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-slate-400 text-sm">$</span>
                </div>
                <input type="number" name="foraneoBase" id="foraneoBase" step="0.01" required
                  className="block w-full rounded-md border-0 py-2.5 pl-7 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 text-sm bg-white shadow-sm"
                  placeholder="500.00"/>
              </div>
            </div>
            <div>
              <label htmlFor="foraneoKm" className="block text-xs font-semibold text-slate-600 mb-1">Costo por Km (MXN)</label>
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-slate-400 text-sm">$</span>
                </div>
                <input type="number" name="foraneoKm" id="foraneoKm" step="0.01" required
                  className="block w-full rounded-md border-0 py-2.5 pl-7 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 text-sm bg-white shadow-sm"
                  placeholder="25.00"/>
              </div>
            </div>
          </div>
        </div>

        {/* Costos por Tipo de Grúa */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Costo por Tipo de Grúa</h3>
          <p className="text-xs text-slate-500 mb-4">Costo adicional según la categoría de la unidad asignada.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CurrencyInput name="costo_tipo_a" label="Tipo A (< 3.5 ton)" placeholder="0.00"/>
            <CurrencyInput name="costo_tipo_b" label="Tipo B (3.5–7.5 ton)" placeholder="0.00"/>
            <CurrencyInput name="costo_tipo_c" label="Tipo C (7.5–11 ton)" placeholder="0.00"/>
            <CurrencyInput name="costo_tipo_d" label="Tipo D (> 11 ton)" placeholder="0.00"/>
          </div>
        </div>

        {/* Costos de Operación */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Costos de Operación y Maniobras</h3>
          <p className="text-xs text-slate-500 mb-4">Cobros adicionales por maniobras especiales durante el servicio.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CurrencyInput name="costo_maniobra" label="Maniobra"/>
            <CurrencyInput name="costo_hora_espera" label="Hora de Espera"/>
            <CurrencyInput name="costo_abanderamiento" label="Abanderamiento"/>
            <CurrencyInput name="costo_resguardo" label="Resguardo"/>
          </div>
        </div>

        {/* Herramientas */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Costo por Herramientas</h3>
          <p className="text-xs text-slate-500 mb-4">Costo por el uso de equipo especializado de la grúa.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <CurrencyInput name="costo_dollys" label="Dollys"/>
            <CurrencyInput name="costo_patines" label="Patines"/>
            <CurrencyInput name="costo_go_jacks" label="Go Jacks"/>
          </div>
        </div>

        {/* Especialidades */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Servicios Especializados y Carga</h3>
          <p className="text-xs text-slate-500 mb-4">Rescate, adaptaciones, blindaje y carga por kilogramo.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CurrencyInput name="costo_rescate_subterraneo" label="Rescate Subterráneo"/>
            <CurrencyInput name="costo_adaptacion" label="Adaptación (desfleches, bateas, etc.)"/>
            <CurrencyInput name="costo_kg_carga" label="Kilogramo de Carga"/>
          </div>

          {/* Blindajes */}
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Niveles de Blindaje</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[1,2,3,4,5,6,7].map(n => (
                <CurrencyInput key={n} name={`costo_blindaje_${n}`} label={`Blindaje Nv. ${n}`}/>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-8">
          <Link href="/dashboard/clients" className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors">
            Cancelar
          </Link>
          <button type="submit"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors">
            <Save className="h-5 w-5"/>
            Guardar Aseguradora
          </button>
        </div>
      </form>
    </div>
  )
}
