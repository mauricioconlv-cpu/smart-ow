import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { updateClient } from '../../actions'

interface EditClientPageProps {
  params: { id: string }
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { id } = params
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, pricing_rules(*)')
    .eq('id', id)
    .single()

  if (!client) redirect('/dashboard/clients')

  const localRule   = (client.pricing_rules as any[]).find(r => r.tipo === 'local')
  const foraneaRule = (client.pricing_rules as any[]).find(r => r.tipo === 'foraneo')

  async function handleUpdate(formData: FormData) {
    'use server'
    await updateClient(id, formData)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/clients" className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Editar Aseguradora / Cliente</h1>
          <p className="text-sm text-slate-500 mt-1">Modifica el nombre y las tarifas de cobro.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <form action={handleUpdate} className="space-y-8">
          
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Aseguradora / Cliente</label>
            <input
              type="text" name="name" required
              defaultValue={client.name}
              className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej. Seguros AXA"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-gray-100">
            
            {/* Tarifa Local */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-blue-800">Tarifa Local (Costo Fijo)</h3>
              <p className="text-xs text-gray-500">Arrastres dentro de la misma zona.</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Costo Base (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number" name="localCost" step="0.01" required
                    defaultValue={localRule?.costo_base ?? 0}
                    className="bg-white text-slate-900 w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Tarifa Foránea */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-purple-800">Tarifa Foránea (Por Kilometraje)</h3>
              <p className="text-xs text-gray-500">Traslados fuera de zona calculando distancia.</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Banderazo (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number" name="foraneoBase" step="0.01" required
                    defaultValue={foraneaRule?.costo_base ?? 0}
                    className="bg-white text-slate-900 w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Costo por Km (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number" name="foraneoKm" step="0.01" required
                    defaultValue={foraneaRule?.costo_km ?? 0}
                    className="bg-white text-slate-900 w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link href="/dashboard/clients"
              className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </Link>
            <button type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
              <Save className="w-4 h-4" />
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
