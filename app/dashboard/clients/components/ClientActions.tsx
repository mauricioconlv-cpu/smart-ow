'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { deleteClient } from '../actions'
import { Trash2, Pencil } from 'lucide-react'

export function ClientActions({ clientId, clientName, canEdit }: { clientId: string; clientName: string; canEdit: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (!canEdit) return null

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Eliminar a "${clientName}"?\n\nEsta acción es irreversible y eliminará también sus tarifas.`
    )
    if (!confirmed) return
    setLoading(true)
    const result = await deleteClient(clientId)
    if (result?.error) {
      alert('Error al eliminar: ' + result.error)
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/dashboard/clients/${clientId}/edit`}
        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
      >
        <Pencil className="w-3.5 h-3.5" />
        Editar Tarifas
      </Link>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-40"
      >
        <Trash2 className="w-3.5 h-3.5" />
        {loading ? 'Eliminando...' : 'Eliminar'}
      </button>
    </div>
  )
}
