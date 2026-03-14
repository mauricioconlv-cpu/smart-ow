'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Truck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateTowTruck } from '../../new/actions' // Corregida la ruta relativa

export default function EditTowTruckPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()
  
  const [truck, setTruck] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorObj, setError] = useState('')

  useEffect(() => {
    async function loadTruck() {
      const { data, error } = await supabase.from('tow_trucks').select('*').eq('id', id).single()
      if (error) {
        setError('Grúa no encontrada o sin permisos.')
      } else {
        setTruck(data)
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

  if (isLoading) return <div className="p-8 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></div>

  if (!truck) return <div className="p-8 text-center text-red-500 font-bold">{errorObj}</div>

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
          <h1 className="text-2xl font-bold text-slate-800">Modificar Unidad: {truck.economic_number}</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        
        {errorObj && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm border border-red-100 flex items-center gap-3">
             <AlertTriangle className="w-4 h-4 text-red-600"/>
            {errorObj}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:col-span-2">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Número Económico</label>
                        <input 
                            type="text" 
                            name="economic_number" 
                            defaultValue={truck.economic_number}
                            required 
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Placas de Circulación</label>
                        <input 
                            type="text" 
                            name="plates"
                            defaultValue={truck.plates} 
                            required 
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                        />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:col-span-2 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                        <input 
                            type="text" 
                            name="brand" 
                            defaultValue={truck.brand}
                            required 
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Modelo / Año</label>
                        <input 
                            type="text" 
                            name="model" 
                            defaultValue={truck.model}
                            required 
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie (VIN)</label>
                        <input 
                            type="text" 
                            name="serial_number" 
                            defaultValue={truck.serial_number || ''}
                            className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono text-sm"
                        />
                    </div>
                    
                    {/* Estatus del Vehículo */}
                    <div className="md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2 flex items-center justify-between">
                         <div>
                             <h4 className="font-semibold text-slate-800">Estado Operativo</h4>
                             <p className="text-xs text-slate-500 leading-tight mt-1">Si marcas esta unidad como inactiva (taller), no aparecerá disponible para ser despachada a un servicio.</p>
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

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-8">
            <Link 
              href="/dashboard/fleet"
              className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              Cancelar
            </Link>
            <button 
              type="submit" 
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              <Truck className="w-4 h-4"/>
              {isSaving ? 'Guardando...' : 'Actualizar Unidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AlertTriangle(props: any) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}
