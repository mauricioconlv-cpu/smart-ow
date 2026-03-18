'use client'

import { useState } from 'react'
import { Shield, ChevronDown, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  currentLevel: number
  isAdmin: boolean
}

const LEVELS = [
  { value: 0, label: 'Básico', desc: 'Sin poderes extra', color: '#64748b' },
  { value: 1, label: 'Supervisor', desc: 'Puede cerrar turnos de operadores', color: '#f59e0b' },
  { value: 2, label: 'Supervisor Jefe', desc: 'Poderes similares a administrador', color: '#8b5cf6' },
]

export default function DispatcherLevelSelector({ userId, currentLevel, isAdmin }: Props) {
  const [level, setLevel] = useState(currentLevel)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const current = LEVELS.find(l => l.value === level) ?? LEVELS[0]

  async function handleChange(newLevel: number) {
    if (!isAdmin || newLevel === level) return
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ supervisor_level: newLevel })
      .eq('id', userId)
    setLevel(newLevel)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!isAdmin) {
    // Solo mostrar, no editar
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
          fontWeight: 600, color: current.color }}
      >
        <Shield style={{ width: 11, height: 11 }} />
        {current.label}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Nivel:</span>
      <div style={{ position: 'relative' }}>
        <select
          value={level}
          onChange={e => handleChange(Number(e.target.value))}
          disabled={saving}
          style={{
            appearance: 'none', paddingRight: 24, paddingLeft: 10, paddingTop: 4, paddingBottom: 4,
            borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600,
            background: 'white', color: current.color, cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {LEVELS.map(l => (
            <option key={l.value} value={l.value}>{l.label} — {l.desc}</option>
          ))}
        </select>
        <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          {saving
            ? <Loader2 style={{ width: 10, height: 10, animation: 'spin 1s linear infinite', color: '#94a3b8' }} />
            : <ChevronDown style={{ width: 10, height: 10, color: '#94a3b8' }} />
          }
        </div>
      </div>
      {saved && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>✓ Guardado</span>}
    </div>
  )
}
