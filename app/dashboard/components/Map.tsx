'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect } from 'react'

// Corrección para iconos de Leaflet en Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export default function EnhancedMap({ operators }: { operators: any[] }) {
  // Centro por defecto: Ciudad de México (puedes cambiarlo)
  const defaultCenter: [number, number] = [19.4326, -99.1332]

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-inner border border-slate-200 z-0 relative">
      <MapContainer 
        center={defaultCenter} 
        zoom={11} 
        scrollWheelZoom={true} 
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {
          operators.map(op => {
             // Asignamos una posición simulada si no tienen GPS real para propósitos demostrativos
             const pos: [number, number] = op.lat && op.lng ? [op.lat, op.lng] : defaultCenter;
             return (
              <Marker key={op.id} position={pos} icon={customIcon}>
                <Popup>
                  <div className="font-sans">
                    <strong>{op.full_name}</strong><br />
                    {op.grua_asignada || 'Sin grúa'}
                  </div>
                </Popup>
              </Marker>
             )
          })
        }
      </MapContainer>
    </div>
  )
}
