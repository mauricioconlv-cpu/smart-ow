'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
  truckGps: { lat: number; lng: number } | null
  originCoords:  { lat?: number; lng?: number; latitude?: number; longitude?: number } | null
  destCoords:    { lat?: number; lng?: number; latitude?: number; longitude?: number } | null
}

function coord(c: any): [number, number] | null {
  if (!c) return null
  const lat = c.lat ?? c.latitude
  const lng = c.lng ?? c.longitude
  if (!lat || !lng) return null
  return [lat, lng]
}

const truckIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2">
  <rect x="1" y="3" width="15" height="13" rx="2" fill="#2563eb"/>
  <path d="M16 8h4l3 5v4h-7V8z" fill="#1d4ed8" stroke="white"/>
  <circle cx="6" cy="19" r="2" fill="#1e293b" stroke="white"/>
  <circle cx="18" cy="19" r="2" fill="#1e293b" stroke="white"/>
</svg>`

export default function TrackingMap({ truckGps, originCoords, destCoords }: Props) {
  const mapRef     = useRef<L.Map | null>(null)
  const markerRef  = useRef<L.Marker | null>(null)
  const divRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!divRef.current || mapRef.current) return

    // Centro inicial
    const center: [number, number] = truckGps
      ? [truckGps.lat, truckGps.lng]
      : (coord(originCoords) ?? [19.4326, -99.1332]) // CDMX fallback

    const map = L.map(divRef.current, {
      center, zoom: 14,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    // Marcador de camión
    if (truckGps) {
      const icon = L.divIcon({
        html: truckIconSvg,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      markerRef.current = L.marker([truckGps.lat, truckGps.lng], { icon })
        .addTo(map)
        .bindPopup('🚛 Grúa — GPS Activo')
    }

    // Marcador de origen
    const or = coord(originCoords)
    if (or) {
      L.circleMarker(or, { radius: 9, color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 })
        .addTo(map)
        .bindPopup('🔴 Origen')
    }

    // Marcador de destino
    const de = coord(destCoords)
    if (de) {
      L.circleMarker(de, { radius: 9, color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.9, weight: 2 })
        .addTo(map)
        .bindPopup('🟢 Destino')
    }

    // Ajustar bounds para mostrar todos los puntos
    const points: [number, number][] = []
    if (truckGps) points.push([truckGps.lat, truckGps.lng])
    if (or) points.push(or)
    if (de) points.push(de)
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30] })

    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Actualizar posición del camión cuando cambia GPS
  useEffect(() => {
    if (!mapRef.current || !truckGps) return
    if (markerRef.current) {
      markerRef.current.setLatLng([truckGps.lat, truckGps.lng])
    }
  }, [truckGps])

  return <div ref={divRef} style={{ height: '100%', width: '100%' }} />
}
