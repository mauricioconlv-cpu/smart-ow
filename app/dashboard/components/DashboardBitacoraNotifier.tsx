'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Alert {
  id: string
  serviceId: string
  folio: number | string
  actorRole: 'operator'
  type: string
  note: string
  at: string
}

export default function DashboardBitacoraNotifier() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const supabase = createClient()
  const seenRef  = useRef<Set<string>>(new Set())

  useEffect(() => {
    const channel = supabase
      .channel('dashboard_bitacora_notifier')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'service_logs',
        },
        async (payload: any) => {
          const row = payload.new
          // Only operator messages
          if (row.actor_role !== 'operator') return
          if (!['voice_note', 'operator_note'].includes(row.type)) return
          // Avoid duplicates
          if (seenRef.current.has(row.id)) return
          seenRef.current.add(row.id)

          // Get folio
          const { data: svc } = await supabase
            .from('services')
            .select('folio')
            .eq('id', row.service_id)
            .single()

          const alert: Alert = {
            id:        row.id,
            serviceId: row.service_id,
            folio:     svc?.folio ?? '—',
            actorRole: 'operator',
            type:      row.type,
            note:      row.note?.slice(0, 80) ?? '',
            at:        new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          }
          setAlerts(prev => [alert, ...prev].slice(0, 5)) // max 5 simultáneas
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  if (alerts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 72, right: 24, zIndex: 9998,
      display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360,
    }}>
      {alerts.map(alert => (
        <div
          key={alert.id}
          style={{
            background: 'linear-gradient(135deg, #1e1b4b, #1e293b)',
            borderRadius: 16, overflow: 'hidden',
            border: '1.5px solid rgba(99,102,241,0.4)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 0 3px rgba(99,102,241,0.1)',
            animation: 'slideInRight 0.35s cubic-bezier(0.175,0.885,0.32,1.275)',
          }}
        >
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(110%); opacity: 0; }
              to   { transform: translateX(0);    opacity: 1; }
            }
          `}</style>

          {/* Header */}
          <div style={{
            background: alert.type === 'voice_note'
              ? 'linear-gradient(135deg,#7c3aed,#6d28d9)'
              : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell style={{ width: 16, height: 16, color: 'white' }} />
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                  {alert.type === 'voice_note' ? '🎙️ Mensaje de Voz' : '💬 Mensaje de Texto'} · Folio #{alert.folio}
                </p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'white' }}>
                  Operador — {alert.at}
                </p>
              </div>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X style={{ width: 14, height: 14, color: 'white' }} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alert.note && (
              <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                "{alert.note}{alert.note.length >= 80 ? '…' : ''}"
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href={`/dashboard/services/${alert.serviceId}/tracking`}
                onClick={() => dismiss(alert.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
                  background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                  color: 'white', fontWeight: 700, fontSize: 12,
                }}
              >
                Ver Expediente <ArrowRight style={{ width: 13, height: 13 }} />
              </Link>
              <button
                onClick={() => dismiss(alert.id)}
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#94a3b8', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
