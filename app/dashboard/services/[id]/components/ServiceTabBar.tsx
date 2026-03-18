'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Navigation, ArrowLeft } from 'lucide-react'

export default function ServiceTabBar({ id }: { id: string }) {
  const pathname = usePathname()
  const isCapture  = pathname.includes('/capture')
  const isTracking = pathname.includes('/tracking')

  return (
    <div style={{
      background: 'white',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      paddingLeft: 8,
    }}>
      {/* Back */}
      <Link
        href="/dashboard/services"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '14px 16px', fontSize: 13, fontWeight: 600,
          color: '#64748b', textDecoration: 'none', borderRight: '1px solid #f1f5f9',
        }}
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Servicios
      </Link>

      {/* Tab: Captura */}
      <Link
        href={`/dashboard/services/${id}/capture`}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '14px 20px', fontSize: 13, fontWeight: 700,
          color: isCapture ? '#1d4ed8' : '#64748b',
          textDecoration: 'none',
          borderBottom: isCapture ? '2px solid #2563eb' : '2px solid transparent',
          background: isCapture ? '#eff6ff' : 'transparent',
          transition: 'all 0.15s',
        }}
      >
        <FileText style={{ width: 15, height: 15 }} />
        Captura de Servicio
      </Link>

      {/* Tab: Seguimiento */}
      <Link
        href={`/dashboard/services/${id}/tracking`}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '14px 20px', fontSize: 13, fontWeight: 700,
          color: isTracking ? '#1d4ed8' : '#64748b',
          textDecoration: 'none',
          borderBottom: isTracking ? '2px solid #2563eb' : '2px solid transparent',
          background: isTracking ? '#eff6ff' : 'transparent',
          transition: 'all 0.15s',
        }}
      >
        <Navigation style={{ width: 15, height: 15 }} />
        Seguimiento en Vivo
      </Link>
    </div>
  )
}
