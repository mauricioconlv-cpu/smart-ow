'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, X, UserCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface FreeAlert {
  serviceId: string
  folio: number
  operatorName: string
  tipoAsistencia: string
}

export default function OperatorFreeModal() {
  const [alerts, setAlerts] = useState<FreeAlert[]>([])
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('operator_free_alerts')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'services' },
        async (payload: any) => {
          const row = payload.new
          // Only trigger when status just became servicio_cerrado
          if (row.status !== 'servicio_cerrado') return
          // Skip if no operator
          if (!row.operator_id) return

          // Fetch operator name
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', row.operator_id)
            .single()

          const alert: FreeAlert = {
            serviceId:       row.id,
            folio:           row.folio,
            operatorName:    prof?.full_name ?? 'Operador',
            tipoAsistencia:  row.tipo_asistencia ?? 'grúa',
          }

          setAlerts(prev => {
            // Avoid duplicates
            if (prev.some(a => a.serviceId === row.id)) return prev
            return [alert, ...prev]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss(serviceId: string) {
    setAlerts(prev => prev.filter(a => a.serviceId !== serviceId))
  }

  if (alerts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 12,
      maxWidth: 380,
    }}>
      {alerts.map(alert => (
        <div
          key={alert.serviceId}
          style={{
            background: 'white',
            borderRadius: 18,
            border: '2px solid #22c55e',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 4px rgba(34,197,94,0.12)',
            overflow: 'hidden',
            animation: 'slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
        >
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(120%); opacity: 0; }
              to   { transform: translateX(0);    opacity: 1; }
            }
          `}</style>

          {/* Green top bar */}
          <div style={{
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <UserCheck style={{ width: 22, height: 22, color: 'white' }} />
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Operador Disponible
                </p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'white' }}>
                  {alert.operatorName}
                </p>
              </div>
            </div>
            <button
              onClick={() => dismiss(alert.serviceId)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X style={{ width: 16, height: 16, color: 'white' }} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <CheckCircle2 style={{ width: 32, height: 32, color: '#16a34a', flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  Folio #{alert.folio} — Servicio Concluido
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                  El operador ha completado el servicio y está libre para una nueva asignación.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href="/dashboard/services"
                onClick={() => dismiss(alert.serviceId)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none',
                }}
              >
                Asignar Nuevo Servicio <ArrowRight style={{ width: 15, height: 15 }} />
              </Link>
              <button
                onClick={() => dismiss(alert.serviceId)}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: '#f1f5f9', border: '1px solid #e2e8f0',
                  color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer',
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
