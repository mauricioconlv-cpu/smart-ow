import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Save, ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

function CurrencyInput({ name, label, defaultValue = 0 }: { name: string; label: string; defaultValue?: number }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <div className="relative rounded-md shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <span className="text-slate-400 text-sm">$</span>
        </div>
        <input type="number" name={name} id={name} step="0.01" defaultValue={defaultValue}
          className="block w-full rounded-md border-0 py-2 pl-7 pr-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600 text-sm bg-white shadow-sm"
        />
      </div>
    </div>
  )
}

// ─── Server Action (fuera del componente para evitar problemas con closures) ──
async function updateClientAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Leer el ID del cliente desde el campo oculto del formulario
  const clientId = formData.get('clientId') as string
  if (!clientId) return

  const clientName = formData.get('name') as string

  // Costos por tipo de grúa (local, banderazo, km)
  const tipoFields = ['a', 'b', 'c', 'd']
  const tipoCosts: Record<string, number> = {}
  for (const t of tipoFields) {
    tipoCosts[`costo_local_tipo_${t}`] = parseFloat(formData.get(`costo_local_tipo_${t}`) as string) || 0
    tipoCosts[`costo_bande_tipo_${t}`] = parseFloat(formData.get(`costo_bande_tipo_${t}`) as string) || 0
    tipoCosts[`costo_km_tipo_${t}`]    = parseFloat(formData.get(`costo_km_tipo_${t}`) as string) || 0
  }

  // Costos adicionales genéricos
  const extraFields = [
    'costo_maniobra', 'costo_hora_espera', 'costo_abanderamiento', 'costo_resguardo',
    'costo_dollys', 'costo_patines', 'costo_go_jacks',
    'costo_rescate_subterraneo', 'costo_adaptacion',
    'costo_blindaje_1', 'costo_blindaje_2', 'costo_blindaje_3', 'costo_blindaje_4',
    'costo_blindaje_5', 'costo_blindaje_6', 'costo_blindaje_7',
    'costo_kg_carga'
  ]
  const extras: Record<string, number> = {}
  for (const field of extraFields) {
    extras[field] = parseFloat(formData.get(field) as string) || 0
  }

  const allCosts = { ...tipoCosts, ...extras }

  // 1. Actualizar nombre del cliente
  await supabase.from('clients').update({ name: clientName }).eq('id', clientId)

  // 2. Verificar si existen reglas de pricing para este cliente
  const { data: existingRules } = await supabase
    .from('pricing_rules')
    .select('id')
    .eq('client_id', clientId)

  if (existingRules && existingRules.length > 0) {
    // Actualizar la primera regla encontrada (o todas)
    await supabase.from('pricing_rules').update(allCosts).eq('client_id', clientId)
  } else {
    // Crear una nueva regla si no existe ninguna
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    await supabase.from('pricing_rules').insert({
      client_id: clientId,
      company_id: profile?.company_id,
      tipo: 'general',
      costo_base: 0,
      costo_km: 0,
      ...allCosts
    })
  }

  redirect('/dashboard/clients')
}

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, pricing_rules(*)')
    .eq('id', params.id)
    .single()

  if (!client) return notFound()

  // Tomamos la primera regla disponible para pre-cargar valores
  const rule = (client.pricing_rules as any[])?.[0] ?? {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        <Link href="/dashboard/clients" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Editar Aseguradora</h2>
          <p className="mt-1 text-sm text-gray-500">Actualiza los tabuladores de cobro para este cliente.</p>
        </div>
      </div>

      <form action={updateClientAction} className="space-y-8">
        {/* ID oculto para evitar el problema de closure en server actions */}
        <input type="hidden" name="clientId" value={client.id} />

        {/* Nombre */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">Nombre de la Aseguradora o Cliente</label>
            <input type="text" name="name" id="name" required defaultValue={client.name}
              className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm" />
          </div>
        </div>

        {/* Costos por Tipo de Grúa */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Costo por Tipo de Grúa</h3>
          <p className="text-xs text-slate-500 mb-4">Cada tipo de unidad tiene su propio costo local, banderazo foráneo y costo por kilómetro.</p>
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
                      <CurrencyInput name={`costo_local_tipo_${key}`} label="" defaultValue={rule[`costo_local_tipo_${key}`] ?? 0} />
                    </td>
                    <td className="py-4 pr-4">
                      <CurrencyInput name={`costo_bande_tipo_${key}`} label="" defaultValue={rule[`costo_bande_tipo_${key}`] ?? 0} />
                    </td>
                    <td className="py-4">
                      <CurrencyInput name={`costo_km_tipo_${key}`} label="" defaultValue={rule[`costo_km_tipo_${key}`] ?? 0} />
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
            <CurrencyInput name="costo_maniobra" label="Maniobra" defaultValue={rule.costo_maniobra ?? 0}/>
            <CurrencyInput name="costo_hora_espera" label="Hora de Espera" defaultValue={rule.costo_hora_espera ?? 0}/>
            <CurrencyInput name="costo_abanderamiento" label="Abanderamiento" defaultValue={rule.costo_abanderamiento ?? 0}/>
            <CurrencyInput name="costo_resguardo" label="Resguardo" defaultValue={rule.costo_resguardo ?? 0}/>
          </div>
        </div>

        {/* Herramientas */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Costo por Herramientas</h3>
          <p className="text-xs text-slate-500 mb-4">Costo por el uso de equipo especializado de la grúa.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <CurrencyInput name="costo_dollys" label="Dollys" defaultValue={rule.costo_dollys ?? 0}/>
            <CurrencyInput name="costo_patines" label="Patines" defaultValue={rule.costo_patines ?? 0}/>
            <CurrencyInput name="costo_go_jacks" label="Go Jacks" defaultValue={rule.costo_go_jacks ?? 0}/>
          </div>
        </div>

        {/* Especializados */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Servicios Especializados y Carga</h3>
          <p className="text-xs text-slate-500 mb-4">Rescate, adaptaciones, blindaje y carga por kilogramo.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CurrencyInput name="costo_rescate_subterraneo" label="Rescate Subterráneo" defaultValue={rule.costo_rescate_subterraneo ?? 0}/>
            <CurrencyInput name="costo_adaptacion" label="Adaptación" defaultValue={rule.costo_adaptacion ?? 0}/>
            <CurrencyInput name="costo_kg_carga" label="Kg de Carga" defaultValue={rule.costo_kg_carga ?? 0}/>
          </div>
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Niveles de Blindaje</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[1,2,3,4,5,6,7].map(n => (
                <CurrencyInput key={n} name={`costo_blindaje_${n}`} label={`Blindaje Nv. ${n}`} defaultValue={rule[`costo_blindaje_${n}`] ?? 0}/>
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
            Actualizar Tarifas
          </button>
        </div>
      </form>
    </div>
  )
}
