'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PlateGate from './PlateGate'
import OperatorTracker from './OperatorTracker'

interface OperatorShellProps {
  operatorId: string
  operatorName: string
  avatarUrl: string | null
  initialTruck: {
    id: string
    unit_number: string
    brand: string
    model: string
    plates: string
  } | null
  children: React.ReactNode
}

/**
 * OperatorShell — Manages the plate-gate flow.
 * Shows PlateGate if operator has no truck linked, 
 * shows the operator dashboard otherwise.
 */
export default function OperatorShell({
  operatorId,
  operatorName,
  avatarUrl,
  initialTruck,
  children,
}: OperatorShellProps) {
  const [truck, setTruck] = useState(initialTruck)
  const [isLoaded, setIsLoaded] = useState(false)

  // Re-check on client to avoid SSR caching the linked state
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('tow_truck_id, tow_trucks(id, unit_number, brand, model, plates)')
      .eq('id', operatorId)
      .single()
      .then(({ data }) => {
        const linked = (data as any)?.tow_trucks || null
        setTruck(linked)
        setIsLoaded(true)
      })
  }, [operatorId])

  // Waiting for client-side check
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // If not linked to a truck → show plate gate
  if (!truck) {
    return (
      <PlateGate
        operatorName={operatorName}
        avatarUrl={avatarUrl}
        onLinked={(linkedTruck) => setTruck(linkedTruck)}
      />
    )
  }

  // Linked — show normal dashboard with GPS tracker running
  return (
    <>
      <OperatorTracker operatorId={operatorId} truckId={truck.id} />
      {children}
    </>
  )
}
