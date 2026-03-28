'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Truck, Mail, Phone, ArrowLeft, CheckCircle2, AlertTriangle,
  Loader2, KeyRound, ShieldAlert, Send, MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams()
  // Si viene desde el login con ?tipo=operador, ir directo al flujo de empleado
  const tipoInicial = searchParams.get('tipo') === 'operador' ? 'employee' : 'choose'

  const [mode, setMode] = useState<'choose' | 'superadmin' | 'employee'>(tipoInicial as any)
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Employee flow state
  const [phone, setPhone] = useState('')
  const [requestSent, setRequestSent] = useState(false)
  const [requestMsg, setRequestMsg] = useState('')
  const [employeeName, setEmployeeName] = useState('')

  async function handleSuperAdminReset(e: React.FormEvent) {
    e.preventDefault()
    setIsSending(true)
    setError('')
    const supabase = createClient()

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

  async function handleEmployeeRequest(e: React.FormEvent) {
    e.preventDefault()
    setIsSending(true)
    setError('')

    try {
      const res = await fetch('/api/password-requests/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim().replace(/\D/g, '') }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Error inesperado. Intenta de nuevo.')
        setIsSending(false)
        return
      }

      setRequestMsg(data.message)
      if (data.employeeName) setEmployeeName(data.employeeName)
      setRequestSent(true)
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setIsSending(false)
    }
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

          {/* ══════════════════════════════════════════════════════════════
              CHOOSE MODE
          ══════════════════════════════════════════════════════════════ */}
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
                    <p className="text-xs text-slate-400">Solicita acceso a tu administrador</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SUPERADMIN FLOW
          ══════════════════════════════════════════════════════════════ */}
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

          {/* SUCCESS SuperAdmin */}
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

          {/* ══════════════════════════════════════════════════════════════
              EMPLOYEE / OPERATOR FLOW
          ══════════════════════════════════════════════════════════════ */}
          {mode === 'employee' && !requestSent && (
            <form onSubmit={handleEmployeeRequest} className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">¿Olvidaste tu contraseña?</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Ingresa tu número de teléfono registrado y notificaremos a tu administrador para que te ayude.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Info box */}
              <div
                style={{
                  background: 'rgba(249,115,22,0.08)',
                  border: '1px solid rgba(249,115,22,0.20)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <ShieldAlert className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <p className="text-slate-300 text-xs leading-relaxed">
                  Por seguridad, el restablecimiento de contraseñas lo realiza el{' '}
                  <strong className="text-white">Administrador</strong> de tu empresa.
                  Al enviar tu solicitud, el admin recibirá una alerta y podrá ayudarte.
                </p>
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tu número de teléfono
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setError('') }}
                    required
                    placeholder="Ej. 5512345678"
                    maxLength={15}
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box',
                      paddingLeft: 40,
                      paddingRight: 16,
                      paddingTop: 12,
                      paddingBottom: 12,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      color: 'white',
                      fontSize: 15,
                      outline: 'none',
                    }}
                    className="focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Debe coincidir con el número registrado en el sistema
                </p>
              </div>

              {/* Botón solicitar */}
              <button
                type="submit"
                disabled={isSending || phone.replace(/\D/g, '').length < 10}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: 10,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'white',
                  background: isSending || phone.replace(/\D/g, '').length < 10
                    ? 'rgba(249,115,22,0.4)'
                    : 'linear-gradient(135deg, #f97316, #d97706)',
                  cursor: isSending || phone.replace(/\D/g, '').length < 10 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 20px rgba(249,115,22,0.25)',
                  transition: 'all 0.2s',
                }}
              >
                {isSending
                  ? <><Loader2 className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} /> Enviando solicitud...</>
                  : <><Send className="w-4 h-4" /> Solicitar Acceso</>
                }
              </button>

              <button type="button" onClick={() => setMode('choose')} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ← Volver a opciones
              </button>
            </form>
          )}

          {/* SUCCESS Employee */}
          {mode === 'employee' && requestSent && (
            <div className="text-center space-y-5 py-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                style={{
                  background: 'rgba(249,115,22,0.12)',
                  border: '2px solid rgba(249,115,22,0.30)',
                  boxShadow: '0 0 30px rgba(249,115,22,0.15)',
                }}
              >
                <MessageSquare className="w-9 h-9 text-orange-400" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">¡Solicitud Enviada!</h2>
                {employeeName && (
                  <p className="text-orange-300 font-medium mt-1">{employeeName}</p>
                )}
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '16px',
                }}
              >
                <p className="text-slate-300 text-sm leading-relaxed">
                  {requestMsg || 'Tu administrador ha sido notificado y te contactará para restablecer tu contraseña.'}
                </p>
              </div>

              <p className="text-xs text-slate-500">
                Si no recibes respuesta pronto, comunícate directamente con tu despachador o administrador.
              </p>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
