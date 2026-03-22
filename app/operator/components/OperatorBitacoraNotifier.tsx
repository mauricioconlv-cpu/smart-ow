'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, X } from 'lucide-react'
import Link from 'next/link'

interface Alert {
  id: string
  serviceId: string
  folio: number | string
  note: string
  at: string
}

/**
 * Shows toast notifications to the operator when the dispatcher sends a text message.
 * Must be rendered inside a service context, passing the serviceId.
 */
export default function OperatorBitacoraNotifier({ serviceId }: { serviceId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const supabase             = createClient()
  const seenRef              = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!serviceId) return

    const channel = supabase
      .channel(`operator_notifier_${serviceId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'service_logs',
          filter: `service_id=eq.${serviceId}`,
        },
        async (payload: any) => {
          const row = payload.new
          if (row.actor_role !== 'dispatcher') return
          if (row.type !== 'dispatcher_note') return
          if (seenRef.current.has(row.id)) return
          seenRef.current.add(row.id)

          const { data: svc } = await supabase
            .from('services')
            .select('folio')
            .eq('id', serviceId)
            .single()

          setAlerts(prev => [{
            id:        row.id,
            serviceId,
            folio:     svc?.folio ?? '—',
            note:      row.note?.slice(0, 80) ?? '',
            at:        new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          }, ...prev].slice(0, 3))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [serviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  if (alerts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, width: 'min(92vw, 360px)',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      {alerts.map(alert => (
        <div
          key={alert.id}
          style={{
            background: 'linear-gradient(135deg,#0f172a,#1e293b)',
            borderRadius: 16, overflow: 'hidden',
            border: '1.5px solid rgba(37,99,235,0.5)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.3s cubic-bezier(0.175,0.885,0.32,1.275)',
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg,#1d4ed8,#1e40af)',
            padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare style={{ width: 15, height: 15, color: 'white' }} />
              <div>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Mensaje de la Cabina · Folio #{alert.folio}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'white', fontWeight: 700 }}>{alert.at}</p>
              </div>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X style={{ width: 14, height: 14, color: 'white' }} />
            </button>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alert.note && (
              <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
                "{alert.note}{alert.note.length >= 80 ? '…' : ''}"
              </p>
            )}
            <Link
              href={`/operator/service/${alert.serviceId}`}
              onClick={() => dismiss(alert.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px 14px', borderRadius: 8, textDecoration: 'none',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', fontWeight: 700, fontSize: 12,
              }}
            >
              Ver Expediente
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
