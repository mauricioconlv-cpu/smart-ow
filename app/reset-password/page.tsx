'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Truck, Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    // Supabase handles the hash from the email link automatically
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true)
      else setError('El enlace es inválido o ya expiró. Solicita uno nuevo.')
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }

    setIsSaving(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    setIsSaving(false)
    if (error) { setError('Error al actualizar: ' + error.message); return }

    setSuccess(true)
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #060b18 0%, #0d1530 50%, #0a0f20 100%)' }}>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="logo-3d w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <span className="gradient-text text-2xl font-bold">Smart Tow</span>
        </div>

        <div className="glass-card p-8">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">¡Contraseña Actualizada!</h2>
              <p className="text-slate-400 text-sm">
                Tu contraseña fue cambiada correctamente. Redirigiendo al login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-white">Nueva Contraseña</h1>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Ingresa tu nueva contraseña segura. Mínimo 6 caracteres.
                </p>
              </div>

              {!hasSession && !error && (
                <div className="flex items-center justify-center gap-2 text-slate-400 py-4">
                  <Loader2 className="w-5 h-5 animate-spin" /> Verificando enlace...
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                  {error.includes('inválido') && (
                    <Link href="/forgot-password" className="ml-auto text-blue-400 underline text-xs whitespace-nowrap">
                      Solicitar nuevo
                    </Link>
                  )}
                </div>
              )}

              {hasSession && (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Nueva Contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showPwd ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          placeholder="Mínimo 6 caracteres"
                          className="input-glass pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Confirmar Contraseña
                      </label>
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required
                        placeholder="Repite la contraseña"
                        className="input-glass"
                      />
                    </div>
                  </div>

                  {/* Password strength indicator */}
                  {password.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(n => (
                          <div
                            key={n}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              password.length >= n * 3
                                ? n <= 1 ? 'bg-red-500' : n <= 2 ? 'bg-orange-400' : n <= 3 ? 'bg-yellow-400' : 'bg-green-400'
                                : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        {password.length < 6 ? 'Muy corta' : password.length < 9 ? 'Débil' : password.length < 12 ? 'Moderada' : 'Fuerte'}
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSaving || !password || !confirm}
                    className="btn-primary w-full py-3 justify-center text-sm disabled:opacity-50"
                  >
                    {isSaving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                      : <><KeyRound className="w-4 h-4" /> Establecer Nueva Contraseña</>
                    }
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
