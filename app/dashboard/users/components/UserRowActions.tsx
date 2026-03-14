'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Edit2, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { deleteEmployee } from '../actions'

interface UserRowActionsProps {
  userId: string
  fullName: string
  isSelf: boolean
  role: string
}

export default function UserRowActions({ userId, fullName, isSelf, role }: UserRowActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (isSelf) {
      alert('Por seguridad, no puedes eliminar tu propia sesión.')
      return
    }

    if (role === 'superadmin') {
      alert('Un Súper Administrador no puede ser eliminado desde este panel.')
      return
    }

    const confirmMessage = `⚠️ ATENCIÓN: ¿Estás seguro de ELIMINAR al empleado/usuario "${fullName || 'Usuario Sin Nombre'}"?\n\nEsta acción purgará su cuenta de acceso permanentemente y no podrá volver a iniciar sesión.`
    
    if (!window.confirm(confirmMessage)) {
      return
    }
    
    setIsDeleting(true)
    try {
      const result = await deleteEmployee(userId)
      if (result?.error) {
        alert(`Error al eliminar: ${result.error}`)
      }
    } catch (error) {
      alert('Ocurrió un error inesperado de red al intentar borrar la cuenta.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 mt-4 justify-end border-t border-slate-100 pt-3">
      <Link 
        href={`/dashboard/users/edit/${userId}`}
        className="text-blue-600 hover:text-blue-800 font-medium text-xs flex items-center gap-1.5 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md"
      >
        <Edit2 className="w-3.5 h-3.5" />
        Editar Perfil
      </Link>

      <button 
        onClick={handleDelete}
        disabled={isDeleting || isSelf || role === 'superadmin'}
        className={`font-medium text-xs flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md ${
           (isSelf || role === 'superadmin') 
           ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
           : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-800'
        } disabled:opacity-50`}
        title={isSelf ? "No puedes borrarte a ti mismo" : role === 'superadmin' ? "SuperAdmins protegidos" : "Eliminar Empleado"}
      >
        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Eliminar Acceso
      </button>
    </div>
  )
}
