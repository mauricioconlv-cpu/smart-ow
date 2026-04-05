import { Users, Map, Settings, LogOut, FileText, Truck, Radio, Stethoscope } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmergencyNotifier from './components/EmergencyNotifier'
import WelcomeBanner from './components/WelcomeBanner'
import SidebarLogo from './components/SidebarLogo'
import NavItemClient from './components/NavItemClient'
import DashboardHeartbeat from './components/DashboardHeartbeat'
import OperatorFreeModal from './components/OperatorFreeModal'
import DashboardBitacoraNotifier from './components/DashboardBitacoraNotifier'
import IdleTracker from './components/IdleTracker'
import { logClockOut } from '@/lib/attendance'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_supervisor, company_id, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  // Obtener logo y configuración de la empresa
  let company: { name: string; logo_url: string | null; has_tow_module: boolean; has_medical_module: boolean } | null = null
  if (profile?.company_id) {
    const { data } = await supabase
      .from('companies')
      .select('name, logo_url, has_tow_module, has_medical_module')
      .eq('id', profile.company_id)
      .single()
    company = data
  }

  const handleLogout = async () => {
    'use server'
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    if (authData.user) {
      await logClockOut(supabase, authData.user.id)
    }
    await supabase.auth.signOut()
    redirect('/login')
  }

  const navLinks: { href: string, icon: any, label: string, live?: boolean }[] = [
    { href: '/dashboard',         icon: Map,         label: 'Monitor en Vivo', live: true },
  ]

  if (company?.has_tow_module !== false) {
    navLinks.push({ href: '/dashboard/services', icon: Radio,        label: 'Servicios' })
  }
  
  if (company?.has_medical_module !== false) {
    navLinks.push({ href: '/dashboard/medical',  icon: Stethoscope,  label: 'Servicios Médicos' })
  }

  navLinks.push(
    { href: '/dashboard/reports', icon: FileText,     label: 'Reportes e Historial' },
    { href: '/dashboard/clients', icon: Users,        label: 'Aseguradoras' }
  )

  if (company?.has_tow_module !== false) {
    navLinks.push({ href: '/dashboard/fleet',   icon: Truck,        label: 'Flotilla de Grúas' })
  }

  navLinks.push({ href: '/dashboard/users',   icon: Users,        label: 'Usuarios y Empleados' })

  if (profile?.role === 'admin' || profile?.is_supervisor) {
    navLinks.push({ href: '/dashboard/payroll', icon: Users, label: 'Nóminas y Asistencia' })
  }

  navLinks.push({ href: '/dashboard/settings',icon: Settings,  label: 'Configuración' })

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── SIDEBAR ── */}
      <aside className="sidebar-glass w-64 flex flex-col z-20 flex-shrink-0">

        {/* Logo Header */}
        <SidebarLogo company={company} />

        {/* Glow divider */}
        <div className="glow-divider mx-4" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ href, icon: Icon, label, live }) => (
            <NavItemClient key={href} href={href} label={label} live={live}>
              <Icon className="nav-icon h-[18px] w-[18px] flex-shrink-0 transition-all duration-200" />
            </NavItemClient>
          ))}
        </nav>

        {/* Glow divider */}
        <div className="glow-divider mx-4" />

        {/* Footer / Logout */}
        <div className="p-3">
          <form action={handleLogout}>
            <button
              type="submit"
              className="nav-item w-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/20"
            >
              <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
              <span>Cerrar Sesión</span>
            </button>
          </form>
          <p className="px-3 pt-2 text-xs text-slate-600 truncate font-mono">
            {profile?.full_name || user.email}
          </p>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden relative main-content-bg">
        <EmergencyNotifier />

        {/* Top Header */}
        <header className="header-glass h-14 flex items-center justify-between px-6 z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="live-dot" />
            <span className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
              Call Center
            </span>
          </div>
          <WelcomeBanner />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
      <DashboardHeartbeat />
      <OperatorFreeModal />
      <DashboardBitacoraNotifier />
      {user && <IdleTracker userId={user.id} />}
    </div>
  )
}
