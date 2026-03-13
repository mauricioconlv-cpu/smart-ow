'use client'

import { setupSuperAdmin } from './actions'
import { useActionState } from 'react'

export default function SetupPage() {
  const [state, formAction, isPending] = useActionState(setupSuperAdmin, null)

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Inicializar Sistema</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Crea la cuenta de Súper Administrador y registra la Empresa Principal (SaaS Tenant).
          </p>
        </div>

        {state?.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm flex items-center">
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Empresa Comercial</label>
            <input 
              type="text" 
              name="companyName" 
              required 
              placeholder="Ej. Grúas Poncho"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tu Nombre Completo</label>
            <input 
              type="text" 
              name="fullName" 
              required 
              placeholder="Ej. Mauricio"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico Administrador</label>
            <input 
              type="email" 
              name="email" 
              required 
              placeholder="admin@empresa.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Segura</label>
            <input 
              type="password" 
              name="password" 
              required 
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <button 
            type="submit" 
            disabled={isPending}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-6"
          >
            {isPending ? 'Configurando...' : 'Configurar y Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
