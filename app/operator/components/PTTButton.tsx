'use client'

import { Mic, Loader2, MicOff } from 'lucide-react'
import { useVoiceMessage } from '@/lib/hooks/useVoiceMessage'

export default function PTTButton({ activeServiceId }: { activeServiceId?: string }) {
  const { mode, startRecording, stopRecording } = useVoiceMessage({
    serviceId: activeServiceId,
    role: 'operator',
  })

  const isDisabled  = !activeServiceId || mode === 'uploading'
  const isRecording = mode === 'recording'

  const toggle = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (isDisabled) return
    if (isRecording) await stopRecording()
    else await startRecording()
  }

  const label = !activeServiceId
    ? 'Sin servicio activo'
    : mode === 'recording'  ? 'Toca para enviar'
    : mode === 'uploading'  ? 'Enviando audio…'
    : 'Toca para dejar un mensaje'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button
        onClick={toggle}
        disabled={isDisabled}
        title={label}
        style={{
          position: 'relative', width: 52, height: 52, borderRadius: '50%',
          border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer',
          background: isRecording
            ? 'linear-gradient(135deg,#ef4444,#dc2626)'
            : mode === 'uploading'
              ? 'linear-gradient(135deg,#f59e0b,#d97706)'
              : 'linear-gradient(135deg,#3b82f6,#2563eb)',
          boxShadow: isRecording ? '0 0 18px rgba(239,68,68,0.7)' : '0 2px 8px rgba(0,0,0,0.3)',
          transform: isRecording ? 'scale(1.15)' : 'scale(1)',
          transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: isDisabled ? 0.4 : 1,
          touchAction: 'none',
        }}
      >
        {mode === 'uploading' ? (
          <Loader2 style={{ width: 22, height: 22, color: 'white', animation: 'spin 0.8s linear infinite' }} />
        ) : isRecording ? (
          <MicOff style={{ width: 22, height: 22, color: 'white' }} />
        ) : (
          <Mic style={{ width: 22, height: 22, color: 'white' }} />
        )}

        {/* Pulse rings while recording */}
        {isRecording && (
          <>
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid rgba(239,68,68,0.6)',
              animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid rgba(239,68,68,0.3)',
              animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
              animationDelay: '0.4s',
            }} />
          </>
        )}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes ping {
            75%, 100% { transform: scale(1.8); opacity: 0; }
          }
        `}</style>
      </button>

      <span style={{
        fontSize: 9, fontWeight: 800, color: isRecording ? '#ef4444' : 'rgba(148,163,184,0.7)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        animation: isRecording ? 'pulse 1s ease-in-out infinite' : 'none',
      }}>
        {isRecording ? '● REC' : mode === 'uploading' ? 'ENVIANDO' : 'VOZ'}
      </span>
    </div>
  )
}
