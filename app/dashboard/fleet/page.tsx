import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Truck, CheckCircle2, XCircle } from 'lucide-react'
import FleetRowActions from './components/FleetRowActions'

export const dynamic = 'force-dynamic'

export default async function FleetPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const canEdit = profile?.role !== 'dispatcher'

  // Leer la lista de grúas
  const { data: towTrucks } = await supabase
    .from('tow_trucks')
    .select('*')
    .order('economic_number', { ascending: true })

  // Leer todos los operadores que tienen una grúa asignada (tow_truck_id != null)
  const { data: operators } = await supabase
    .from('profiles')
    .select('tow_truck_id, full_name')
    .not('tow_truck_id', 'is', null)

  // Mapa rápido: { tow_truck_id -> full_name }
  const operatorByTruck: Record<string, string> = {}
  for (const op of operators ?? []) {
    if (op.tow_truck_id) operatorByTruck[op.tow_truck_id] = op.full_name ?? 'Sin nombre'
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Flotilla de Grúas</h1>
          <p className="text-slate-500 mt-1">Gestiona tus vehículos, números económicos y placas de circulación.</p>
        </div>
        {canEdit && (
          <Link 
            href="/dashboard/fleet/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            Nueva Grúa
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="p-4">Número Económico</th>
                <th className="p-4">Marca / Modelo</th>
                <th className="p-4">Placas</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Operador Asignado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 uppercase">
              {towTrucks?.map((truck) => (
                <tr key={truck.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                        <Truck className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-slate-800">{truck.economic_number}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{truck.brand} - {truck.model}</td>
                  <td className="p-4 text-slate-600">{truck.plates}</td>
                  <td className="p-4">
                    {truck.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3"/> En Servicio
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3"/> Mantenimiento
                        </span>
                    )}
                  </td>
                  <td className="p-4">
                    {operatorByTruck[truck.id]
                      ? <span className="font-medium text-slate-700">{operatorByTruck[truck.id]}</span>
                      : <span className="text-slate-400 italic text-sm">No asignado</span>
                    }
                  </td>
                  <td className="p-4">
                     <FleetRowActions truckId={truck.id} economicNumber={truck.economic_number} canEdit={canEdit} />
                  </td>
                </tr>
              ))}
              {(!towTrucks || towTrucks.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    No hay grúas registradas aún. Clic en "Nueva Grúa" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
