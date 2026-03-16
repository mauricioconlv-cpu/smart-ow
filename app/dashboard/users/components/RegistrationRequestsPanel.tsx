'use client'

import { useEffect, useState, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Building2, Phone, Truck, Mail, X, Check, ChevronDown, Bell } from 'lucide-react'
import { approveRegistration, rejectRegistration } from '../registrationActions'

type Request = {
  id: string
  company_name: string
  admin_name: string
  email: string
  phone: string
  num_trucks: number
  created_at: string
}

export default function RegistrationRequestsPanel() {
  const [requests, setRequests] = useState<Request[]>([])
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actionFeedback, setActionFeedback] = useState<Record<string, 'approving' | 'rejecting' | 'done'>>({})

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (data) setRequests(data)
    }
    load()
    // Pollcar cada 30 seg
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const pendingCount = requests.length

  if (pendingCount === 0) return null

  const handleApprove = (id: string) => {
    setActionFeedback(prev => ({ ...prev, [id]: 'approving' }))
    startTransition(async () => {
      const result = await approveRegistration(id)
      if (result.success) {
        setRequests(prev => prev.filter(r => r.id !== id))
        setActionFeedback(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      } else {
        alert('Error al aprobar: ' + result.error)
        setActionFeedback(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    })
  }

  const handleReject = (id: string) => {
    if (!window.confirm('¿Rechazar esta solicitud? El solicitante no será notificado automáticamente.')) return
    setActionFeedback(prev => ({ ...prev, [id]: 'rejecting' }))
    startTransition(async () => {
      const result = await rejectRegistration(id)
      if (result.success) {
        setRequests(prev => prev.filter(r => r.id !== id))
      } else {
        alert('Error al rechazar: ' + result.error)
      }
      setActionFeedback(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    })
  }

  return (
    <div className="relative mb-4">
      {/* Botón burbuja */}
      <button
        onClick={() => { setOpen(o => !o); setSeen(true) }}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all"
      >
        <Bell className="w-4 h-4" />
        <span>Solicitudes de Registro</span>
        {!seen && pendingCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-black">
            {pendingCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-40 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div>
              <h3 className="font-bold text-slate-800">Solicitudes Pendientes</h3>
              <p className="text-xs text-slate-500">{pendingCount} solicitud(es) esperan tu revisión</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-full">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {requests.map(req => {
              const status = actionFeedback[req.id]
              return (
                <div key={req.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span className="font-bold text-slate-800">{req.company_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />{req.admin_name} — {req.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />{req.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" />{req.num_trucks} unidad(es)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Recibida: {new Date(req.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={!!status || isPending}
                      onClick={() => handleApprove(req.id)}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      {status === 'approving' ? 'Aprobando...' : 'Aceptar'}
                    </button>
                    <button
                      disabled={!!status || isPending}
                      onClick={() => handleReject(req.id)}
                      className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      {status === 'rejecting' ? 'Rechazando...' : 'Rechazar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
