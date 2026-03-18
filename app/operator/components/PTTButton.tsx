'use client'

import { Mic, Loader2, Radio, Mic2 } from 'lucide-react'
import { usePttSession } from '@/lib/ptt/usePttSession'

export default function PTTButton({ activeServiceId }: { activeServiceId?: string }) {
  const { mode, startPtt, stopPtt, incomingActive } = usePttSession({
    serviceId: activeServiceId,
    role: 'operator',
  })

  const isDisabled = !activeServiceId || mode === 'uploading'

  // Color & label by mode
  const style = (() => {
    if (!activeServiceId) return { bg: 'bg-slate-300', label: 'Sin servicio activo' }
    switch (mode) {
      case 'connecting': return { bg: 'bg-yellow-500 animate-pulse', label: 'Conectando...' }
      case 'streaming':  return { bg: 'bg-green-500',               label: 'En vivo' }
      case 'recording':  return { bg: 'bg-red-500 animate-pulse',    label: 'Grabando' }
      case 'uploading':  return { bg: 'bg-amber-400',                label: 'Enviando...' }
      default:           return { bg: 'bg-blue-600 hover:bg-blue-500', label: 'PTT' }
    }
  })()

  const isActive = mode === 'streaming' || mode === 'recording' || mode === 'connecting'

  return (
    <div className="flex flex-col items-center">
      {/* Incoming audio indicator */}
      {incomingActive && (
        <span className="mb-1 text-[9px] font-black text-green-300 uppercase tracking-widest animate-pulse">
          ◉ Cabina
        </span>
      )}

      <button
        onMouseDown={startPtt}
        onMouseUp={stopPtt}
        onMouseLeave={() => { if (isActive) stopPtt() }}
        onTouchStart={(e) => { e.preventDefault(); startPtt() }}
        onTouchEnd={(e) => { e.preventDefault(); stopPtt() }}
        disabled={isDisabled}
        title={style.label}
        className={`relative p-3 rounded-full flex items-center justify-center transition-all touch-none select-none
          ${style.bg}
          ${isActive ? 'shadow-[0_0_18px_rgba(239,68,68,0.7)] scale-110' : ''}
          ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {mode === 'uploading' ? (
          <Loader2 className="h-5 w-5 text-white animate-spin" />
        ) : mode === 'streaming' ? (
          <Radio className="h-5 w-5 text-white" />
        ) : mode === 'recording' || mode === 'connecting' ? (
          <Mic2 className="h-5 w-5 text-white fill-current" />
        ) : (
          <Mic className="h-5 w-5 text-white" />
        )}

        {/* Ripple rings while active */}
        {isActive && (
          <>
            <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-60" />
            <span className="absolute inset-0 rounded-full border border-red-300 animate-ping opacity-30" style={{ animationDelay: '0.3s' }} />
          </>
        )}
      </button>

      {/* Mode badge */}
      {isActive && (
        <span className="mt-1 text-[9px] font-black text-red-300 uppercase tracking-widest">
          {mode === 'connecting' ? '…' : mode === 'streaming' ? 'EN VIVO' : 'REC'}
        </span>
      )}
    </div>
  )
}
