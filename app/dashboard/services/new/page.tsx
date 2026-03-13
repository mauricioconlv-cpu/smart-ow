'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, MapPin, Calculator, AlertCircle } from 'lucide-react'

// Use normal public client for client-side fetches
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function NewServicePage() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [tipoServicio, setTipoServicio] = useState<'local' | 'foraneo'>('local')
  
  const [distanciaAproximada, setDistanciaAproximada] = useState(0)
  const [costoCalculado, setCostoCalculado] = useState(0)

  // Cargar catalogos al montar
  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('clients').select('id, name, pricing_rules(*)')
      if (data) setClients(data)
    }
    loadData()
  }, [])

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
      setCostoCalculado(rule.costo_base)
    } else {
      // Foraneo: Banderazo + (Km * CostoKm)
      const banderazo = rule.costo_base
      const costoPorKm = rule.costo_km
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
              <MapPin className="h-5 w-5 text-red-500"/>
              Ubicaciones
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">Dirección de Origen (Dónde está el auto)</label>
                <input
                  type="text"
                  placeholder="Ej. Av. Reforma 222, CDMX"
                  className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900">Dirección de Destino (Taller / Corralón)</label>
                <input
                  type="text"
                  placeholder="Ej. Taller Mecánico Los Primos, Toluca"
                  className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
                />
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
                <label className="block text-xs font-medium leading-6 text-orange-900">Distancia Estimada (Kilómetros)</label>
                <input
                  type="number"
                  value={distanciaAproximada || ''}
                  onChange={(e) => setDistanciaAproximada(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="mt-1 block w-1/2 rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-orange-300 focus:ring-2 focus:ring-orange-600 sm:text-sm sm:leading-6"
                />
                <p className="mt-1 text-xs text-orange-700">En el futuro, esto se autocalculará con Google Maps Directions API basados en las direcciones de origen y destino.</p>
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

            <button
              type="button"
              className="mt-8 flex w-full justify-center items-center gap-2 rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Plus className="h-5 w-5" />
              Crear y Asignar Grúa
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
