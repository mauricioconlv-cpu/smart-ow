'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import PlateGate from './PlateGate'

// OperatorTracker MUST be loaded with SSR disabled — it uses browser geolocation and
// calls createClient() which accesses localStorage (unavailable on server)
const OperatorTracker = dynamic(() => import('./OperatorTracker'), { ssr: false })

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

export default function OperatorShell({
  operatorId,
  operatorName,
  avatarUrl,
  initialTruck,
  children,
}: OperatorShellProps) {
  const [truck, setTruck] = useState<Truck | null>(initialTruck)
  const [checked, setChecked] = useState(!!initialTruck) // if server already knows the truck, skip re-check

  useEffect(() => {
    if (checked) return // Already have verified data from server

    // Re-validate since SSR value could be stale
    import('@/lib/supabase/client').then(({ createClient }) => {
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
          const { data: truckData } = await supabase
            .from('tow_trucks')
            .select('id, unit_number, brand, model, plates')
            .eq('id', profileData.tow_truck_id)
            .single()

          setTruck(truckData || null)
          setChecked(true)
        })
        .catch(() => setChecked(true))
    })
  }, [operatorId, checked])

  // Loading while we verify
  if (!checked) {
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

  // No truck → plate gate
  if (!truck) {
    return <PlateGate operatorName={operatorName} avatarUrl={avatarUrl} />
  }

  // Truck linked → GPS tracker (client-only) + dashboard content
  return (
    <>
      <OperatorTracker operatorId={operatorId} truckId={truck.id} />
      {children}
    </>
  )
}
