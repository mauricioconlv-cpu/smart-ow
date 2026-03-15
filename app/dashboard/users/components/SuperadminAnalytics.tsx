import { createClient } from '@/lib/supabase/server'
import {
  Building2, Users, Truck, FileText, Activity,
  TrendingUp, Shield, Clock
} from 'lucide-react'

interface CompanyStats {
  company_id: string
  company_name: string
  total_users: number
  total_operators: number
  total_dispatchers: number
  total_trucks: number
  services_30d: number
  last_activity: string | null
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: any
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className={`flex items-center gap-3 bg-gradient-to-r ${color} rounded-xl p-3`}>
      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-white/70 text-xs leading-none">{label}</p>
        <p className="text-white font-bold text-lg leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function ActivityDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex h-2 w-2 rounded-full ${active ? 'bg-green-400' : 'bg-slate-300'}`} />
  )
}

export default async function SuperadminAnalytics() {
  const supabase = await createClient()

  // Llamar a la función analítica — bypasea RLS via SECURITY DEFINER
  const { data: companies, error } = await supabase
    .rpc('get_platform_analytics')

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm font-mono">
        Error cargando analytics: {error.message}
      </div>
    )
  }

  const stats = (companies ?? []) as CompanyStats[]
  const totalCompanies  = stats.length
  const totalUsers      = stats.reduce((s, c) => s + Number(c.total_users), 0)
  const totalTrucks     = stats.reduce((s, c) => s + Number(c.total_trucks), 0)
  const totalServices   = stats.reduce((s, c) => s + Number(c.services_30d), 0)

  return (
    <div className="space-y-6">

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Empresas activas"    value={totalCompanies} color="from-violet-600 to-violet-700" />
        <StatCard icon={Users}     label="Usuarios totales"   value={totalUsers}     color="from-blue-600 to-blue-700" />
        <StatCard icon={Truck}     label="Grúas registradas"  value={totalTrucks}    color="from-emerald-600 to-emerald-700" />
        <StatCard icon={FileText}  label="Servicios (30 días)" value={totalServices}  color="from-orange-500 to-orange-600" />
      </div>

      {/* Per-company breakdown */}
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Métricas por empresa
        </h3>
        <div className="space-y-3">
          {stats.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
              No hay empresas registradas aún.
            </div>
          )}
          {stats.map(c => {
            const isActive = !!c.last_activity &&
              Date.now() - new Date(c.last_activity).getTime() < 7 * 24 * 60 * 60 * 1000
            return (
              <div
                key={c.company_id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">{c.company_name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ActivityDot active={isActive} />
                        <span className="text-xs text-slate-400">{isActive ? 'Activa esta semana' : 'Sin actividad reciente'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Services badge */}
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-800">{c.services_30d}</span>
                    <p className="text-xs text-slate-400 leading-none">servicios / 30d</p>
                  </div>
                </div>

                {/* Metric pills */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50 rounded-xl px-3 py-2 text-center">
                    <Users className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" />
                    <p className="font-bold text-blue-800 text-lg leading-none">{c.total_users}</p>
                    <p className="text-blue-500 text-xs mt-0.5">usuarios</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl px-3 py-2 text-center">
                    <Truck className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-1" />
                    <p className="font-bold text-emerald-800 text-lg leading-none">{c.total_trucks}</p>
                    <p className="text-emerald-500 text-xs mt-0.5">grúas</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl px-3 py-2 text-center">
                    <Shield className="w-3.5 h-3.5 text-violet-500 mx-auto mb-1" />
                    <p className="font-bold text-violet-800 text-lg leading-none">{c.total_operators}</p>
                    <p className="text-violet-500 text-xs mt-0.5">operadores</p>
                  </div>
                </div>

                {/* Last activity */}
                {c.last_activity && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    Último registro: {new Date(c.last_activity).toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-slate-400 pb-2">
        Vista exclusiva del CEO · Los datos de perfiles individuales son privados por diseño
      </p>
    </div>
  )
}
