'use client'

import { useState, useEffect } from 'react'
import { KeyRound, User, Phone, Loader2, CheckCircle2, AlertTriangle, X, Eye, EyeOff } from 'lucide-react'

interface PasswordRequest {
  id: string
  created_at: string
  status: string
  profiles: {
    id: string
    full_name: string
    phone: string
    role: string
  }
}

export default function PasswordRequestsPanel() {
  const [requests, setRequests] = useState<PasswordRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<PasswordRequest | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState(false)

  async function loadRequests() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/password-requests')
      const data = await res.json()
      setRequests(data.requests || [])
    } catch {
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadRequests() }, [])

  async function handleReset() {
    if (!activeModal) return
    if (!newPassword || newPassword.length < 6) {
      setModalError('Mínimo 6 caracteres.')
      return
    }
    setIsSaving(true)
    setModalError('')

    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId: activeModal.profiles.id,
        newPassword,
        requestId: activeModal.id,
      }),
    })

    const data = await res.json()
    setIsSaving(false)

    if (!res.ok || data.error) {
      setModalError(data.error || 'Error al cambiar contraseña.')
      return
    }

    setModalSuccess(true)
    setTimeout(() => {
      setActiveModal(null)
      setNewPassword('')
      setModalSuccess(false)
      setModalError('')
      loadRequests()
    }, 1500)
  }

  async function handleDeny(requestId: string) {
    await fetch('/api/password-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    })
    loadRequests()
  }

  if (isLoading) return null
  if (requests.length === 0) return null

  return (
    <>
      {/* Panel de solicitudes */}
      <div className="glass-card border border-orange-500/20 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-orange-500/15"
             style={{ background: 'linear-gradient(90deg, rgba(249,115,22,0.08), transparent)' }}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm">Solicitudes de Cambio de Contraseña</h3>
            <p className="text-xs text-slate-400">Pendientes de resolución</p>
          </div>
          <span className="badge badge-orange text-xs">
            {requests.length} pendiente{requests.length !== 1 ? 's' : ''}
          </span>
        </div>

        <ul className="divide-y divide-white/5">
          {requests.map(req => (
            <li key={req.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{req.profiles.full_name || 'Sin nombre'}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {req.profiles.phone || '—'}
                    <span className="mx-1">·</span>
                    {new Date(req.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveModal(req)
                    setNewPassword('')
                    setModalError('')
                    setModalSuccess(false)
                  }}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  <KeyRound className="w-3 h-3" /> Restablecer
                </button>
                <button
                  onClick={() => handleDeny(req.id)}
                  className="btn-ghost text-xs px-3 py-1.5 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg"
                >
                  <X className="w-3 h-3" /> Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Modal para establecer nueva contraseña */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card w-full max-w-md p-6 space-y-5 border border-white/15">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Establecer Nueva Contraseña</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Para: <span className="text-white">{activeModal.profiles.full_name}</span>
                </p>
              </div>
              <button
                onClick={() => { setActiveModal(null); setNewPassword('') }}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {modalError}
              </div>
            )}

            {modalSuccess ? (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                <p className="text-white font-semibold">¡Contraseña restablecida!</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Nueva contraseña para {activeModal.profiles.full_name?.split(' ')[0]}
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="input-glass pr-10"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Comunica la nueva contraseña al empleado de forma segura (en persona o por medio privado).
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setActiveModal(null); setNewPassword('') }}
                    className="btn-ghost text-sm px-4 py-2 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={isSaving || newPassword.length < 6}
                    className="btn-primary text-sm px-5 py-2 disabled:opacity-50"
                  >
                    {isSaving
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                      : <><KeyRound className="w-3.5 h-3.5" /> Establecer Contraseña</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
