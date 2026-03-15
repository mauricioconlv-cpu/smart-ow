'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Mail, Phone, ArrowLeft, CheckCircle2, AlertTriangle, Loader2, KeyRound, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [mode, setMode] = useState<'choose' | 'superadmin' | 'employee'>('choose')
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSuperAdminReset(e: React.FormEvent) {
    e.preventDefault()
    setIsSending(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setIsSending(false)
    if (error) {
      setError('No se encontró esa cuenta. Verifica el email.')
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #060b18 0%, #0d1530 50%, #0a0f20 100%)' }}>

      {/* Background glows */}
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
          <Link href="/login" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Volver al login
          </Link>

          {/* CHOOSE MODE */}
          {mode === 'choose' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">¿Olvidaste tu contraseña?</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Selecciona tu tipo de cuenta para continuar
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setMode('superadmin')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-700 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                    <KeyRound className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Soy SuperAdmin</p>
                    <p className="text-xs text-slate-400">Recibirás un enlace de recuperación en tu email</p>
                  </div>
                </button>

                <button
                  onClick={() => setMode('employee')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-700 bg-white/5 hover:bg-white/10 hover:border-orange-500/50 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Soy Empleado / Operador</p>
                    <p className="text-xs text-slate-400">Inicia sesión por teléfono</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* SUPERADMIN FLOW */}
          {mode === 'superadmin' && !sent && (
            <form onSubmit={handleSuperAdminReset} className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Recuperar Acceso</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Ingresa tu email de SuperAdmin y te enviaremos un enlace seguro.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email de SuperAdmin
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="admin@empresa.com"
                    className="input-glass pl-10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="btn-primary w-full py-3 justify-center text-sm disabled:opacity-50"
              >
                {isSending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  : <><Mail className="w-4 h-4" /> Enviar Enlace de Recuperación</>
                }
              </button>

              <button type="button" onClick={() => setMode('choose')} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ← Volver a opciones
              </button>
            </form>
          )}

          {/* SUCCESS */}
          {mode === 'superadmin' && sent && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">¡Email Enviado!</h2>
              <p className="text-slate-400 text-sm">
                Revisa tu bandeja de entrada en <span className="text-white font-medium">{email}</span>.
                El enlace expira en 1 hora.
              </p>
              <p className="text-xs text-slate-500">
                Si no lo ves, revisa tu carpeta de spam.
              </p>
            </div>
          )}

          {/* EMPLOYEE FLOW */}
          {mode === 'employee' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Recuperación de Contraseña</h1>
                <p className="text-slate-400 text-sm mt-1">Empleados y operadores</p>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-orange-400 flex-shrink-0" />
                  <p className="text-orange-300 font-semibold text-sm">Contacta a tu Administrador</p>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Por seguridad, el restablecimiento de contraseñas de empleados y operadores
                  lo realiza el <strong className="text-white">Administrador o SuperAdmin</strong> de tu empresa.
                </p>
                <p className="text-slate-400 text-sm">
                  Si ya iniciaste sesión antes, también puedes ir a{' '}
                  <strong className="text-blue-400">Configuración → Seguridad</strong>{' '}
                  para solicitar el cambio desde dentro del sistema.
                </p>
              </div>

              <button type="button" onClick={() => setMode('choose')} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ← Volver a opciones
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
