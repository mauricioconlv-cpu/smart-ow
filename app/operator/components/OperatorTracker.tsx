'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OperatorTrackerProps {
  operatorId: string
  truckId: string
}

// Update GPS every 6 minutes (360,000 ms)
const UPDATE_INTERVAL_MS = 6 * 60 * 1000

export default function OperatorTracker({ operatorId, truckId }: OperatorTrackerProps) {
  const lastUpdate = useRef<number>(0)
  const supabase = createClient()

  async function pushLocation(latitude: number, longitude: number) {
    const now = Date.now()
    // Throttle: only send if 6 minutes have passed since last update
    if (now - lastUpdate.current < UPDATE_INTERVAL_MS) return
    lastUpdate.current = now

    await supabase.from('tow_trucks').update({
      current_location: { lat: latitude, lng: longitude },
      last_location_update: new Date().toISOString(),
    }).eq('id', truckId)

    // Also touch profiles.updated_at so live monitor sees operator as online
    await supabase.from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', operatorId)
  }

  useEffect(() => {
    if (!navigator.geolocation) return

    // Get first position immediately (no throttle for the very first push)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastUpdate.current = 0 // Force first update through
        pushLocation(pos.coords.latitude, pos.coords.longitude)
      },
      console.error,
      { enableHighAccuracy: true, timeout: 15000 }
    )

    // Then use setInterval to request position every 6 minutes
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lastUpdate.current = 0 // Force interval updates through
          pushLocation(pos.coords.latitude, pos.coords.longitude)
        },
        console.error,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      )
    }, UPDATE_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [operatorId, truckId])

  return null
}
