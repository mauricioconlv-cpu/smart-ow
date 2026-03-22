'use client'

import { useState } from 'react'
import { Send, Loader2, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DispatcherMessageBarProps {
  serviceId: string
}

export default function DispatcherMessageBar({ serviceId }: DispatcherMessageBarProps) {
  const [text, setText]       = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const supabase = createClient()

  const handleSend = async () => {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      await supabase.from('service_logs').insert({
        service_id:  serviceId,
        created_by:  user.id,
        type:        'dispatcher_note',
        note:        msg,
        actor_role:  'dispatcher',
        event_label: '💬 Cabina — mensaje al operador',
      })
      setText('')
      setSent(true)
      setTimeout(() => setSent(false), 2000)
    } catch (e: any) {
      console.error('[DispatcherMessageBar]', e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(30,41,59,0.6)', borderRadius: 12, padding: '10px 12px',
      border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <MessageSquare style={{ width: 14, height: 14, color: '#94a3b8' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Mensaje al Operador
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Escribe un mensaje para el operador…"
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 13,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'white', outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{
            padding: '9px 16px', borderRadius: 8, border: 'none', cursor: !text.trim() || sending ? 'not-allowed' : 'pointer',
            background: sent
              ? 'linear-gradient(135deg,#16a34a,#15803d)'
              : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            opacity: !text.trim() || sending ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
          }}
        >
          {sending
            ? <Loader2 style={{ width: 16, height: 16, color: 'white', animation: 'spin .8s linear infinite' }} />
            : <Send style={{ width: 16, height: 16, color: 'white' }} />}
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </button>
      </div>

      {sent && (
        <p style={{ margin: 0, fontSize: 11, color: '#4ade80', fontWeight: 600 }}>
          ✓ Mensaje enviado al operador
        </p>
      )}
    </div>
  )
}
