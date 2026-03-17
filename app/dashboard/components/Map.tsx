'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

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
  const defaultCenter: [number, number] = [19.4326, -99.1332]

  // Solo operadores con coordenadas GPS reales
  const opsWithGPS = operators.filter(op => op.lat && op.lng)

  // Centrar en el primer operador con GPS, o en CDMX por defecto
  const center: [number, number] = opsWithGPS.length > 0
    ? [opsWithGPS[0].lat, opsWithGPS[0].lng]
    : defaultCenter

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-inner border border-slate-200 z-0 relative">
      <MapContainer
        center={center}
        zoom={opsWithGPS.length > 0 ? 14 : 11}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {opsWithGPS.map(op => (
          <Marker key={op.id} position={[op.lat, op.lng]} icon={customIcon}>
            <Popup>
              <div className="font-sans">
                <strong>{op.full_name}</strong><br />
                {op.grua_asignada || 'Sin grúa'}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {opsWithGPS.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-lg text-sm text-slate-500 shadow">
            📡 Esperando ubicación GPS de los operadores...
          </div>
        </div>
      )}
    </div>
  )
}

