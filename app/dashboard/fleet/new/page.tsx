'use client'

import { useActionState, useState } from 'react'
import { addTowTruck } from './actions'
import Link from 'next/link'
import { ArrowLeft, Truck } from 'lucide-react'
import PhotoUploader from '@/components/PhotoUploader'

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

export default function NewTowTruckPage() {
  const [state, formAction, isPending] = useActionState(addTowTruck, null)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [selectedVehicleType, setSelectedVehicleType] = useState('grua')
  const [photoUrl, setPhotoUrl] = useState('')

  const toggleTool = (value: string) => {
    setSelectedTools(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/dashboard/fleet" 
          className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Registrar Nueva Unidad</h1>
          <p className="text-slate-500 text-sm mt-1">Ingresa los datos del vehículo para añadirlo a tu flotilla SaaS.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        
        {state?.error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm border border-red-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
               <Truck className="w-4 h-4 text-red-600"/>
            </div>
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-8">
          {/* Hidden photo_url */}
          <input type="hidden" name="photo_url" value={photoUrl} />

          {/* Foto de la Unidad */}
          <div className="flex items-start gap-6">
            <PhotoUploader
              bucket="tow-trucks"
              folder="trucks"
              onUpload={setPhotoUrl}
              label="Foto de la Unidad"
              shape="square"
            />
            <p className="text-xs text-slate-400 mt-8 leading-relaxed">
              Sube una foto del vehículo.<br />Se comprimirá automáticamente a máx. 2.5 MB.
            </p>
          </div>

          {/* Bloque Identidad */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b pb-2">Identidad de la Unidad</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número Económico</label>
                <input 
                  type="text" name="economic_number" required placeholder="Ej. ECO-01"
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Placas de Circulación</label>
                <input 
                  type="text" name="plates" required placeholder="A-12-BCD"
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                />
              </div>
            </div>
          </div>

          {/* Bloque Vehículo */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b pb-2">Datos del Vehículo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                <input 
                  type="text" name="brand" required placeholder="Ej. Chevrolet"
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo / Año</label>
                <input 
                  type="text" name="model" required placeholder="Ej. Silverado 2024"
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie (VIN)</label>
                <input 
                  type="text" name="serial_number" placeholder="Opcional"
                  className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Clasificación de Vehículo y Unidad */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b pb-2">Clasificación Básica</h3>
            
            {/* Tipo de Vehículo */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Clase de Vehículo</label>
              <div className="flex gap-4">
                {[
                  { id: 'grua', label: 'Grúa de Arrastre', icon: <Truck className="w-5 h-5 mb-1" /> },
                  { id: 'moto', label: 'Motocicleta (Asistencia)', icon: <span className="text-xl mb-1">🏍️</span> },
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

            {/* Sub-Clasificación Unidad (Solo si es GRÚA) */}
            {selectedVehicleType === 'grua' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">¿Qué tipo de grúa es?</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {UNIT_TYPES.map(type => (
                    <label
                      key={type.value}
                      className={`relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${selectedType === type.value
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="unit_type"
                        value={type.value}
                        required={selectedVehicleType === 'grua'}
                        className="sr-only"
                        onChange={() => setSelectedType(type.value)}
                      />
                      <span className="text-2xl font-black">{type.value}</span>
                      <span className="text-sm font-bold">{type.label}</span>
                      <span className="text-xs text-center leading-tight opacity-75">{type.desc}</span>
                      {selectedType === type.value && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M3.5 6.5L5 8l3.5-4"/>
                          </svg>
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Herramientas */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b pb-2">¿Qué herramientas tiene esta unidad?</h3>
            <p className="text-xs text-slate-500">Selecciona todas las que apliquen (multiselección)</p>
            <div className="grid grid-cols-2 gap-3">
              {TOOLS.map(tool => {
                const checked = selectedTools.includes(tool.value)
                return (
                  <label
                    key={tool.value}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${checked
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-green-300 hover:bg-green-50/50'
                      }`}
                  >
                    <input
                      type="checkbox"
                      name="tools"
                      value={tool.value}
                      checked={checked}
                      onChange={() => toggleTool(tool.value)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-semibold">{tool.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link 
              href="/dashboard/fleet"
              className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              Cancelar
            </Link>
            <button 
              type="submit" 
              disabled={isPending}
              className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              <Truck className="w-4 h-4"/>
              {isPending ? 'Guardando...' : 'Guardar y Activar Unidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
