'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'

// 10 minutos para entrar en Break, 75 minutos total (65m de break) para desconexión
const BREAK_TIMEOUT_MS = 10 * 60 * 1000
const LOGOUT_TIMEOUT_MS = 75 * 60 * 1000

export default function IdleTracker({ userId }: { userId: string }) {
  const router = useRouter()
  
  const lastActivityRef = useRef<number>(Date.now())
  const [status, setStatus] = useState<'active' | 'break'>('active')
  const statusRef = useRef<'active' | 'break'>('active')

  const changeStatus = useCallback(async (newStatus: 'active' | 'break') => {
    if (newStatus === statusRef.current) return
    setStatus(newStatus)
    statusRef.current = newStatus

    try {
      if (newStatus === 'break') {
        fetch('/api/attendance/break', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isBreak: true })
        })
      } else {
        fetch('/api/attendance/break', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isBreak: false })
        })
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const checkForInactivity = useCallback(async () => {
    const now = Date.now()
    const elapsed = now - lastActivityRef.current

    if (elapsed >= LOGOUT_TIMEOUT_MS) {
      // 75 min: Cerrar sesión automática y sellar salida
      await fetch('/api/attendance/logout', { method: 'POST' })
      router.push('/login')
      return
    }

    if (elapsed >= BREAK_TIMEOUT_MS && statusRef.current === 'active') {
      // 10 min: Pasar a Break
      changeStatus('break')
    }
  }, [changeStatus, router])

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now()
      if (statusRef.current === 'break') {
        changeStatus('active')
      }
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)
    window.addEventListener('scroll', handleActivity)

    const interval = setInterval(checkForInactivity, 60000) // Revisar cada minuto

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      clearInterval(interval)
    }
  }, [checkForInactivity, changeStatus])

  if (status === 'break') {
    return (
      <div className="fixed top-20 right-6 z-[99] animate-pulse pointer-events-none">
        <div className="bg-amber-100/90 border-2 border-amber-500 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 backdrop-blur-sm">
          <Clock className="w-6 h-6 text-amber-600" />
          <div>
            <p className="font-extrabold text-amber-900 leading-tight">Estado: Ausente (Break)</p>
            <p className="text-xs text-amber-700 font-bold">Mueve el mouse para reanudar turno</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
