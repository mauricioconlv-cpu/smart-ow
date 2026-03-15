import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Save, ArrowLeft } from 'lucide-react'

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

    const companyId  = profile.company_id
    const clientName = formData.get('name') as string

    // 1. Crear el cliente
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

    // 2. Construir el payload de costos
    const costs: Record<string, number> = {}

    for (const t of ['a', 'b', 'c', 'd']) {
      costs[`costo_local_tipo_${t}`] = parseFloat(formData.get(`costo_local_tipo_${t}`) as string) || 0
      costs[`costo_bande_tipo_${t}`] = parseFloat(formData.get(`costo_bande_tipo_${t}`) as string) || 0
      costs[`costo_km_tipo_${t}`]    = parseFloat(formData.get(`costo_km_tipo_${t}`) as string) || 0
    }

    const extraFields = [
      'costo_maniobra', 'costo_hora_espera', 'costo_abanderamiento', 'costo_resguardo',
      'costo_dollys', 'costo_patines', 'costo_go_jacks',
      'costo_rescate_subterraneo', 'costo_adaptacion',
      'costo_blindaje_1', 'costo_blindaje_2', 'costo_blindaje_3', 'costo_blindaje_4',
      'costo_blindaje_5', 'costo_blindaje_6', 'costo_blindaje_7', 'costo_kg_carga'
    ]
    for (const field of extraFields) {
      costs[field] = parseFloat(formData.get(field) as string) || 0
    }

    // 3. Insertar pricing_rule en nuevo formato (tipo=general)
    const { error: rulesErr } = await supabase.from('pricing_rules').insert({
      client_id:  newClient.id,
      company_id: companyId,
      tipo:       'general',
      costo_base: 0,
      costo_km:   0,
      ...costs,
    })

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
        {/* Nombre */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">Nombre de la Aseguradora o Cliente</label>
            <input type="text" name="name" id="name" required
              className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm"
              placeholder="Ej. Seguros AXA"/>
          </div>
        </div>

        {/* Costos por Tipo de Grúa */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Costo por Tipo de Grúa</h3>
          <p className="text-xs text-slate-500 mb-5">Cada tipo de unidad tiene su propio costo local fijo, banderazo foráneo y costo por kilómetro.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left pb-3 pr-6 text-xs font-bold text-slate-500 uppercase w-28">Tipo Grúa</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Costo Local (fijo)</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Banderazo Foráneo</th>
                  <th className="text-left pb-3 text-xs font-bold text-slate-500 uppercase">Costo / Km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { key: 'a', label: 'Tipo A', desc: '< 3.5 ton', color: 'text-green-700 bg-green-100' },
                  { key: 'b', label: 'Tipo B', desc: '3.5 – 7.5 ton', color: 'text-blue-700 bg-blue-100' },
                  { key: 'c', label: 'Tipo C', desc: '7.5 – 11 ton', color: 'text-orange-700 bg-orange-100' },
                  { key: 'd', label: 'Tipo D', desc: '> 11 ton', color: 'text-red-700 bg-red-100' },
                ].map(({ key, label, desc, color }) => (
                  <tr key={key}>
                    <td className="py-4 pr-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-sm ${color}`}>
                        {key.toUpperCase()}
                      </span>
                      <span className="block text-xs text-slate-400 mt-1 pl-1">{desc}</span>
                    </td>
                    <td className="py-4 pr-4">
                      <CurrencyInput name={`costo_local_tipo_${key}`} label="" placeholder="0.00" />
                    </td>
                    <td className="py-4 pr-4">
                      <CurrencyInput name={`costo_bande_tipo_${key}`} label="" placeholder="0.00" />
                    </td>
                    <td className="py-4">
                      <CurrencyInput name={`costo_km_tipo_${key}`} label="" placeholder="0.00" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

        {/* Especializados */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Servicios Especializados y Carga</h3>
          <p className="text-xs text-slate-500 mb-4">Rescate, adaptaciones, blindaje y carga por kilogramo.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CurrencyInput name="costo_rescate_subterraneo" label="Rescate Subterráneo"/>
            <CurrencyInput name="costo_adaptacion" label="Adaptación (desfleches, bateas, etc.)"/>
            <CurrencyInput name="costo_kg_carga" label="Kilogramo de Carga"/>
          </div>
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
