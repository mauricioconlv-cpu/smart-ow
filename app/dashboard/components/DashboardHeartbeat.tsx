'use client'

import { useEffect } from 'react'

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000 // cada 5 minutos

async function sendHeartbeat() {
  try {
    await fetch('/api/admin/heartbeat', { method: 'POST' })
  } catch {
    // silencioso — no crítico
  }
}

/**
 * Componente invisible que hace ping al servidor cada 5 minutos
 * para mantener last_seen_at actualizado en la tabla profiles.
 * Montar en el layout del dashboard para capturar admins y dispatchers.
 */
export default function DashboardHeartbeat() {
  useEffect(() => {
    // Ping inmediato al montar
    sendHeartbeat()
    // Ping periódico
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return null
}
