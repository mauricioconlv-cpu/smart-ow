'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, MapPin, Calculator, AlertCircle } from 'lucide-react'

// Cliente autenticado que usa la sesión del usuario (cookies) - respeta RLS
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function NewServicePage() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [originAddress, setOriginAddress] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  
  const [tipoServicio, setTipoServicio] = useState<'local' | 'foraneo'>('local')
  const [distanciaAproximada, setDistanciaAproximada] = useState(0)
  const [costoCalculado, setCostoCalculado] = useState(0)

  const [towTrucks, setTowTrucks] = useState<any[]>([])
  const [selectedTruck, setSelectedTruck] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  // Coordenadas geocodificadas del paso de cálculo
  const [originLatLng, setOriginLatLng] = useState<{lat:number,lng:number}|null>(null)
  const [destLatLng, setDestLatLng] = useState<{lat:number,lng:number}|null>(null)

  // Cargar catalogos al montar
  useEffect(() => {
    async function loadData() {
      // Clientes y Reglas
      const { data: cData } = await supabase.from('clients').select('id, name, pricing_rules(*)')
      if (cData) setClients(cData)

      // Grúas Activas
      const { data: tData } = await supabase.from('tow_trucks').select('*').eq('is_active', true)
      if (tData) setTowTrucks(tData)
    }
    loadData()
  }, [])

  // Crear y guardar el servicio en BD
  const handleCreateService = async () => {
    if (!selectedClient) { setCreateError('Selecciona una aseguradora/cliente.'); return }
    if (!selectedTruck)  { setCreateError('Selecciona una grúa de la flotilla.'); return }

    setIsCreating(true)
    setCreateError('')

    try {
      // 1. Obtener company_id del usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesión expirada. Vuelve a iniciar sesión.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) throw new Error('No se pudo obtener la empresa del usuario.')

      // 2. Buscar el operador asignado a la grúa seleccionada
      const { data: operatorProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('tow_truck_id', selectedTruck)
        .single()

      // 3. Insertar el servicio
      const truck = towTrucks.find(t => t.id === selectedTruck)
      const { data: newService, error: serviceError } = await supabase
        .from('services')
        .insert({
          company_id:       profile.company_id,
          client_id:        selectedClient,
          operator_id:      operatorProfile?.id ?? null,
          tipo_servicio:    tipoServicio,
          distancia_km:     distanciaAproximada,
          costo_calculado:  costoCalculado,
          origen_coords:    originLatLng ? { lat: originLatLng.lat, lng: originLatLng.lng } : null,
          destino_coords:   destLatLng   ? { lat: destLatLng.lat,   lng: destLatLng.lng   } : null,
          status:           'creado'
        })
        .select('id')
        .single()

      if (serviceError) throw new Error(serviceError.message)

      // 4. Redirigir al formulario completo de captura
      window.location.href = `/dashboard/services/${newService.id}/capture`

    } catch (err: any) {
      setCreateError(err.message || 'Error desconocido al crear el servicio.')
      setIsCreating(false)
    }
  }

  // Geocodificación (Nominatim) y Ruteo (OSRM)
  const calculateRealDistance = async () => {
     if (!selectedTruck || !originAddress || !destinationAddress) {
        setCalcError('Debes seleccionar una Grúa, Origen y Destino para calcular la ruta.')
        return
     }
     setIsCalculating(true)
     setCalcError('')

     try {
       const truck = towTrucks.find(t => t.id === selectedTruck)
       if (!truck || !truck.current_lat || !truck.current_lng) {
          throw new Error('La grúa seleccionada no tiene coordenadas GPS válidas.')
       }

       // 1. Geocodificar Direcciones a Coordenadas (OpenStreetMap Nominatim)
       const geocode = async (address: string) => {
         const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
         const data = await res.json()
         if (!data || data.length === 0) throw new Error(`No se encontró la dirección: ${address}`)
         return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
       }

       const originCoords = await geocode(originAddress)
       const destCoords = await geocode(destinationAddress)
       // Guardar coordenadas para el formulario de captura
       setOriginLatLng(originCoords)
       setDestLatLng(destCoords)

       // 2. OSRM Routing Machine (Punto A -> B -> C)
       // Formato: Lng,Lat
       const coordsString = `${truck.current_lng},${truck.current_lat};${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}`
       const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false`)
       const osrmData = await osrmRes.json()

       if (osrmData.code !== 'Ok') throw new Error('Error al calcular la ruta en carreteras.')

       // Distancia Total Convertida a Kilómetros Asfálticos (OSRM devuelve metros)
       const totalMeters = osrmData.routes[0].distance
       const totalKm = parseFloat((totalMeters / 1000).toFixed(2))
       
       setDistanciaAproximada(totalKm)

     } catch (err: any) {
        setCalcError(err.message || 'Error desconocido.')
     } finally {
        setIsCalculating(false)
     }
  }

  // Motor de cálculo inteligente
  useEffect(() => {
    if (!selectedClient) {
      setCostoCalculado(0)
      return
    }

    const clientData = clients.find(c => c.id === selectedClient)
    if (!clientData) return

    const rule = clientData.pricing_rules.find((r: any) => r.tipo === tipoServicio)
    
    if (!rule) {
       setCostoCalculado(0)
       return
    }

    if (tipoServicio === 'local') {
      setCostoCalculado(Number(rule.costo_base))
    } else {
      // Foraneo: Banderazo + (Km * CostoKm)
      const banderazo = Number(rule.costo_base)
      const costoPorKm = Number(rule.costo_km)
      setCostoCalculado(banderazo + (distanciaAproximada * costoPorKm))
    }
  }, [selectedClient, tipoServicio, distanciaAproximada, clients])

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Despachar Nuevo Servicio</h2>
        <p className="mt-1 text-sm text-gray-500">
          Captura los datos del siniestro/arrastre. El sistema cotizará basado en las reglas del cliente seleccionado.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulario Principal */}
        <div className="lg:col-span-2 bg-white shadow rounded-lg p-6 space-y-8">
          
          <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-blue-600"/>
              Información del Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">Aseguradora</label>
                <select 
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="">Seleccione...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">Tipo de Tabulador</label>
                <select 
                  value={tipoServicio}
                  onChange={(e) => setTipoServicio(e.target.value as any)}
                  className="mt-2 block w-full rounded-md border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="local">Traslado Local</option>
                  <option value="foraneo">Traslado Foráneo (Pago x Km)</option>
                </select>
              </div>
            </div>
          </section>

          <section>
             <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <TruckIcon className="h-5 w-5 text-green-600"/>
              Asignación Logística (Flotilla Activa)
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                <label className="block text-sm font-medium leading-6 text-gray-900">Seleccionar Grúa Conectada</label>
                <select 
                  value={selectedTruck}
                  onChange={(e) => setSelectedTruck(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="">Buscar en mapa o seleccionar lista...</option>
                  {towTrucks.map(t => (
                      <option key={t.id} value={t.id}>
                          {t.economic_number} - {t.plates} (Lat: {t.current_lat || 'N/D'}, Lng: {t.current_lng || 'N/D'})
                      </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                    Al seleccionar una Grúa, el sistema extraerá su coordenada actual para estimar la ruta Origen.
                </p>
            </div>

             <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500"/>
              Ubicaciones de Arrastre
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">Dirección de Origen (Siniestro)</label>
                <input
                  type="text"
                  value={originAddress}
                  onChange={e => setOriginAddress(e.target.value)}
                  placeholder="Ej. Calle Madero 15 Centro"
                  className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">Dirección de Destino (Corralón/Taller)</label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={e => setDestinationAddress(e.target.value)}
                  placeholder="Ej. Taller Mecánico Los Primos, Toluca"
                  className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>

              {/* Botón de Cálculo Asfáltico */}
              <div className="pt-4 border-t border-slate-100 flex flex-col items-start gap-3">
                 <button
                    type="button"
                    disabled={isCalculating}
                    onClick={calculateRealDistance}
                    className="bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-black transition-colors disabled:opacity-50"
                 >
                    {isCalculating ? 'Geocodificando y Trazando Ruta...' : 'Calcular Ruta Asfáltica (Grúa -> Siniestro -> Taller)'}
                 </button>
                 {calcError && <p className="text-red-600 text-sm font-medium">{calcError}</p>}
              </div>

            </div>
          </section>
          
          {tipoServicio === 'foraneo' && (
            <section className="bg-orange-50 p-4 rounded-lg border border-orange-100">
              <h3 className="text-sm font-medium text-orange-800 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4"/>
                Distancia Requerida para Cotización Foránea
              </h3>
              <div>
                <label className="block text-xs font-medium leading-6 text-orange-900">Distancia Estimada (Kilómetros OSRM)</label>
                <input
                  type="number"
                  value={distanciaAproximada || ''}
                  onChange={(e) => setDistanciaAproximada(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 block w-1/2 rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-orange-300 focus:ring-2 focus:ring-orange-600 sm:text-sm sm:leading-6 bg-white font-bold"
                />
                <p className="mt-1 text-xs text-orange-700">Calculado automáticamente con OSRM. Puedes sobreescribir manualmente si es necesario.</p>
              </div>
            </section>
          )}

        </div>

        {/* Panel de Cotización Lateral */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 text-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium flex items-center gap-2 mb-6 text-blue-400">
              <Calculator className="h-5 w-5"/>
              Cotización Inteligente
            </h3>
            
            <div className="space-y-4">
               <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                <span className="text-slate-400">Cliente</span>
                <span className="font-medium">{selectedClient ? clients.find(c=>c.id === selectedClient)?.name : '---'}</span>
              </div>
               <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                <span className="text-slate-400">Tipo Tabulador</span>
                <span className="font-medium capitalize">{tipoServicio}</span>
              </div>
              
              {tipoServicio === 'foraneo' && (
                 <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Distancia</span>
                  <span className="font-medium">{distanciaAproximada} km</span>
                </div>
              )}

              <div className="pt-4">
                <span className="block text-sm text-slate-400 mb-1">Costo Total Estimado</span>
                <span className="text-4xl font-bold text-green-400">
                  ${costoCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {createError && (
              <p className="mt-4 text-red-400 text-xs font-medium">{createError}</p>
            )}
            <button
              type="button"
              onClick={handleCreateService}
              disabled={isCreating}
              className="mt-4 flex w-full justify-center items-center gap-2 rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-5 w-5" />
              {isCreating ? 'Creando Servicio...' : 'Crear y Asignar Grúa'}
            </button>

          </div>
        </div>

      </div>
    </div>
  )
}

function UsersIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function TruckIcon(props: any) {
    return (
        <svg
          {...props}
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 17h4V5H2v12h3" />
          <path d="M20 17h2v-9h-4V5H14v12h3" />
          <path d="M14 8h6v3h-6z" />
          <circle cx="8.5" cy="17.5" r="1.5" />
          <circle cx="18.5" cy="17.5" r="1.5" />
        </svg>
    )
}
