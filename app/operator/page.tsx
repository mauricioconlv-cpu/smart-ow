import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MapPin, ArrowRight } from 'lucide-react'
import DownloadPDFButton from './components/DownloadPDFButton'
import OperatorShell from './components/OperatorShell'
import AssignedTruckBanner from './components/AssignedTruckBanner'

export const dynamic = 'force-dynamic'

export default async function OperatorDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, tow_truck_id')
    .eq('id', user.id)
    .single()

  // Fetch linked truck (if any)
  let initialTruck: any = null
  if (profile?.tow_truck_id) {
    const { data: truck } = await supabase
      .from('tow_trucks')
      .select('id, unit_number, brand, model, plates')
      .eq('id', profile.tow_truck_id)
      .single()
    initialTruck = truck
  }

  // Fetch active services
  const { data: services } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      status,
      created_at,
      costo_calculado,
      calidad_estrellas,
      firma_url,
      tipo_servicio,
      origen_coords,
      destino_coords,
      comentarios_calidad,
      clients ( name )
    `)
    .eq('operator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'creado':             return 'Nuevo Asignado'
      case 'rumbo_contacto':     return 'En camino al Origen'
      case 'arribo_origen':      return 'En Sitio'
      case 'contacto':           return 'Maniobra / Enganche'
      case 'inicio_traslado':    return 'En Traslado a Destino'
      case 'traslado_concluido': return 'Descargando...'
      default:                   return status
    }
  }

  const dashboardContent = (
    <div className="p-4 space-y-6">

      {/* Unidad asignada + botón fin de turno */}
      {initialTruck && (
        <AssignedTruckBanner
          unit_number={initialTruck.unit_number}
          plates={initialTruck.plates}
          brand={initialTruck.brand}
          model={initialTruck.model}
        />
      )}

      <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Mis Servicios Activos</h2>
          <p className="text-sm text-slate-500 mt-1">
            Atiende los folios pendientes en orden.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {(!services || services.length === 0) ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
              <MapPin className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">Libre. Sin servicios asignados.</p>
          </div>
        ) : (
          services.map(service => (
            <div key={service.id} className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-blue-500 flex flex-col gap-4 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block ${service.status === 'servicio_cerrado' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                    FOLIO: #{service.folio}
                  </span>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">
                    {(service.clients as any)?.name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="block text-xs text-gray-400 font-medium">ESTADO</span>
                  <span className={`block text-sm font-bold ${service.status === 'servicio_cerrado' ? 'text-green-600' : 'text-slate-700'}`}>
                    {getStatusLabel(service.status)}
                  </span>
                </div>
              </div>

              {service.status === 'servicio_cerrado' ? (
                <DownloadPDFButton service={service} />
              ) : (
                <Link
                  href={`/operator/service/${service.id}`}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  <span>Ver Detalles del Servicio</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )

  return (
    <OperatorShell
      operatorId={user.id}
      operatorName={profile?.full_name || 'Operador'}
      avatarUrl={profile?.avatar_url || null}
      initialTruck={initialTruck}
    >
      {dashboardContent}
    </OperatorShell>
  )
}
