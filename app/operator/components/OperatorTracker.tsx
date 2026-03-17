'use client'

import { useEffect, useRef } from 'react'

interface OperatorTrackerProps {
  operatorId: string
  truckId: string
}

const UPDATE_INTERVAL_MS = 30 * 1000 // 30 seconds for real-time tracking

export default function OperatorTracker({ operatorId, truckId }: OperatorTrackerProps) {
  const lastUpdate = useRef<number>(0)

  useEffect(() => {
    if (!navigator.geolocation) return

    // Use ESM dynamic import — require() is NOT available in browser (Next.js App Router uses ESM)
    let supabase: any = null

    import('@/lib/supabase/client').then(({ createClient }) => {
      supabase = createClient()
    })

    async function pushLocation(latitude: number, longitude: number) {
      if (!supabase) return
      const now = Date.now()
      if (now - lastUpdate.current < UPDATE_INTERVAL_MS) return
      lastUpdate.current = now

      try {
        // Guardar tanto el JSON como columnas individuales para compatibilidad
        await supabase.from('tow_trucks').update({
          current_location:     { lat: latitude, lng: longitude },
          current_lat:          latitude,
          current_lng:          longitude,
          last_location_update: new Date().toISOString(),
        }).eq('id', truckId)
      } catch (_) {
        // GPS update failures are non-critical
      }
    }

    // Initial position (let supabase load first)
    setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lastUpdate.current = 0
          pushLocation(pos.coords.latitude, pos.coords.longitude)
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000 }
      )
    }, 1000)

    // Seguimiento continuo con watchPosition para mayor precisión
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        pushLocation(pos.coords.latitude, pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )

    // Fallback interval por si watchPosition no dispara
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lastUpdate.current = 0
          pushLocation(pos.coords.latitude, pos.coords.longitude)
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      )
    }, UPDATE_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
      navigator.geolocation.clearWatch(watchId)
    }
  }, [operatorId, truckId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
