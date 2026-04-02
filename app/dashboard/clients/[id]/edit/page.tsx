import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Save, ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { updateClientWithRates } from './actions'

function CurrencyInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  return (
    <div className="relative rounded-md shadow-sm">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <span className="text-slate-400 text-sm">$</span>
      </div>
      <input
        type="number" name={name} id={name} step="0.01"
        defaultValue={defaultValue}
        className="block w-full rounded-md border-0 py-2 pl-7 pr-3 text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600 text-sm bg-white shadow-sm"
      />
    </div>
  )
}

// Next.js 15: params is a Promise — must use props pattern and await
export default async function EditClientPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params   // ← await obligatorio en Next.js 15

  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, pricing_rules(*)')
    .eq('id', id)
    .single()

  if (!client) return notFound()

  const rule = (client.pricing_rules as any[])?.[0] ?? {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
        <Link href="/dashboard/clients" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Editar Aseguradora</h2>
          <p className="mt-1 text-sm text-gray-500">Actualiza los tabuladores de cobro.</p>
        </div>
      </div>

      <form action={updateClientWithRates} className="space-y-8">
        <input type="hidden" name="clientId" value={client.id} />

        {/* Nombre */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
          <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">
            Nombre de la Aseguradora
          </label>
          <input type="text" name="name" id="name" required defaultValue={client.name}
            className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 text-sm shadow-sm" />
        </div>

        {/* Costos por Tipo de Servicio o Unidad */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Costo Base por Servicio / Grúa</h3>
          <p className="text-xs text-slate-500 mb-4">Costo local, banderazo y precio por kilómetro para cada tipo de servicio.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left pb-3 pr-6 text-xs font-bold text-slate-500 uppercase w-28">Tipo</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Costo Local</th>
                  <th className="text-left pb-3 pr-4 text-xs font-bold text-slate-500 uppercase">Banderazo</th>
                  <th className="text-left pb-3 text-xs font-bold text-slate-500 uppercase">$/Km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {([
                  { key: 'a', label: 'Tipo A', desc: '< 3.5 ton',   color: 'text-green-700 bg-green-100' },
                  { key: 'b', label: 'Tipo B', desc: '3.5–7.5 ton', color: 'text-blue-700 bg-blue-100' },
                  { key: 'c', label: 'Tipo C', desc: '7.5–11 ton',  color: 'text-orange-700 bg-orange-100' },
                  { key: 'd', label: 'Tipo D', desc: '> 11 ton',    color: 'text-red-700 bg-red-100' },
                  { key: 'paso_corriente', label: 'Paso Corriente', desc: 'Asistencia Vial', color: 'text-yellow-700 bg-yellow-100' },
                  { key: 'cambio_llanta',  label: 'Cambio Llanta',  desc: 'Asistencia Vial', color: 'text-slate-700 bg-slate-200' },
                  { key: 'gasolina',       label: 'Gasolina',       desc: 'Asistencia Vial', color: 'text-purple-700 bg-purple-100' },
                ] as const).map(({ key, label, desc, color }) => (
                  <tr key={key}>
                    <td className="py-4 pr-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-sm ${color}`}>{label}</span>
                      <span className="block text-xs text-slate-400 mt-1">{desc}</span>
                    </td>
                    <td className="py-4 pr-4"><CurrencyInput name={`costo_local_tipo_${key}`} defaultValue={rule[`costo_local_tipo_${key}`] ?? 0} /></td>
                    <td className="py-4 pr-4"><CurrencyInput name={`costo_bande_tipo_${key}`} defaultValue={rule[`costo_bande_tipo_${key}`] ?? 0} /></td>
                    <td className="py-4"><CurrencyInput name={`costo_km_tipo_${key}`} defaultValue={rule[`costo_km_tipo_${key}`] ?? 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Costos adicionales */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Costos Adicionales</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'costo_maniobra', label: 'Maniobra' },
              { name: 'costo_hora_espera', label: 'Hora de Espera' },
              { name: 'costo_abanderamiento', label: 'Abanderamiento' },
              { name: 'costo_resguardo', label: 'Resguardo' },
              { name: 'costo_dollys', label: 'Dollys' },
              { name: 'costo_patines', label: 'Patines' },
              { name: 'costo_go_jacks', label: 'Go Jacks' },
              { name: 'costo_pistola_impacto', label: 'Pistola de Impacto' },
              { name: 'costo_dardos', label: 'Dardos / Punteros' },
              { name: 'costo_bidon', label: 'Bidón p/Gasolina' },
              { name: 'costo_rescate_subterraneo', label: 'Rescate Sub.' },
              { name: 'costo_adaptacion', label: 'Adaptación' },
              { name: 'costo_kg_carga', label: 'Kg de Carga' },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <CurrencyInput name={name} defaultValue={rule[name] ?? 0} />
              </div>
            ))}
          </div>
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Blindaje por Nivel</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[1,2,3,4,5,6,7].map(n => (
                <div key={n}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nivel {n}</label>
                  <CurrencyInput name={`costo_blindaje_${n}`} defaultValue={rule[`costo_blindaje_${n}`] ?? 0} />
                </div>
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
            <Save className="h-5 w-5" />
            Actualizar Tarifas
          </button>
        </div>
      </form>
    </div>
  )
}
