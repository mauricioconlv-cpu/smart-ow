'use client'

import { useState } from 'react'
import { Truck, AlertTriangle, Loader2, CheckCircle2, Car, ArrowRight, LogOut } from 'lucide-react'

interface PlateGateProps {
  operatorName: string
  avatarUrl: string | null
  onLinked: (truck: { id: string; unit_number: string; brand: string; model: string; plates: string }) => void
}

export default function PlateGate({ operatorName, avatarUrl, onLinked }: PlateGateProps) {
  const [plates, setPlates] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<any>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const res = await fetch('/api/operator/link-truck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plates: plates.trim().toUpperCase() }),
    })

    const data = await res.json()
    setIsLoading(false)

    if (!res.ok || data.error) {
      setError(data.error || 'Error inesperado.')
      return
    }

    setSuccess(data.truck)
    // Corta breve para que el operador vea la confirmación
    setTimeout(() => onLinked(data.truck), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">

        {/* Avatar + Bienvenida */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-4 border-blue-500/50 shadow-xl"
               style={{ boxShadow: '0 0 30px rgba(59,130,246,0.4)' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={operatorName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{operatorName[0]?.toUpperCase()}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-slate-400 text-sm">Bienvenido de vuelta</p>
            <h1 className="text-2xl font-bold text-white">
              {operatorName.split(' ')[0]}
            </h1>
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
          {!success ? (
            <>
              <div className="flex items-center gap-3 pb-2 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-base">Verificación de Unidad</h2>
                  <p className="text-xs text-slate-400">Ingresa las placas de la grúa que operarás hoy</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Placas de la Grúa
                  </label>
                  <input
                    type="text"
                    value={plates}
                    onChange={e => { setPlates(e.target.value.toUpperCase()); setError('') }}
                    required
                    placeholder="Ej. DBP123"
                    maxLength={10}
                    className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.15em] uppercase
                               bg-white/8 border border-white/15 rounded-xl text-white placeholder:text-slate-600
                               focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                               transition-all"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-xs text-slate-500 text-center mt-1">
                    Las placas deben coincidir con las registradas en la flotilla
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || plates.length < 3}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-white
                             bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600
                             disabled:opacity-50 disabled:cursor-not-allowed transition-all
                             shadow-lg shadow-blue-600/30"
                >
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Verificando...</>
                  ) : (
                    <><Truck className="w-5 h-5" /> Vincular Unidad <ArrowRight className="w-4 h-4 ml-1" /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-green-400 font-bold text-lg">¡Unidad Vinculada!</p>
                <p className="text-white font-bold text-2xl mt-1">{success.unit_number}</p>
                <p className="text-slate-400 text-sm">{success.brand} {success.model} · {success.plates}</p>
              </div>
              <p className="text-xs text-slate-500">Cargando tu panel de operador...</p>
            </div>
          )}
        </div>

        {/* Link de cierre de sesión */}
        <div className="text-center">
          <a href="/login"
             onClick={async (e) => {
               e.preventDefault()
               await fetch('/api/operator/link-truck', { method: 'DELETE' })
               window.location.href = '/login'
             }}
             className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            No soy yo — cerrar sesión
          </a>
        </div>
      </div>
    </div>
  )
}
