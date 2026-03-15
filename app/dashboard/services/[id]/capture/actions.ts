'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Helpers ─────────────────────────────────────────────────
async function getProfileInfo(supabase: any, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, role, company_id')
    .eq('id', userId)
    .single()
  return data
}

async function addLog(supabase: any, {
  serviceId, companyId, userId, type, note, eventLabel, actorRole
}: {
  serviceId: string
  companyId: string
  userId: string
  type: string
  note: string
  eventLabel?: string
  actorRole?: string
}) {
  await supabase.from('service_logs').insert({
    service_id: serviceId,
    company_id: companyId,
    created_by: userId,
    type,
    note,
    event_label: eventLabel,
    actor_role: actorRole,
  })
}

// ── Desbloquear con motivo ───────────────────────────────────
export async function unlockWithReason(serviceId: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const profile = await getProfileInfo(supabase, user.id)
  if (!profile) return { error: 'Perfil no encontrado' }

  // Guardar razón en el servicio
  const { error } = await supabase
    .from('services')
    .update({ edit_reason: reason })
    .eq('id', serviceId)

  if (error) return { error: error.message }

  // Log automático
  await addLog(supabase, {
    serviceId,
    companyId: profile.company_id,
    userId: user.id,
    type: 'edit_unlock',
    note: `Motivo: ${reason}`,
    eventLabel: `🔓 Desbloqueo de edición — ${reason}`,
    actorRole: profile.role,
  })

  revalidatePath(`/dashboard/services/${serviceId}/capture`)
  return { success: true }
}

// ── Cerrar expediente ────────────────────────────────────────
export async function closeService(serviceId: string, closingNote?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const profile = await getProfileInfo(supabase, user.id)
  if (!profile) return { error: 'Perfil no encontrado' }

  const { error } = await supabase
    .from('services')
    .update({
      status: 'servicio_cerrado',
      fin_servicio_at: new Date().toISOString(),
    })
    .eq('id', serviceId)

  if (error) return { error: error.message }

  // Log automático de cierre
  await addLog(supabase, {
    serviceId,
    companyId: profile.company_id,
    userId: user.id,
    type: 'status_change',
    note: closingNote || 'Expediente cerrado manualmente',
    eventLabel: `✅ Expediente cerrado por ${profile.full_name}`,
    actorRole: profile.role,
  })

  revalidatePath('/dashboard')
  return { success: true }
}

// ── Agregar nota manual a la bitácora ───────────────────────
export async function addManualNote(serviceId: string, note: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  if (!note.trim()) return { error: 'La nota no puede estar vacía' }

  const profile = await getProfileInfo(supabase, user.id)
  if (!profile) return { error: 'Perfil no encontrado' }

  const { error } = await supabase.from('service_logs').insert({
    service_id: serviceId,
    company_id: profile.company_id,
    created_by: user.id,
    type: 'manual_note',
    note: note.trim(),
    event_label: `📝 Nota de ${profile.full_name}`,
    actor_role: profile.role,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/services/${serviceId}/capture`)
  return { success: true }
}

// ── Log automático de cambio de status (para usar desde operador) ──
export async function logStatusChange(serviceId: string, newStatus: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getProfileInfo(supabase, user.id)
  if (!profile) return

  const labels: Record<string, string> = {
    rumbo_contacto:     '🚛 Operador en camino al origen',
    arribo_origen:      '📍 Operador llegó al origen',
    contacto:           '🔗 Enganche / Maniobra iniciada',
    inicio_traslado:    '🏎️ Traslado iniciado hacia destino',
    traslado_concluido: '🏁 Vehículo entregado en destino',
    servicio_cerrado:   '✅ Servicio cerrado',
    cancelado_momento:  '❌ Cancelado al momento',
  }

  await supabase.from('service_logs').insert({
    service_id: serviceId,
    company_id: profile.company_id,
    created_by: user.id,
    type: 'status_change',
    note: labels[newStatus] || `Status cambiado a: ${newStatus}`,
    event_label: labels[newStatus] || `Estado: ${newStatus}`,
    actor_role: profile.role,
  })
}
