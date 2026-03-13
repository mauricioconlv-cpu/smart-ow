import { createClient } from '@/lib/supabase/server'
import { Calendar, Star, History } from 'lucide-react'
import DownloadPDFButton from '@/app/operator/components/DownloadPDFButton'
import ExportExcelButton from './ExportExcelButton'

export default async function ReportsPage() {
  const supabase = await createClient()

  // Traer servicios terminados
  const { data: services } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      status,
      costo_calculado,
      calidad_estrellas,
      firma_url,
      tipo_servicio,
      created_at,
      updated_at,
      origen_coords,
      destino_coords,
      clients ( name ),
      profiles ( full_name )
    `)
    .eq('status', 'servicio_cerrado')
    .order('updated_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="h-6 w-6 text-blue-600" />
            Historial y Reportes
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Consulta los servicios completados, calidad de operador y exporta memorias descriptivas.
          </p>
        </div>
        <ExportExcelButton data={services || []} />
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <ul role="list" className="divide-y divide-gray-200">
          {(!services || services.length === 0) ? (
            <li className="px-6 py-12 text-center text-gray-500">
              No hay servicios finalizados en el historial.
            </li>
          ) : (
            services.map((service) => (
              <li key={service.id} className="p-6 hover:bg-gray-50 transition-colors">
                 <div className="flex justify-between">
                    <div className="flex gap-4">
                       <div className="h-16 w-16 bg-blue-50 border border-blue-100 rounded-lg flex flex-col items-center justify-center">
                         <span className="text-xs text-blue-500 font-bold">FOLIO</span>
                         <span className="text-lg text-blue-800 font-black">#{service.folio}</span>
                       </div>
                       <div>
                         <h3 className="text-lg font-bold text-slate-900">{(service.clients as any)?.name}</h3>
                         <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                           <span className="flex items-center gap-1">
                             <Calendar className="h-4 w-4" /> 
                             {new Date(service.updated_at).toLocaleDateString()}
                           </span>
                           <span>Operador: {(service.profiles as any)?.full_name}</span>
                         </div>
                       </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                       <span className="text-xl font-bold text-green-600">
                         ${Number(service.costo_calculado).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
                       </span>
                       <div className="flex text-yellow-500 gap-0.5" title={`${service.calidad_estrellas} Estrellas`}>
                         {[...Array(service.calidad_estrellas || 0)].map((_, i) => (
                           <Star key={i} className="h-4 w-4 fill-current" />
                         ))}
                       </div>
                    </div>
                 </div>

                 <div className="mt-4 flex justify-end shrink-0 max-w-[200px] ml-auto">
                    <DownloadPDFButton service={service} />
                 </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
