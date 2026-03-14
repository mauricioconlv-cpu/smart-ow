import { Truck, Users, Map, Settings, LogOut, FileText } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const handleLogout = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-4 flex items-center space-x-3 bg-slate-950">
          <Truck className="h-8 w-8 text-blue-400" />
          <span className="text-xl font-bold">Smart Tow</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <Map className="h-5 w-5 text-gray-400" />
            <span>Monitor en Vivo</span>
          </Link>
          <Link href="/dashboard/services" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <Map className="h-5 w-5 text-gray-400" />
            <span>Servicios</span>
          </Link>
          <Link href="/dashboard/reports" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <FileText className="h-5 w-5 text-gray-400" />
            <span>Reportes e Historial</span>
          </Link>
          <Link href="/dashboard/clients" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <Users className="h-5 w-5 text-gray-400" />
            <span>Aseguradoras</span>
          </Link>
          <Link href="/dashboard/fleet" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <Truck className="h-5 w-5 text-gray-400" />
            <span>Flotilla de Grúas</span>
          </Link>
          <Link href="/dashboard/users" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <Users className="h-5 w-5 text-gray-400" />
            <span>Usuarios y Empleados</span>
          </Link>
          <Link href="/dashboard/settings" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors">
            <Settings className="h-5 w-5 text-gray-400" />
            <span>Configuración</span>
          </Link>
        </nav>

        <div className="p-4 bg-slate-950">
           <form action={handleLogout}>
            <button type="submit" className="flex w-full items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-red-400">
              <LogOut className="h-5 w-5" />
              <span>Cerrar Sesión</span>
            </button>
          </form>
          <p className="px-3 pt-3 text-xs text-gray-500 truncate">{user?.email}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center px-6">
          <h1 className="text-xl font-semibold text-gray-800">Call Center</h1>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
