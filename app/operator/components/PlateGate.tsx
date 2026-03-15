'use client'

import { useState } from 'react'
import { Truck, AlertTriangle, Loader2, CheckCircle2, Car, ArrowRight, LogOut } from 'lucide-react'

interface PlateGateProps {
  operatorName: string
  avatarUrl: string | null
}

export default function PlateGate({ operatorName, avatarUrl }: PlateGateProps) {
  const [plates, setPlates] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ economic_number: string; plates: string; brand: string; model: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/operator/link-truck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plates: plates.trim().toUpperCase() }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Error inesperado.')
        setIsLoading(false)
        return
      }

      // Mostrar confirmación y recargar para que el servidor vea la nueva vinculación
      setSuccess(data.truck)
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.')
      setIsLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/operator/link-truck', { method: 'DELETE' })
    } catch (_) {}
    window.location.href = '/login'
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #060b18 0%, #0d1530 60%, #0a0f20 100%)' }}
    >
      {/* Glow backgrounds */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 360, height: 360, background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 240, height: 240, background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">

        {/* Avatar + Nombre */}
        <div className="text-center space-y-3">
          <div
            className="w-20 h-20 mx-auto rounded-full overflow-hidden border-4 border-blue-500/50"
            style={{ boxShadow: '0 0 30px rgba(59,130,246,0.40), 0 0 60px rgba(59,130,246,0.15)' }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={operatorName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{operatorName[0]?.toUpperCase() ?? 'O'}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-slate-400 text-sm">Bienvenido de vuelta</p>
            <h1 className="text-2xl font-bold text-white">{operatorName.split(' ')[0]}</h1>
          </div>
        </div>

        {/* Card */}
        <div
          className="w-full rounded-2xl p-6 space-y-5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(20px)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
        >
          {!success ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #d97706)' }}>
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-base">Verificación de Unidad</h2>
                  <p className="text-xs text-slate-400">Ingresa las placas de la grúa que operarás hoy</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">Placas de la Grúa</label>
                  <input
                    type="text"
                    value={plates}
                    onChange={e => { setPlates(e.target.value.toUpperCase()); setError('') }}
                    required
                    placeholder="Ej. DBP123"
                    maxLength={10}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    style={{
                      display: 'block', width: '100%', padding: '12px 16px',
                      textAlign: 'center', fontSize: 28, fontFamily: 'monospace',
                      fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12, color: 'white', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                  <p className="text-xs text-center mt-1" style={{ color: 'rgba(148,163,184,0.7)' }}>
                    Deben coincidir con las placas registradas en flotilla
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || plates.length < 2}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none',
                    fontWeight: 700, fontSize: 15, color: 'white', cursor: isLoading || plates.length < 2 ? 'not-allowed' : 'pointer',
                    opacity: isLoading || plates.length < 2 ? 0.5 : 1,
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    boxShadow: '0 8px 25px rgba(37,99,235,0.35)', transition: 'all 0.2s'
                  }}
                >
                  {isLoading
                    ? <><Loader2 className="w-5 h-5" style={{ animation: 'spin 1s linear infinite' }} /> Verificando...</>
                    : <><Truck className="w-5 h-5" /> Vincular Unidad <ArrowRight className="w-4 h-4 ml-1" /></>
                  }
                </button>
              </form>
            </>
          ) : (
            /* Estado de éxito */
            <div className="text-center space-y-4 py-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.30)' }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: '#4ade80' }} />
              </div>
              <div>
                <p style={{ color: '#4ade80', fontWeight: 700, fontSize: 18 }}>¡Unidad Vinculada!</p>
                <p className="text-white font-bold text-2xl mt-1">{success.economic_number}</p>
                <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 13 }}>{success.brand} {success.model} · {success.plates}</p>
              </div>
              <p style={{ color: 'rgba(100,116,139,0.8)', fontSize: 12 }}>Cargando tu panel de operador...</p>
            </div>
          )}
        </div>

        {/* Logout link */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleLogout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(100,116,139,0.8)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            No soy yo — cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
