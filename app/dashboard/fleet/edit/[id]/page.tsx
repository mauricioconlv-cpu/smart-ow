'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Truck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateTowTruck } from '../../new/actions'

const UNIT_TYPES = [
  { value: 'A', label: 'Tipo A', desc: 'Menor a 3.5 ton' },
  { value: 'B', label: 'Tipo B', desc: '3.5 – 7.5 ton' },
  { value: 'C', label: 'Tipo C', desc: '7.5 – 11 ton' },
  { value: 'D', label: 'Tipo D', desc: '11 ton en adelante' },
]

const TOOLS = [
  { value: 'dollys',          label: 'Dollys' },
  { value: 'patines',         label: 'Patines' },
  { value: 'jumper',          label: 'Jumper (Paso de Corriente)' },
  { value: 'go_jacks',        label: 'Go Jacks' },
  { value: 'pistola_impacto', label: 'Pistola de Impacto' },
  { value: 'dardos',          label: 'Dardos / Herramienta de apertura' },
  { value: 'bidon',           label: 'Bidón p/Gasolina' },
]

export default function EditTowTruckPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()
  
  const [truck, setTruck] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorObj, setError] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [selectedVehicleType, setSelectedVehicleType] = useState('grua')

  useEffect(() => {
    async function loadTruck() {
      const { data, error } = await supabase.from('tow_trucks').select('*').eq('id', id).single()
      if (error) {
        setError('Grúa no encontrada o sin permisos.')
      } else {
        setTruck(data)
        setSelectedType(data.unit_type || '')
        setSelectedVehicleType(data.tipo_vehiculo || 'grua')
        setSelectedTools(data.tools || [])
      }
      setIsLoading(false)
    }
    loadTruck()
  }, [id, supabase])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    // Sync selectedTools manually since checkboxes may not all be checked
    selectedTools.forEach(t => {
      if (!formData.getAll('tools').includes(t)) formData.append('tools', t)
    })
    try {
        const result = await updateTowTruck(id, formData)
        if (result?.error) throw new Error(result.error)
        router.push('/dashboard/fleet')
        router.refresh()
    } catch (err: any) {
        setError(err.message || 'Error al actualizar.')
        setIsSaving(false)
    }
  }

  const toggleTool = (value: string) => {
    setSelectedTools(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    )
  }

  if (isLoading) return <div className="p-8 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></div>
  if (!truck) return <div className="p-8 text-center text-red-500 font-bold">{errorObj}</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/fleet" className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Modificar Unidad: {truck.economic_number}</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        {errorObj && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm border border-red-100">
            {errorObj}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Identidad */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b pb-2">Identidad de la Unidad</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número Económico</label>
                <input type="text" name="economic_number" defaultValue={truck.economic_number} required
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Placas de Circulación</label>
                <input type="text" name="plates" defaultValue={truck.plates} required
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"/>
              </div>
            </div>
          </div>

          {/* Datos del Vehículo */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b pb-2">Datos del Vehículo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                <input type="text" name="brand" defaultValue={truck.brand} required
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo / Año</label>
                <input type="text" name="model" defaultValue={truck.model} required
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"/>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie (VIN)</label>
                <input type="text" name="serial_number" defaultValue={truck.serial_number || ''}
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono text-sm"/>
              </div>

              {/* Estado Operativo */}
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800">Estado Operativo</h4>
                  <p className="text-xs text-slate-500 leading-tight mt-1">Si marcas esta unidad como inactiva (taller), no aparecerá disponible para despacho.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">Inactiva</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="is_active" defaultChecked={truck.is_active} value="true" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                  <span className="text-sm font-bold text-green-600 ml-1">Activa</span>
                </div>
              </div>
            </div>
          </div>

          {/* Clasificación Básica (Tipo de Vehículo) */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b pb-2">Clasificación Básica</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Clase de Vehículo</label>
              <div className="flex gap-4">
                {[
                  { id: 'grua', label: 'Grúa de Arrastre', icon: <Truck className="w-5 h-5 mb-1" /> },
                  { id: 'moto', label: 'Motocicleta', icon: <span className="text-xl mb-1">🏍️</span> },
                  { id: 'utilitario', label: 'Coche Utilitario', icon: <span className="text-xl mb-1">🚗</span> }
                ].map(vt => (
                  <label key={vt.id} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors
                    ${selectedVehicleType === vt.id ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300'}`}>
                    <input type="radio" name="tipo_vehiculo" value={vt.id} checked={selectedVehicleType === vt.id} onChange={() => setSelectedVehicleType(vt.id)} className="hidden" />
                    {vt.icon}
                    <span className="text-sm font-bold text-center">{vt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tipo de Unidad (Solo si es GRÚA) */}
            {selectedVehicleType === 'grua' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">¿Qué tipo de grúa es?</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {UNIT_TYPES.map(type => (
                    <label key={type.value}
                      className={`relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${selectedType === type.value
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300'}`}
                    >
                      <input type="radio" name="unit_type" value={type.value}
                        checked={selectedType === type.value}
                        onChange={() => setSelectedType(type.value)}
                        required={selectedVehicleType === 'grua'}
                        className="sr-only"/>
                      <span className="text-2xl font-black">{type.value}</span>
                      <span className="text-sm font-bold">{type.label}</span>
                      <span className="text-xs text-center leading-tight opacity-75">{type.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Herramientas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b pb-2">Herramientas de la Unidad</h3>
            <div className="grid grid-cols-2 gap-3">
              {TOOLS.map(tool => {
                const checked = selectedTools.includes(tool.value)
                return (
                  <label key={tool.value}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${checked ? 'border-green-500 bg-green-50 text-green-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-green-300'}`}
                  >
                    <input type="checkbox" name="tools" value={tool.value}
                      checked={checked} onChange={() => toggleTool(tool.value)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"/>
                    <span className="text-sm font-semibold">{tool.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link href="/dashboard/fleet"
              className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200">
              Cancelar
            </Link>
            <button type="submit" disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2">
              <Truck className="w-4 h-4"/>
              {isSaving ? 'Guardando...' : 'Actualizar Unidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
