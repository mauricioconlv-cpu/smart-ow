'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, MapPin, Calculator, AlertCircle, Wrench, FileText, X } from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TOOLS_LIST = [
  { value: 'dollys',   label: 'Dollys' },
  { value: 'patines',  label: 'Patines' },
  { value: 'go_jacks', label: 'Go Jacks' },
]

const UNIT_TYPE_LABEL: Record<string, string> = {
  A: 'Tipo A (<3.5t)', B: 'Tipo B (3.5-7.5t)', C: 'Tipo C (7.5-11t)', D: 'Tipo D (>11t)'
}

export default function NewServicePage() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [originAddress, setOriginAddress] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [tipoServicio, setTipoServicio] = useState<'local' | 'foraneo'>('local')
  const [distanciaAproximada, setDistanciaAproximada] = useState(0)
  const [costoCalculado, setCostoCalculado] = useState(0)
  const [costoDesglose, setCostoDesglose] = useState<Record<string, number>>({})
  const [towTrucks, setTowTrucks] = useState<any[]>([])
  const [selectedTruck, setSelectedTruck] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [originLatLng, setOriginLatLng] = useState<{lat:number,lng:number}|null>(null)
  const [destLatLng, setDestLatLng] = useState<{lat:number,lng:number}|null>(null)
  const [showRatesModal, setShowRatesModal] = useState(false)
  const [costoParticular, setCostoParticular] = useState<string>('')

  const isParticular = selectedClient === 'particular'

  // Extras del servicio
  const [numeroExpediente, setNumeroExpediente] = useState('')
  const [requiereManiobra, setRequiereManiobra] = useState(false)
  const [requierePasoCorriente, setRequierePasoCorriente] = useState(false)
  const [herramientasUsadas, setHerramientasUsadas] = useState<string[]>([])

  // ETA del operador al origen
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null)
  const [distTruckToOrigin, setDistTruckToOrigin] = useState<number | null>(null)

  useEffect(() => {
    async function loadData() {
      const { data: cData } = await supabase
        .from('clients')
        .select('id, name, pricing_rules(*)')
      if (cData) setClients(cData)

      const { data: tData } = await supabase
        .from('tow_trucks')
        .select('*')
        .eq('is_active', true)
      if (tData) setTowTrucks(tData)
    }
    loadData()
  }, [])

  const toggleHerramienta = (val: string) => {
    setHerramientasUsadas(prev =>
      prev.includes(val) ? prev.filter(h => h !== val) : [...prev, val]
    )
  }

  // Haversine: distancia en km entre dos coordenadas GPS
  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  // Recalcular ETA cada vez que cambia la grúa o el origen geocodificado
  useEffect(() => {
    const truck = towTrucks.find(t => t.id === selectedTruck)
    if (!truck || !truck.current_lat || !truck.current_lng || !originLatLng) {
      setEtaMinutes(null)
      setDistTruckToOrigin(null)
      return
    }
    const dist = haversineKm(truck.current_lat, truck.current_lng, originLatLng.lat, originLatLng.lng)
    setDistTruckToOrigin(Math.round(dist * 10) / 10)
    // Velocidad promedio urbana 40 km/h → minutos
    setEtaMinutes(Math.round((dist / 40) * 60))
  }, [selectedTruck, originLatLng, towTrucks])

  // Motor de cotización inteligente
  useEffect(() => {
    if (!selectedClient) {
      setCostoCalculado(0)
      setCostoDesglose({})
      return
    }

    const clientData = clients.find(c => c.id === selectedClient)
    if (!clientData) return // includes 'particular' - no tariff needed

    // ── Detectar si el cliente usa el NUEVO formato (tipo='general') o el VIEJO (tipo='local'/'foraneo') ──
    const generalRule = clientData.pricing_rules.find((r: any) => r.tipo === 'general')
    const legacyRule  = clientData.pricing_rules.find((r: any) => r.tipo === tipoServicio)

    const truck = towTrucks.find(t => t.id === selectedTruck)
    const desglose: Record<string, number> = {}

    if (generalRule) {
      // ─── NUEVO FORMATO: costos individuales por tipo de grúa ───────────────
      const unitType = truck?.unit_type?.toLowerCase() ?? 'a'  // default tipo A

      if (tipoServicio === 'local') {
        const costoLocal = Number(generalRule[`costo_local_tipo_${unitType}`] || 0)
        if (costoLocal > 0) desglose.arrastre_base = costoLocal
      } else {
        const banderazo = Number(generalRule[`costo_bande_tipo_${unitType}`] || 0)
        const costoPorKm = Number(generalRule[`costo_km_tipo_${unitType}`] || 0)
        if (banderazo > 0) desglose.banderazo = banderazo
        if (costoPorKm > 0 && distanciaAproximada > 0) desglose.km = distanciaAproximada * costoPorKm
      }

      // Costos adicionales (aplican igual para ambos tipos de servicio)
      if (requiereManiobra && Number(generalRule.costo_maniobra) > 0)
        desglose.maniobra = Number(generalRule.costo_maniobra)

      if (requierePasoCorriente && Number(generalRule.costo_hora_espera) > 0)
        desglose.paso_corriente = Number(generalRule.costo_hora_espera)

      for (const herr of herramientasUsadas) {
        const val = Number(generalRule[`costo_${herr}`] || 0)
        if (val > 0) desglose[herr] = val
      }

    } else if (legacyRule) {
      // ─── FORMATO ANTIGUO: costo_base y costo_km ───────────────────────────
      if (tipoServicio === 'local') {
        desglose.arrastre_base = Number(legacyRule.costo_base)
      } else {
        desglose.banderazo = Number(legacyRule.costo_base)
        desglose.km = distanciaAproximada * Number(legacyRule.costo_km)
      }

      if (truck?.unit_type) {
        const costoTipoKey = `costo_tipo_${truck.unit_type.toLowerCase()}`
        const costoTipo = Number(legacyRule[costoTipoKey] || 0)
        if (costoTipo > 0) desglose[`grua_tipo_${truck.unit_type}`] = costoTipo
      }

      if (requiereManiobra && Number(legacyRule.costo_maniobra) > 0)
        desglose.maniobra = Number(legacyRule.costo_maniobra)

      if (requierePasoCorriente && Number(legacyRule.costo_hora_espera) > 0)
        desglose.paso_corriente = Number(legacyRule.costo_hora_espera)

      for (const herr of herramientasUsadas) {
        const val = Number(legacyRule[`costo_${herr}`] || 0)
        if (val > 0) desglose[herr] = val
      }

    } else {
      // Sin tarifas configuradas
      setCostoCalculado(0)
      setCostoDesglose({})
      return
    }

    const total = Object.values(desglose).reduce((a, b) => a + b, 0)
    setCostoDesglose(desglose)
    setCostoCalculado(total)
  }, [selectedClient, selectedTruck, tipoServicio, distanciaAproximada, clients, towTrucks, requiereManiobra, requierePasoCorriente, herramientasUsadas])

  const handleCreateService = async () => {
    if (!selectedClient) { setCreateError('Selecciona una aseguradora/cliente.'); return }
    if (!selectedTruck)  { setCreateError('Selecciona una grúa de la flotilla.'); return }

    const costoFinal = isParticular ? (parseFloat(costoParticular) || 0) : costoCalculado

    setIsCreating(true)
    setCreateError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesión expirada.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) throw new Error('No se pudo obtener la empresa.')

      const { data: operatorProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('tow_truck_id', selectedTruck)
        .single()

      // PASO 1: INSERT con solo columnas ORIGINAL conocidas por PostgREST
      const { data: newService, error: serviceError } = await supabase
        .from('services')
        .insert({
          company_id:    profile.company_id,
          client_id:     isParticular ? null : selectedClient,
          operator_id:   operatorProfile?.id ?? null,
          tipo_servicio: tipoServicio,
          distancia_km:  distanciaAproximada,
          costo_calculado: costoFinal,
          origen_coords: originLatLng  ? { lat: originLatLng.lat,  lng: originLatLng.lng }  : null,
          destino_coords: destLatLng   ? { lat: destLatLng.lat,    lng: destLatLng.lng }    : null,
          status: 'creado',
          es_particular: isParticular,
        })
        .select('id')
        .single()

      if (serviceError) throw new Error(serviceError.message)

      // PASO 2: UPDATE con las columnas nuevas (evita schema cache issue en INSERT)
      await supabase.from('services').update({
        numero_expediente:      numeroExpediente || null,
        requiere_maniobra:      requiereManiobra,
        requiere_paso_corriente: requierePasoCorriente,
        herramientas_usadas:    herramientasUsadas,
        costo_desglose:         costoDesglose,
      }).eq('id', newService.id)

      window.location.href = `/dashboard/services/${newService.id}/capture`
    } catch (err: any) {
      setCreateError(err.message || 'Error desconocido.')
      setIsCreating(false)
    }
  }

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

       const geocode = async (address: string) => {
         const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
         const data = await res.json()
         if (!data || data.length === 0) throw new Error(`No se encontró la dirección: ${address}`)
         return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
       }

       const originCoords = await geocode(originAddress)
       const destCoords = await geocode(destinationAddress)
       setOriginLatLng(originCoords)
       setDestLatLng(destCoords)

       const coordsString = `${truck.current_lng},${truck.current_lat};${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}`
       const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false`)
       const osrmData = await osrmRes.json()

       if (osrmData.code !== 'Ok') throw new Error('Error al calcular la ruta.')
       const totalKm = parseFloat((osrmData.routes[0].distance / 1000).toFixed(2))
       setDistanciaAproximada(totalKm)
     } catch (err: any) {
        setCalcError(err.message || 'Error desconocido.')
     } finally {
        setIsCalculating(false)
     }
  }

  const selectedTruckData = towTrucks.find(t => t.id === selectedTruck)
  const selectedClientData = clients.find(c => c.id === selectedClient)

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
        <div className="lg:col-span-2 space-y-6">
          
          {/* Información del Cliente */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-blue-600"/>
              Información del Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Aseguradora</label>
                <select 
                  value={selectedClient}
                  onChange={(e) => { setSelectedClient(e.target.value); setShowRatesModal(false) }}
                  className="mt-1 block w-full rounded-md border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 text-sm"
                >
                  <option value="">Seleccione...</option>
                  <option value="particular">⚡ Servicio de Particular (costo libre)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {/* Burbuja de tarifas — solo para aseguradoras conocidas */}
                {selectedClient && !isParticular && selectedClientData && (
                  <button
                    type="button"
                    onClick={() => setShowRatesModal(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-full transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ver tarifas de {selectedClientData.name}
                  </button>
                )}
                {/* Badge de particular */}
                {isParticular && (
                  <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                    ⚡ Costo libre — ingresa el monto manualmente
                  </span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Tipo de Tabulador</label>
                <select 
                  value={tipoServicio}
                  onChange={(e) => setTipoServicio(e.target.value as any)}
                  className="mt-1 block w-full rounded-md border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 text-sm"
                >
                  <option value="local">Traslado Local</option>
                  <option value="foraneo">Traslado Foráneo (Pago x Km)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-1">N° Expediente / Asistencia del Seguro</label>
                <input
                  type="text"
                  value={numeroExpediente}
                  onChange={e => setNumeroExpediente(e.target.value)}
                  placeholder="Ej. EXP-2024-0001 / No. de asistencia"
                  className="mt-1 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Asignación de Grúa */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <TruckIcon className="h-5 w-5 text-green-600"/>
              Asignación Logística (Flotilla Activa)
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-1">Seleccionar Grúa Conectada</label>
                <select 
                  value={selectedTruck}
                  onChange={(e) => setSelectedTruck(e.target.value)}
                  className="mt-1 block w-full rounded-md border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 text-sm"
                >
                  <option value="">Buscar en mapa o seleccionar lista...</option>
                  {towTrucks.map(t => (
                      <option key={t.id} value={t.id}>
                          {t.economic_number} - {t.plates}
                          {t.unit_type ? ` [${UNIT_TYPE_LABEL[t.unit_type] || t.unit_type}]` : ''}
                      </option>
                  ))}
                </select>
                {selectedTruckData && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectedTruckData.unit_type && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">
                          {UNIT_TYPE_LABEL[selectedTruckData.unit_type]}
                        </span>
                      )}
                      {(selectedTruckData.tools || []).map((t: string) => (
                        <span key={t} className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold capitalize">
                          {t.replace('_', ' ')}
                        </span>
                      ))}
                    </div>

                    {/* ETA del operador al origen */}
                    {etaMinutes !== null && distTruckToOrigin !== null ? (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <span className="text-xl">🚨</span>
                        <div>
                          <p className="text-xs font-bold text-amber-800">Tiempo Estimado de Arribo al Origen</p>
                          <p className="text-sm font-black text-amber-900">
                            {etaMinutes < 60
                              ? `~${etaMinutes} min`
                              : `~${Math.floor(etaMinutes/60)}h ${etaMinutes%60}min`
                            }
                            <span className="text-xs font-normal text-amber-600 ml-2">({distTruckToOrigin} km en línea recta)</span>
                          </p>
                        </div>
                      </div>
                    ) : selectedTruckData.current_lat ? (
                      <p className="text-xs text-slate-400 italic">Geocodifica el origen para ver el ETA del operador.</p>
                    ) : (
                      <p className="text-xs text-orange-500">⚠️ Grúa sin coordenadas GPS — ETA no disponible.</p>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-500">Al seleccionar una Grúa, el sistema cargará su tipo y herramientas disponibles.</p>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500"/>
              Ubicaciones de Arrastre
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900">Dirección de Origen (Siniestro)</label>
                <input type="text" value={originAddress} onChange={e => setOriginAddress(e.target.value)}
                  placeholder="Ej. Calle Madero 15 Centro"
                  className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900">Dirección de Destino (Corralón/Taller)</label>
                <input type="text" value={destinationAddress} onChange={e => setDestinationAddress(e.target.value)}
                  placeholder="Ej. Taller Mecánico Los Primos, Toluca"
                  className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 text-sm"/>
              </div>
              <div className="pt-4 border-t border-slate-100 flex flex-col items-start gap-3">
                 <button type="button" disabled={isCalculating} onClick={calculateRealDistance}
                    className="bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-black transition-colors disabled:opacity-50">
                    {isCalculating ? 'Geocodificando y Trazando Ruta...' : 'Calcular Ruta Asfáltica (Grúa → Siniestro → Taller)'}
                 </button>
                 {calcError && <p className="text-red-600 text-sm font-medium">{calcError}</p>}
              </div>
            </div>
          </div>

          {/* Extras del Servicio */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-600"/>
              Extras del Servicio
            </h3>
            <p className="text-xs text-slate-500 mb-4">Los costos aplicarán según las tarifas pactadas con la aseguradora seleccionada.</p>

            <div className="space-y-4">
              {/* Maniobra */}
              <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${requiereManiobra ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-slate-50 hover:border-orange-300'}`}>
                <input type="checkbox" checked={requiereManiobra} onChange={e => setRequiereManiobra(e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded"/>
                <div>
                  <p className="font-semibold text-slate-800">¿Requiere Maniobra?</p>
                  <p className="text-xs text-slate-500">Incluye el costo de maniobra negociado con la aseguradora.</p>
                </div>
                {requiereManiobra && selectedClientData && (
                  <span className="ml-auto text-sm font-bold text-orange-700">
                    +${Number(selectedClientData.pricing_rules?.find((r:any)=>r.tipo===tipoServicio)?.costo_maniobra || 0).toLocaleString('es-MX')} MXN
                  </span>
                )}
              </label>

              {/* Paso de Corriente */}
              <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${requierePasoCorriente ? 'border-yellow-400 bg-yellow-50' : 'border-slate-200 bg-slate-50 hover:border-yellow-300'}`}>
                <input type="checkbox" checked={requierePasoCorriente} onChange={e => setRequierePasoCorriente(e.target.checked)}
                  className="w-5 h-5 text-yellow-500 rounded"/>
                <div>
                  <p className="font-semibold text-slate-800">¿Requiere Paso de Corriente?</p>
                  <p className="text-xs text-slate-500">Servicio de jumper/paso de corriente.</p>
                </div>
                {requierePasoCorriente && selectedClientData && (
                  <span className="ml-auto text-sm font-bold text-yellow-700">
                    +${Number(selectedClientData.pricing_rules?.find((r:any)=>r.tipo===tipoServicio)?.costo_hora_espera || 0).toLocaleString('es-MX')} MXN
                  </span>
                )}
              </label>

              {/* Herramientas — solo mostrar las que tiene la grúa */}
              {selectedTruckData && (selectedTruckData.tools || []).length > 0 && (
                <div className="border-t pt-4 mt-2">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Herramientas disponibles en esta grúa:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(selectedTruckData.tools as string[])
                      .filter(t => TOOLS_LIST.some(tl => tl.value === t))
                      .map(toolValue => {
                        const tool = TOOLS_LIST.find(tl => tl.value === toolValue)!
                        const checked = herramientasUsadas.includes(toolValue)
                        const rule = selectedClientData?.pricing_rules?.find((r:any)=>r.tipo===tipoServicio)
                        const costKey = `costo_${toolValue}`
                        const toolCost = Number(rule?.[costKey] || 0)
                        return (
                          <label key={toolValue}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                              ${checked ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50 hover:border-green-300'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleHerramienta(toolValue)}
                              className="w-4 h-4 text-green-600 rounded"/>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-800">{tool.label}</p>
                              {toolCost > 0 && <p className="text-xs text-green-700">+${toolCost.toLocaleString('es-MX')} MXN</p>}
                            </div>
                          </label>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {tipoServicio === 'foraneo' && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
              <h3 className="text-sm font-medium text-orange-800 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4"/>
                Distancia Requerida para Cotización Foránea
              </h3>
              <div>
                <label className="block text-xs font-medium text-orange-900">Distancia Estimada (Kilómetros OSRM)</label>
                <input type="number" value={distanciaAproximada || ''} onChange={(e) => setDistanciaAproximada(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 block w-1/2 rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-orange-300 focus:ring-2 focus:ring-orange-600 text-sm bg-white font-bold"/>
                <p className="mt-1 text-xs text-orange-700">Calculado automáticamente con OSRM. Puedes sobreescribir manualmente.</p>
              </div>
            </div>
          )}
        </div>

        {/* Panel de Cotización Lateral */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 text-white shadow rounded-lg p-6 sticky top-6">
            <h3 className="text-lg font-medium flex items-center gap-2 mb-4 text-blue-400">
              <Calculator className="h-5 w-5"/>
              Cotización Inteligente
            </h3>
            
            <div className="space-y-2 mb-4">
               <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                <span className="text-slate-400">Cliente</span>
                <span className="font-medium text-right">{selectedClient ? clients.find(c=>c.id === selectedClient)?.name : '---'}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                <span className="text-slate-400">Tipo Tabulador</span>
                <span className="font-medium capitalize">{tipoServicio}</span>
              </div>
              {selectedTruckData?.unit_type && (
                <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Tipo Grúa</span>
                  <span className="font-medium">{UNIT_TYPE_LABEL[selectedTruckData.unit_type]}</span>
                </div>
              )}
              {tipoServicio === 'foraneo' && (
                <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Distancia</span>
                  <span className="font-medium">{distanciaAproximada} km</span>
                </div>
              )}
            </div>

            {/* Desglose de costos */}
            {Object.keys(costoDesglose).length > 0 && (
              <div className="bg-slate-800 rounded-lg p-3 mb-4 space-y-1.5 text-xs">
                <p className="text-slate-400 font-semibold uppercase tracking-wider mb-2">Desglose</p>
                {Object.entries(costoDesglose).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-slate-200 font-medium">${Number(val).toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                  </div>
                ))}
              </div>
            )}

              <div className="pt-4 border-t border-slate-700/50">
                <p className="text-slate-400 text-sm mb-1">Costo Total Estimado</p>
                
                {isParticular ? (
                  <div className="space-y-2 mt-2">
                    <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                      Ingresa el costo acordado
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={costoParticular}
                        onChange={(e) => setCostoParticular(e.target.value)}
                        className="block w-full pl-7 pr-12 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-emerald-400 text-2xl font-black placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-slate-500 sm:text-sm">MXN</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-3xl font-black text-emerald-400">
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(costoCalculado)}
                  </p>
                )}
              </div>

            {createError && <p className="mt-4 text-red-400 text-xs font-medium">{createError}</p>}
            <button type="button" onClick={handleCreateService} disabled={isCreating}
              className="mt-4 flex w-full justify-center items-center gap-2 rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Plus className="h-5 w-5" />
              {isCreating ? 'Creando Servicio...' : 'Crear y Asignar Grúa'}
            </button>

          </div>
        </div>

      </div>

      {/* Modal de Tarifas */}
      {showRatesModal && selectedClientData && (() => {
        const rule = selectedClientData.pricing_rules?.find((r: any) => r.tipo === 'general')
          ?? selectedClientData.pricing_rules?.[0]
        const TIPOS = ['a', 'b', 'c', 'd']
        const TIPO_LABELS: Record<string, string> = {
          a: 'Tipo A (<3.5t)', b: 'Tipo B (3.5-7.5t)', c: 'Tipo C (7.5-11t)', d: 'Tipo D (>11t)'
        }
        const extras: { label: string; key: string }[] = [
          { label: 'Maniobra', key: 'costo_maniobra' },
          { label: 'Hora de Espera', key: 'costo_hora_espera' },
          { label: 'Abanderamiento', key: 'costo_abanderamiento' },
          { label: 'Resguardo', key: 'costo_resguardo' },
          { label: 'Dollys', key: 'costo_dollys' },
          { label: 'Patines', key: 'costo_patines' },
          { label: 'Go Jacks', key: 'costo_go_jacks' },
          { label: 'Rescate Subterráneo', key: 'costo_rescate_subterraneo' },
          { label: 'Adaptación', key: 'costo_adaptacion' },
          { label: 'Kg de Carga', key: 'costo_kg_carga' },
        ]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setShowRatesModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Tarifas Negociadas</h2>
                  <p className="text-sm text-slate-500">{selectedClientData.name}</p>
                </div>
                <button onClick={() => setShowRatesModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-5 space-y-6">
                {rule ? (
                  <>
                    {/* Tabla por tipo de grúa */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Costo por Tipo de Grúa</h3>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                            <th className="text-left p-2 font-semibold">Tipo</th>
                            <th className="text-right p-2 font-semibold">Local (Fijo)</th>
                            <th className="text-right p-2 font-semibold">Banderazo Foráneo</th>
                            <th className="text-right p-2 font-semibold">$/Km</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {TIPOS.map(t => (
                            <tr key={t}>
                              <td className="p-2 font-semibold text-slate-800">{TIPO_LABELS[t]}</td>
                              <td className="p-2 text-right text-slate-700">
                                ${Number(rule[`costo_local_tipo_${t}`] || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                              </td>
                              <td className="p-2 text-right text-slate-700">
                                ${Number(rule[`costo_bande_tipo_${t}`] || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                              </td>
                              <td className="p-2 text-right text-slate-700">
                                ${Number(rule[`costo_km_tipo_${t}`] || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Costos adicionales */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Costos Adicionales y Herramientas</h3>
                      <table className="w-full text-sm border-collapse">
                        <tbody className="divide-y divide-slate-100">
                          {extras.filter(e => Number(rule[e.key] || 0) > 0).map(e => (
                            <tr key={e.key}>
                              <td className="p-2 text-slate-600">{e.label}</td>
                              <td className="p-2 text-right font-semibold text-slate-800">
                                ${Number(rule[e.key] || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                          ))}
                          {extras.every(e => Number(rule[e.key] || 0) === 0) && (
                            <tr><td colSpan={2} className="p-2 text-slate-400 text-center italic">Sin costos adicionales configurados</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-slate-400 py-8">No hay tarifas configuradas para este cliente.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function UsersIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function TruckIcon(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 17h4V5H2v12h3" />
          <path d="M20 17h2v-9h-4V5H14v12h3" />
          <path d="M14 8h6v3h-6z" />
          <circle cx="8.5" cy="17.5" r="1.5" />
          <circle cx="18.5" cy="17.5" r="1.5" />
        </svg>
    )
}
