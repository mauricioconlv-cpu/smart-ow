import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Clock, MapPin } from 'lucide-react'

export default async function ServicesPage() {
  const supabase = await createClient()
  
  // Obtenemos los servicios activos con información de cliente y operador
  const { data: services } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      status,
      tipo_servicio,
      costo_calculado,
      created_at,
      clients ( name ),
      profiles ( full_name, grua_asignada )
    `)
    .order('created_at', { ascending: false })

  // Función para traducir colores por estado
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      creado: 'bg-gray-100 text-gray-800',
      rumbo_contacto: 'bg-yellow-100 text-yellow-800',
      arribo_origen: 'bg-orange-100 text-orange-800',
      contacto: 'bg-blue-100 text-blue-800',
      inicio_traslado: 'bg-indigo-100 text-indigo-800',
      traslado_concluido: 'bg-purple-100 text-purple-800',
      servicio_cerrado: 'bg-green-100 text-green-800'
    }
    const labels: Record<string, string> = {
      creado: 'Esperando Asignación',
      rumbo_contacto: 'Rumbo al Origen',
      arribo_origen: 'Grúa en el lugar',
      contacto: 'Cargando Vehículo',
      inicio_traslado: 'En Traslado',
      traslado_concluido: 'Descargado',
      servicio_cerrado: 'Finalizado'
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.creado}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Servicios de Arrastre</h2>
          <p className="mt-1 text-sm text-gray-500">
            Monitorea los folios activos y su estado actual de traslado.
          </p>
        </div>
        <Link 
          href="/dashboard/services/new" 
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Servicio</span>
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <ul role="list" className="divide-y divide-gray-200">
          {(!services || services.length === 0) ? (
            <li className="px-6 py-12 text-center text-gray-500">
              No hay servicios activos en este momento.
            </li>
          ) : (
            services.map((service) => (
              <li key={service.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  {/* Folio y Cliente */}
                  <div className="flex items-center space-x-4">
                     <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-lg bg-slate-100 flex flex-col items-center justify-center border border-slate-200">
                          <span className="text-xs text-slate-500 font-medium">FOLIO</span>
                          <span className="text-sm text-slate-900 font-bold">#{service.folio}</span>
                        </div>
                     </div>
                     <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {(service.clients as any)?.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                           <Clock className="h-3.5 w-3.5" />
                           {new Date(service.created_at).toLocaleString('es-MX')}
                        </div>
                     </div>
                  </div>
                  
                  {/* Status y Asignación */}
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusBadge(service.status)}
                    <span className="text-xs font-medium text-gray-600">
                      Operador: {service.profiles ? `${(service.profiles as any).full_name} (${(service.profiles as any).grua_asignada})` : 'Sin Asignar'}
                    </span>
                  </div>
                </div>

                {/* Detalles de Cotizacion en Lista */}
                <div className="mt-4 flex items-center justify-between text-sm">
                   <div className="flex text-gray-500 gap-4">
                     <span className="capitalize bg-gray-100 px-2 py-1 rounded">Tabulador: {service.tipo_servicio}</span>
                   </div>
                   <div className="font-medium text-gray-900">
                     Cotización: <span className="text-green-600">${Number(service.costo_calculado).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</span>
                   </div>
                </div>
                
                {service.status === 'creado' && !service.profiles && (
                   <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                      <button className="text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded-md">
                        Asignar Grúa Ahora
                      </button>
                   </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

    </div>
  )
}
