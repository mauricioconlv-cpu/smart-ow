'use client'

import { useActionState } from 'react'
import { addTowTruck } from './actions'
import Link from 'next/link'
import { ArrowLeft, Truck } from 'lucide-react'

export default function NewTowTruckPage() {
  const [state, formAction, isPending] = useActionState(addTowTruck, null)

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

        <form action={formAction} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bloque Identidad */}
              <div className="space-y-4 md:col-span-2">
                 <h3 className="font-semibold text-slate-700 border-b pb-2">Identidad de la Unidad</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Número Económico</label>
                        <input 
                            type="text" 
                            name="economic_number" 
                            required 
                            placeholder="Ej. ECO-01"
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Placas de Circulación</label>
                        <input 
                            type="text" 
                            name="plates" 
                            required 
                            placeholder="A-12-BCD"
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                        />
                    </div>
                 </div>
              </div>

              {/* Bloque Vehículo */}
              <div className="space-y-4 md:col-span-2 mt-4">
                 <h3 className="font-semibold text-slate-700 border-b pb-2">Datos del Vehículo</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                        <input 
                            type="text" 
                            name="brand" 
                            required 
                            placeholder="Ej. Chevrolet"
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Modelo / Año</label>
                        <input 
                            type="text" 
                            name="model" 
                            required 
                            placeholder="Ej. Silverado 2024"
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie (VIN)</label>
                        <input 
                            type="text" 
                            name="serial_number" 
                            placeholder="Opcional"
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono text-sm"
                        />
                    </div>
                 </div>
              </div>
           </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-8">
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
