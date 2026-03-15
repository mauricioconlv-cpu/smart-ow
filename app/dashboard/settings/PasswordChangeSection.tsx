'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, Bell } from 'lucide-react'

interface PasswordChangeSectionProps {
  role: string
  userId: string
}

export default function PasswordChangeSection({ role, userId }: PasswordChangeSectionProps) {
  const supabase = createClient()
  const canSelfChange = role === 'superadmin' || role === 'admin'

  // ── Estado cambio propio (superadmin/admin) ──
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdError, setPwdError] = useState('')

  // ── Estado solicitud (dispatcher/operator) ──
  const [isRequesting, setIsRequesting] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [requestError, setRequestError] = useState('')

  async function handleChangeOwnPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError('')
    if (newPwd !== confirmPwd) { setPwdError('Las contraseñas nuevas no coinciden.'); return }
    if (newPwd.length < 6) { setPwdError('Mínimo 6 caracteres.'); return }

    setIsSaving(true)
    // Verificar contraseña actual re-autenticando
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email
    if (!email) { setPwdError('No se pudo verificar tu sesión.'); setIsSaving(false); return }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPwd })
    if (signInErr) { setPwdError('La contraseña actual es incorrecta.'); setIsSaving(false); return }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd })
    setIsSaving(false)

    if (updateErr) { setPwdError('Error al actualizar: ' + updateErr.message); return }

    setPwdSuccess(true)
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    setTimeout(() => setPwdSuccess(false), 5000)
  }

  async function handleRequestChange() {
    setIsRequesting(true)
    setRequestError('')
    try {
      const res = await fetch('/api/password-requests', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      setRequestSuccess(true)
    } catch (err: any) {
      setRequestError(err.message || 'Error al enviar solicitud.')
    } finally {
      setIsRequesting(false)
    }
  }

  const pwdStrength = newPwd.length === 0 ? 0 : newPwd.length < 6 ? 1 : newPwd.length < 9 ? 2 : newPwd.length < 12 ? 3 : 4
  const strengthLabels = ['', 'Muy corta', 'Débil', 'Moderada', 'Fuerte']
  const strengthColors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400']

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
          <KeyRound className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Seguridad — Contraseña</h3>
          <p className="text-xs text-slate-400">
            {canSelfChange ? 'Cambia tu contraseña de acceso.' : 'Solicita un cambio de contraseña a tu administrador.'}
          </p>
        </div>
      </div>

      {/* ══ SUPERADMIN / ADMIN: formulario directo ══ */}
      {canSelfChange && (
        <form onSubmit={handleChangeOwnPassword} className="space-y-4">
          {pwdError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Contraseña actualizada correctamente.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Contraseña Actual</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                required
                placeholder="Tu contraseña actual"
                className="input-glass pr-10"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="glow-divider" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nueva Contraseña</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
                className="input-glass"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Confirmar Nueva</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                required
                placeholder="Repite la nueva contraseña"
                className="input-glass"
              />
            </div>
          </div>

          {newPwd.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <div
                    key={n}
                    className={`h-1 flex-1 rounded-full transition-all ${pwdStrength >= n ? strengthColors[pwdStrength] : 'bg-slate-700'}`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500">{strengthLabels[pwdStrength]}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving || !currentPwd || !newPwd || !confirmPwd}
            className="btn-primary text-sm px-5 py-2.5 disabled:opacity-50"
          >
            {isSaving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
              : <><KeyRound className="w-3.5 h-3.5" /> Cambiar Contraseña</>
            }
          </button>
        </form>
      )}

      {/* ══ OTROS ROLES: solicitud ══ */}
      {!canSelfChange && (
        <div className="space-y-4">
          {requestError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {requestError}
            </div>
          )}

          {requestSuccess ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
              <p className="text-white font-semibold">¡Solicitud enviada!</p>
              <p className="text-slate-400 text-sm">
                Tu administrador recibirá la notificación y establecerá tu nueva contraseña.\nTe avisarán cuando esté lista.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-4 text-slate-400 text-sm leading-relaxed">
                Para cambiar tu contraseña, necesitas la autorización de tu Administrador o SuperAdmin.
                Al hacer clic en el botón, se enviará una solicitud que ellos podrán revisar en el
                módulo de <strong className="text-white">Usuarios y Empleados</strong>.
              </div>
              <button
                type="button"
                onClick={handleRequestChange}
                disabled={isRequesting}
                className="btn-primary text-sm px-5 py-2.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #d97706, #f97316)' }}
              >
                {isRequesting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando solicitud...</>
                  : <><Bell className="w-3.5 h-3.5" /> Solicitar Cambio de Contraseña</>
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
