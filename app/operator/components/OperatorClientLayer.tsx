'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// All browser-only imports go through dynamic() here in the CLIENT component
const PlateGate           = dynamic(() => import('./PlateGate'),           { ssr: false })
const OperatorTracker     = dynamic(() => import('./OperatorTracker'),      { ssr: false })
const DownloadPDFButton   = dynamic(() => import('./DownloadPDFButton'),    { ssr: false })
const AssignedTruckBanner = dynamic(() => import('./AssignedTruckBanner'), { ssr: false })

interface Truck {
  id: string
  unit_number: string
  brand: string
  model: string
  plates: string
}

interface Props {
  operatorId: string
  operatorName: string
  avatarUrl: string | null
  truck: Truck | null
  services: any[]
  children: React.ReactNode
}

/**
 * OperatorClientLayer — client component that:
 * 1. Shows PlateGate if no truck is linked (re-checks on client in case SSR was stale)
 * 2. Shows GPS tracker + dashboard when truck is linked
 * 3. Renders DownloadPDFButton for closed services (browser-only)
 */
export default function OperatorClientLayer({
  operatorId,
  operatorName,
  avatarUrl,
  truck: initialTruck,
  services,
  children,
}: Props) {
  const [truck, setTruck] = useState<Truck | null>(initialTruck)
  const [checked, setChecked] = useState(!!initialTruck)

  useEffect(() => {
    // If server already confirmed truck, skip re-check
    if (initialTruck) {
      setTruck(initialTruck)
      setChecked(true)
      return
    }
    // Server had no truck — re-check on client (session might be fresher)
    ;(async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        const { data: profileData } = await supabase
          .from('profiles')
          .select('tow_truck_id')
          .eq('id', operatorId)
          .single()

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
      } catch {
        setChecked(true)
      }
    })()
  }, [operatorId, initialTruck])

  // Loading spinner (only when no server data available)
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
        <p style={{ color: 'rgba(148,163,184,0.7)', fontSize: 14, marginTop: 12 }}>Cargando...</p>
      </div>
    )
  }

  // No truck — show plate gate
  if (!truck) {
    return <PlateGate operatorName={operatorName} avatarUrl={avatarUrl} />
  }

  // Truck confirmed — dashboard
  return (
    <div className="p-4 space-y-6 pb-24">
      {/* GPS tracker (invisible) */}
      <OperatorTracker operatorId={operatorId} truckId={truck.id} />

      {/* Truck banner with end-shift button */}
      <AssignedTruckBanner
        unit_number={truck.unit_number}
        plates={truck.plates}
        brand={truck.brand ?? ''}
        model={truck.model ?? ''}
      />

      {/* Server-rendered service header + cards */}
      {children}

      {/* PDF download buttons for closed services (browser-only) */}
      {services
        .filter(s => s.status === 'servicio_cerrado')
        .map(s => (
          <div key={`pdf-${s.id}`} className="-mt-2 px-0">
            <DownloadPDFButton service={s} />
          </div>
        ))
      }
    </div>
  )
}
