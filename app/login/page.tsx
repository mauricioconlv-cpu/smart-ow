import { login } from './actions'
import { Truck, Phone, Lock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

// Server Component — necesario para leer searchParams correctamente en App Router
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const params = await searchParams
  const message = params?.message ? decodeURIComponent(params.message) : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">

        {/* Logo y título */}
        <div className="flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/30">
            <Truck className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
            Smart Tow
          </h2>
          <p className="mt-2 text-center text-sm text-blue-300">
            Sistema Inteligente de Gestión de Grúas
          </p>
        </div>

        {/* Card del formulario */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-8">

          {/* Banner de error — visible cuando hay ?message= en la URL */}
          {message && (
            <div className="mb-6 flex items-center gap-3 bg-red-500/20 border border-red-400/40 text-red-200 px-4 py-3 rounded-xl text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
              <span>{message}</span>
            </div>
          )}

          <form className="space-y-5" action={login}>

            {/* Campo Teléfono */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-blue-200 mb-2">
                Número de Teléfono
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  className="block w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Ej. 5512345678"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-blue-200 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Tu contraseña"
                />
              </div>
            </div>

            {/* Botón de ingreso */}
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 mt-2"
            >
              Iniciar Sesión
            </button>

            {/* ¿Problemas para entrar? */}
            <div className="text-center">
              <Link
                href="/forgot-password?tipo=operador"
                className="text-sm text-slate-400 hover:text-orange-400 transition-colors"
              >
                ¿Problemas para ingresar? Solicitar acceso →
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-slate-400">
          ¿Primera vez en Smart Tow?{' '}
          <Link href="/register" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            Registra tu empresa →
          </Link>
        </p>
      </div>
    </div>
  )
}
