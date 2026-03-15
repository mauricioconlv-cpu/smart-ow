'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PlateGate from './PlateGate'
import OperatorTracker from './OperatorTracker'

interface Truck {
  id: string
  unit_number: string
  brand: string
  model: string
  plates: string
}

interface OperatorShellProps {
  operatorId: string
  operatorName: string
  avatarUrl: string | null
  initialTruck: Truck | null
  children: React.ReactNode
}

/**
 * OperatorShell — Shows PlateGate if no truck is linked, otherwise shows dashboard.
 * Re-checks on the client to avoid stale SSR cache.
 */
export default function OperatorShell({
  operatorId,
  operatorName,
  avatarUrl,
  initialTruck,
  children,
}: OperatorShellProps) {
  // Start with the server-side value; re-validate on client
  const [truck, setTruck] = useState<Truck | null>(initialTruck)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Re-validate on client in case SSR was stale
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('tow_truck_id')
      .eq('id', operatorId)
      .single()
      .then(async ({ data: profileData }) => {
        if (!profileData?.tow_truck_id) {
          setTruck(null)
          setChecked(true)
          return
        }
        // Fetch truck separately
        const { data: truckData } = await supabase
          .from('tow_trucks')
          .select('id, unit_number, brand, model, plates')
          .eq('id', profileData.tow_truck_id)
          .single()

        setTruck(truckData || null)
        setChecked(true)
      })
      .catch(() => {
        // On error, trust the server value
        setChecked(true)
      })
  }, [operatorId])

  // Loading state while re-checking
  if (!checked && !initialTruck) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #060b18 0%, #0d1530 60%, #0a0f20 100%)'
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '4px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 14, marginTop: 12 }}>
          Cargando...
        </p>
      </div>
    )
  }

  // No truck linked → show the plate gate (PlateGate handles reload after success)
  if (!truck) {
    return (
      <PlateGate
        operatorName={operatorName}
        avatarUrl={avatarUrl}
      />
    )
  }

  // Truck linked → show GPS tracker + dashboard content
  return (
    <>
      <OperatorTracker operatorId={operatorId} truckId={truck.id} />
      {children}
    </>
  )
}
