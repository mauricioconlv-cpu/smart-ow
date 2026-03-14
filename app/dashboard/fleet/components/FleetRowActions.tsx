'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Edit2, Trash2, Loader2 } from 'lucide-react'
import { deleteTowTruck } from '../new/actions'

export default function FleetRowActions({ truckId, economicNumber }: { truckId: string, economicNumber: string }) {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        if (!window.confirm(`¿Estás completamente seguro de ELIMINAR la grúa ${economicNumber}? Esta acción es irreversible.`)) {
            return
        }
        
        setIsDeleting(true)
        try {
            const result = await deleteTowTruck(truckId)
            if (result?.error) {
                alert(result.error)
            } else {
                router.refresh()
            }
        } catch (error) {
            alert('Error inesperado al eliminar.')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex items-center gap-4">
            <Link 
                href={`/dashboard/fleet/edit/${truckId}`}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md border border-blue-200"
            >
                <Edit2 className="w-3.5 h-3.5" />
                Editar
            </Link>

            <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center gap-1 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md border border-red-200 disabled:opacity-50"
            >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Eliminar
            </button>
        </div>
    )
}
