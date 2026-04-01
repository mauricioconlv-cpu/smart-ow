import { SupabaseClient } from '@supabase/supabase-js'

export async function logClockIn(supabase: SupabaseClient, userId: string) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id, hora_entrada, role')
      .eq('id', userId)
      .single()
    if (!profile) return

    // Allow admins to skip attendance logs if desired, but user said "cada que alguien que no sea el admin".
    // So if profile.role === 'admin', skip logging.
    if (profile.role === 'admin') return

    // Adjust for today's local date (Mexico time format or generic local ISO)
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local

    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id, clock_out_time')
      .eq('profile_id', userId)
      .eq('log_date', today)
      .maybeSingle()

    if (existingLog) {
      // If already logged in and not clocked out, do nothing. 
      // If clocked out, maybe they are returning? We can resume or create a new shift, but usually 1 log per day is fine.
      return
    }

    let lateMinutes = 0
    if (profile.hora_entrada) {
      const now = new Date()
      const [h, m] = profile.hora_entrada.split(':').map(Number)
      
      const expectedTime = new Date()
      expectedTime.setHours(h, m, 0, 0)
      
      const diffMs = now.getTime() - expectedTime.getTime()
      if (diffMs > 0) {
        lateMinutes = Math.floor(diffMs / 60000)
      }
    }

    await supabase.from('attendance_logs').insert({
      profile_id: userId,
      company_id: profile.company_id,
      log_date: today,
      clock_in_time: new Date().toISOString(),
      late_minutes: lateMinutes,
      break_status: 'active'
    })
  } catch (error) {
    console.error('Error logging clock in:', error)
  }
}

export async function logClockOut(supabase: SupabaseClient, userId: string) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('hora_salida, role')
      .eq('id', userId)
      .single()
      
    if (!profile || profile.role === 'admin') return

    const today = new Date().toLocaleDateString('en-CA')
    const { data: log } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('profile_id', userId)
      .eq('log_date', today)
      .maybeSingle()

    if (!log || log.clock_out_time) return

    let overtimeMinutes = 0
    let breakMinutes = log.total_break_minutes || 0

    if (log.break_status === 'on_break' && log.last_break_start) {
      const elapsedBreak = Math.floor((Date.now() - new Date(log.last_break_start).getTime()) / 60000)
      breakMinutes += elapsedBreak
    }

    if (profile.hora_salida) {
      const now = new Date()
      const [h, m] = profile.hora_salida.split(':').map(Number)
      const expectedTime = new Date()
      expectedTime.setHours(h, m, 0, 0)
      
      const diffMs = now.getTime() - expectedTime.getTime()
      if (diffMs > 0) {
        overtimeMinutes = Math.floor(diffMs / 60000)
      }
    }

    await supabase.from('attendance_logs').update({
      clock_out_time: new Date().toISOString(),
      break_status: 'completed',
      total_break_minutes: breakMinutes,
      overtime_minutes: overtimeMinutes
    }).eq('id', log.id)
  } catch (error) {
    console.error('Error logging clock out:', error)
  }
}

export async function setBreakStatus(supabase: SupabaseClient, userId: string, isBreak: boolean) {
  try {
    const today = new Date().toLocaleDateString('en-CA')
    const { data: log } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('profile_id', userId)
      .eq('log_date', today)
      .maybeSingle()
      
    if (!log || log.clock_out_time) return

    if (isBreak && log.break_status === 'active') {
      // Start break
      await supabase.from('attendance_logs').update({
        break_status: 'on_break',
        last_break_start: new Date().toISOString()
      }).eq('id', log.id)
    } else if (!isBreak && log.break_status === 'on_break') {
      // End break
      let addedMins = 0
      if (log.last_break_start) {
        addedMins = Math.floor((Date.now() - new Date(log.last_break_start).getTime()) / 60000)
      }
      await supabase.from('attendance_logs').update({
        break_status: 'active',
        total_break_minutes: (log.total_break_minutes || 0) + addedMins,
        last_break_start: null
      }).eq('id', log.id)
    }
  } catch (error) {
    console.error('Error setting break status:', error)
  }
}
