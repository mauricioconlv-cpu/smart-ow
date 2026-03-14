'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function OperatorTracker({ operatorId }: { operatorId: string }) {
  useEffect(() => {
    if (!navigator.geolocation) return

    const supabase = createClient()

    const updateLocation = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords
      
      // Update tow_trucks with current coordinates if tied to this operator? 
      // Actually, since we update the operator's active service or tow truck:
      supabase
        .from('profiles')
        .select('tow_truck_id')
        .eq('id', operatorId)
        .single()
        .then(({ data }) => {
           if (data?.tow_truck_id) {
             supabase.from('tow_trucks').update({
               current_location: { lat: latitude, lng: longitude },
               last_location_update: new Date().toISOString()
             }).eq('id', data.tow_truck_id).then()
           }
        })
    }

    // Get immediate position
    navigator.geolocation.getCurrentPosition(updateLocation, console.error, { enableHighAccuracy: true })

    // And watch position
    const watchId = navigator.geolocation.watchPosition(updateLocation, console.error, { 
       enableHighAccuracy: true,
       timeout: 10000,
       maximumAge: 5000 
    })

    return () => navigator.geolocation.clearWatch(watchId)
  }, [operatorId])

  return null // Invisible component
}
