import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PayrollClient from './PayrollClient'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role, is_supervisor')
    .eq('id', user.id)
    .single()
    
  if (!profile || (profile.role !== 'admin' && !profile.is_supervisor)) {
    redirect('/dashboard')
  }

  // Obtener Empleados bajo cargo (admin ve todos los roles despachadores/operadores; supervisor podría estar limitado a solo operadores o a todos)
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url, hora_entrada, hora_salida, dias_descanso, tipo_jornada')
    .eq('company_id', profile.company_id)
    .in('role', ['operator', 'dispatcher'])
    .order('full_name')

  // Asistencia los ultimos dias (limite a 300 logs de la compañia para rendimiento)
  const { data: attendanceLogs } = await supabase
    .from('attendance_logs')
    .select('*, profile:profile_id(full_name, avatar_url, role)')
    .eq('company_id', profile.company_id)
    .order('clock_in_time', { ascending: false })
    .limit(300)

  // Incidencias e incapacidades
  const { data: timeOffRequests } = await supabase
    .from('time_off_requests')
    .select('*, profile:profile_id(full_name, avatar_url, role)')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(100)

  // Auditoria de horarios modficiados
  const { data: auditLogs } = await supabase
    .from('schedule_audit_logs')
    .select('id, action, old_data, new_data, created_at, actor:actor_id(full_name), target:target_profile_id(full_name)')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <PayrollClient 
      employees={employees || []} 
      attendanceLogs={attendanceLogs || []}
      timeOffRequests={timeOffRequests || []}
      auditLogs={auditLogs || []}
      currentUserId={user.id}
      companyId={profile.company_id}
      isAdmin={profile.role === 'admin'}
    />
  )
}
