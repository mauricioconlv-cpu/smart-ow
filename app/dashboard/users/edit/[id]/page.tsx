'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Loader2, AlertTriangle, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateEmployee } from '../../actions'

export default function EditUserPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()
  
  const [profile, setProfile] = useState<any>(null)
  const [towTrucks, setTowTrucks] = useState<any[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorObj, setError] = useState('')
  
  const [selectedRole, setSelectedRole] = useState('')

  useEffect(() => {
    async function loadData() {
      // 1. Cargar el Empleado
      const { data: pData, error: pError } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (pError || !pData) {
        setError('No se pudo encontrar el empleado o no tienes permisos.')
        setIsLoading(false)
        return
      }
      setProfile(pData)
      setSelectedRole(pData.role)

      // 2. Cargar Grúas Activas (si es operador)
      const { data: tData } = await supabase.from('tow_trucks').select('*').eq('is_active', true)
      if (tData) setTowTrucks(tData)

      setIsLoading(false)
    }
    loadData()
  }, [id, supabase])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    try {
        const result = await updateEmployee(id, formData)
        if (result?.error) throw new Error(result.error)
        router.push('/dashboard/users')
        router.refresh()
    } catch (err: any) {
        setError(err.message || 'Error al actualizar el sistema.')
        setIsSaving(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center text-slate-500"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></div>

  if (!profile) return <div className="p-8 text-center text-red-500 font-bold">{errorObj}</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/dashboard/users" 
          className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Modificar Perfil: {profile.full_name}</h1>
          <p className="text-sm text-slate-500 mt-1">
             Identificador: <span className="font-mono text-xs bg-slate-100 px-1 rounded">{profile.id}</span>
          </p>
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
             <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo del Empleado</label>
                  <input 
                      type="text" 
                      name="fullName" 
                      defaultValue={profile.full_name}
                      required 
                      className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 capitalize"
                  />
               </div>

               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Rol de Acceso en el Call Center</label>
                 <select
                   name="role"
                   value={selectedRole}
                   onChange={(e) => setSelectedRole(e.target.value)}
                   className="bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                 >
                    <option value="admin">Administrador Múltiple</option>
                    <option value="dispatcher">Despachador (Solo Cabina)</option>
                    <option value="operator">Operador / Chófer de Grúa</option>
                 </select>
               </div>

               {selectedRole === 'operator' && (
                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                       <Truck className="w-4 h-4 text-slate-500"/>
                       Asignación Física de Unidad (Aplica Ruteo)
                    </label>
                    <select
                      name="grua_asignada"
                      defaultValue={profile.tow_truck_id || profile.grua_asignada || ''}
                      className="mt-2 bg-white text-slate-900 w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- Sin Vehículo Asignado --</option>
                      {towTrucks.map(truck => (
                        <option key={truck.id} value={truck.id}>
                          Eco: {truck.economic_number} | {truck.brand} - {truck.plates}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-2">Al re-asignar un vehículo, el sistema tomará la posición GPS de dicha unidad para cotizar servicios cercanos.</p>
                 </div>
               )}
             </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-8">
            <Link 
              href="/dashboard/users"
              className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              Cerrar
            </Link>
            <button 
              type="submit" 
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              <User className="w-4 h-4"/>
              {isSaving ? 'Aplicando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
