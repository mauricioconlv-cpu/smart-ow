import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function ClientsPage() {
  const supabase = await createClient()
  
  // Obtenemos clientes y sus reglas de precio asociadas
  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      pricing_rules (
        tipo,
        costo_base,
        costo_km
      )
    `)
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Aseguradoras y Clientes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los catálogos y las tarifas de cobro para cada cliente.
          </p>
        </div>
        <Link 
          href="/dashboard/clients/new"
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Cliente</span>
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre del Cliente
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tarifa Local
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tarifa Foránea
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No hay clientes registrados aún. Clic en "Nuevo Cliente" para comenzar.
                </td>
              </tr>
            ) : (
              clients?.map((client) => {
                const localRule = client.pricing_rules.find((r: any) => r.tipo === 'local')
                const foraneaRule = client.pricing_rules.find((r: any) => r.tipo === 'foraneo')

                return (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {client.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {localRule ? `$${localRule.costo_base} MXN Fijos` : 'No configurada'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {foraneaRule 
                        ? `$${foraneaRule.costo_base} Band. + $${foraneaRule.costo_km}/Km` 
                        : 'No configurada'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 hover:text-blue-900">Editar Tarifas</button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
