'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Truck, Building2, User, Mail, Phone, Hash, CheckCircle2 } from 'lucide-react'
import { requestRegistration } from './actions'

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(requestRegistration, null)

  if (state?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10 text-center space-y-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">¡Solicitud Enviada!</h2>
          <p className="text-slate-500 text-sm">
            Tu solicitud de registro fue enviada correctamente. Recibirás acceso una vez que sea revisada y aprobada por el administrador de la plataforma.
          </p>
          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
            Mientras tanto, puedes cerrar esta ventana. Te notificaremos por correo cuando tu cuenta esté activa.
          </p>
          <Link href="/login" className="inline-block text-sm text-blue-600 font-semibold hover:underline">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-12">
      <div className="w-full max-w-md space-y-6 bg-white rounded-2xl shadow-2xl p-8">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 mb-4">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Solicitar Acceso
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Completa tu información para solicitar el registro de tu empresa en Smart Tow
          </p>
        </div>

        {/* Error */}
        {state?.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            ⚠️ {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          
          {/* Empresa */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Nombre de tu Empresa
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                name="companyName" type="text" required
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Ej. Grúas Pérez S.A. de C.V."
              />
            </div>
          </div>

          {/* Nombre Admin */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Tu Nombre Completo (Administrador)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                name="fullName" type="text" required
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Ej. Carlos Pérez"
              />
            </div>
          </div>

          {/* Teléfono y Número de grúas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Teléfono de Contacto
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  name="phone" type="tel" required
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ej. 5512345678"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                N° de Grúas / Unidades
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  name="numTrucks" type="number" min="1" required
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ej. 5"
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                name="email" type="email" required autoComplete="email"
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="admin@tuempresa.com"
              />
            </div>
          </div>

          {/* Lo que incluye */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-800 space-y-1">
            <p className="font-semibold mb-2">Tu empresa incluye desde el primer día:</p>
            {[
              'Dashboard completamente privado',
              'Flotilla de grúas propia',
              'Usuarios y operadores ilimitados',
              'Módulo de servicios con folio propio',
              'Aseguradoras y tarifas independientes',
            ].map(item => (
              <p key={item} className="flex items-center gap-1.5">
                <span className="text-blue-500">✓</span> {item}
              </p>
            ))}
          </div>

          <button
            type="submit" disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg transition-colors text-sm"
          >
            {isPending ? 'Enviando solicitud...' : 'Solicitar Registro →'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-800">
            Iniciar Sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
