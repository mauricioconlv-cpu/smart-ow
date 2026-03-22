'use client'

import { Mic, Loader2, Radio, Mic2, Mailbox } from 'lucide-react'
import { useState, useEffect } from 'react'
import { usePttSession } from '@/lib/ptt/usePttSession'

interface Props {
  serviceId: string
}

export default function DispatcherPttBar({ serviceId }: Props) {
  const { mode, startPtt, stopPtt, incomingActive, isPeerPresent } = usePttSession({
    serviceId,
    role: 'dispatcher',
  })

  const [hasMic, setHasMic] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setHasMic(devices.some(d => d.kind === 'audioinput'))
    }).catch(() => setHasMic(false))
  }, [])

  const isActive  = mode === 'streaming' || mode === 'recording' || mode === 'connecting'
  const isLoading = mode === 'uploading'

  const togglePtt = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (isLoading) return
    if (isActive) stopPtt()
    else startPtt()
  }

  if (hasMic === false) return null  // no mic → hide the bar

  // ── Labels & colors ────────────────────────────────────────────────────
  const isVoicemail = !isPeerPresent  // peer offline → mailbox mode

  const idleLabel    = isVoicemail ? 'Dejar mensaje de voz al operador' : 'Toca para hablar'
  const idleSubLabel = isVoicemail
    ? 'El operador no está en el expediente. Tu mensaje quedará en su buzón.'
    : 'Walkie-talkie activo — el operador está en línea'

  const activeLabel = mode === 'connecting'
    ? 'Conectando...'
    : mode === 'streaming'
      ? 'Toca para detener'
      : isVoicemail ? 'Grabando buzón... toca para enviar' : 'Toca para enviar'

  const buttonBg = isLoading
    ? '#f59e0b'
    : isActive
      ? mode === 'streaming' ? '#10b981' : '#ef4444'
      : isVoicemail ? '#6366f1' : '#3b82f6'

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${isVoicemail ? '#c7d2fe' : '#e2e8f0'}`,
      borderRadius: 14,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: incomingActive
        ? '0 0 0 3px rgba(59,130,246,0.3)'
        : isVoicemail
          ? '0 0 0 2px rgba(99,102,241,0.15)'
          : 'none',
      transition: 'box-shadow 0.3s',
    }}>

      {/* Incoming indicator */}
      {incomingActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pttPulse 1s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Operador al habla...</span>
          <style>{`@keyframes pttPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0.6}}`}</style>
        </div>
      )}

      {!incomingActive && (
        <div style={{ flex: 1 }}>
          {/* Mode badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '2px 6px', borderRadius: 4,
              background: isVoicemail ? '#eef2ff' : '#eff6ff',
              color: isVoicemail ? '#6366f1' : '#3b82f6',
            }}>
              {isVoicemail ? '📬 Buzón de voz' : '📡 Walkie-talkie'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            {isActive ? activeLabel : idleLabel}
          </p>
          {!isActive && (
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {idleSubLabel}
            </p>
          )}
        </div>
      )}

      {/* PTT Button */}
      <button
        onClick={togglePtt}
        disabled={isLoading}
        style={{
          width: 54, height: 54, borderRadius: '50%', border: 'none',
          background: buttonBg,
          color: 'white', cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isActive
            ? '0 0 0 8px rgba(239,68,68,0.2)'
            : isVoicemail
              ? '0 2px 8px rgba(99,102,241,0.3)'
              : '0 2px 8px rgba(37,99,235,0.3)',
          transition: 'all 0.2s',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {isLoading
          ? <Loader2 style={{ width: 24, height: 24, animation: 'pttSpin 1s linear infinite' }} />
          : mode === 'streaming'
            ? <Radio style={{ width: 24, height: 24 }} />
            : isActive
              ? <Mic2 style={{ width: 24, height: 24 }} />
              : isVoicemail
                ? <Mailbox style={{ width: 22, height: 22 }} />
                : <Mic style={{ width: 24, height: 24 }} />
        }
        {isActive && (
          <span style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            border: '2px solid rgba(239,68,68,0.5)',
            animation: 'pttPing 1s cubic-bezier(0,0,0.2,1) infinite',
          }} />
        )}
        <style>{`
          @keyframes pttPing{0%{transform:scale(1);opacity:1}100%{transform:scale(1.6);opacity:0}}
          @keyframes pttSpin{to{transform:rotate(360deg)}}
        `}</style>
      </button>
    </div>
  )
}
