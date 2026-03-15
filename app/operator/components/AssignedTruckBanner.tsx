'use client'

import { Truck, LogOut } from 'lucide-react'

interface AssignedTruckBannerProps {
  unit_number: string
  plates: string
  brand: string
  model: string
}

export default function AssignedTruckBanner({ unit_number, plates, brand, model }: AssignedTruckBannerProps) {
  async function handleEndShift() {
    await fetch('/api/operator/link-truck', { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="bg-blue-600 text-white rounded-2xl shadow-md p-5 flex items-center gap-4">
      <div className="bg-blue-500/50 p-3 rounded-full">
        <Truck className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-blue-100">Unidad Asignada</h3>
        <p className="font-bold text-xl">
          {unit_number}{' '}
          <span className="text-sm font-normal text-blue-200 ml-1">({plates})</span>
        </p>
        <p className="text-xs text-blue-200 mt-0.5">{brand} {model}</p>
      </div>
      <button
        onClick={handleEndShift}
        className="flex items-center gap-1 text-xs text-blue-200 hover:text-white bg-blue-500/30 hover:bg-blue-500/50 rounded-lg px-3 py-2 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Fin Turno
      </button>
    </div>
  )
}
