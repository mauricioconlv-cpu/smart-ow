'use client'

import { useEffect, useRef } from 'react'

interface OperatorTrackerProps {
  operatorId: string
  truckId: string
}

// Update GPS every 6 minutes
const UPDATE_INTERVAL_MS = 6 * 60 * 1000

export default function OperatorTracker({ operatorId, truckId }: OperatorTrackerProps) {
  const lastUpdate = useRef<number>(0)

  useEffect(() => {
    // createClient() MUST be inside useEffect — calling it at component level
    // causes SSR crash when the browser Supabase client tries to access localStorage
    const { createClient } = require('@/lib/supabase/client')
    const supabase = createClient()

    if (!navigator.geolocation) return

    async function pushLocation(latitude: number, longitude: number) {
      const now = Date.now()
      if (now - lastUpdate.current < UPDATE_INTERVAL_MS) return
      lastUpdate.current = now

      try {
        await supabase.from('tow_trucks').update({
          current_location: { lat: latitude, lng: longitude },
          last_location_update: new Date().toISOString(),
        }).eq('id', truckId)

        // Touch profiles.updated_at so live monitor sees operator as online
        await supabase.from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', operatorId)
      } catch (_) {
        // GPS update failures are non-critical — silently ignore
      }
    }

    // Send first position immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastUpdate.current = 0 // bypass throttle for first update
        pushLocation(pos.coords.latitude, pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000 }
    )

    // Then poll every 6 minutes
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lastUpdate.current = 0
          pushLocation(pos.coords.latitude, pos.coords.longitude)
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      )
    }, UPDATE_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [operatorId, truckId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
