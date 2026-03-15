'use client'

import { useState, useEffect, useTransition } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { addManualNote } from '../capture/actions'
import {
  Lock, Truck, RefreshCw, FileText, Send, Loader2, AlertCircle
} from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  edit_unlock:   { icon: Lock,      color: 'text-amber-600',  bg: 'bg-amber-50  border-amber-200'  },
  assignment:    { icon: Truck,     color: 'text-blue-600',   bg: 'bg-blue-50   border-blue-200'   },
  status_change: { icon: RefreshCw, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
  manual_note:   { icon: FileText,  color: 'text-slate-600',  bg: 'bg-white     border-slate-200'  },
  system_note:   { icon: RefreshCw, color: 'text-slate-500',  bg: 'bg-slate-50  border-slate-200'  },
}

interface LogEntry {
  id: string
  type: string
  note: string
  event_label: string | null
  actor_role: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

interface ServiceLogProps {
  serviceId: string
  canAddNotes: boolean   // call center o operator, según módulo
}

export default function ServiceLog({ serviceId, canAddNotes }: ServiceLogProps) {
  const [logs, setLogs]         = useState<LogEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [noteText, setNoteText] = useState('')
  const [noteErr, setNoteErr]   = useState('')
  const [isPending, start]      = useTransition()

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('service_logs')
      .select('id, type, note, event_label, actor_role, created_at, profiles(full_name)')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: true })
    if (data) setLogs(data.map((d: any) => ({
      ...d,
      profiles: Array.isArray(d.profiles) ? d.profiles[0] ?? null : d.profiles,
    })) as LogEntry[])
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
    // Suscripción en tiempo real
    const channel = supabase
      .channel(`logs_${serviceId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'service_logs',
        filter: `service_id=eq.${serviceId}`,
      }, () => fetchLogs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [serviceId])

  function handleAddNote() {
    if (!noteText.trim()) return
    setNoteErr('')
    start(async () => {
      const res = await addManualNote(serviceId, noteText)
      if (res.error) { setNoteErr(res.error); return }
      setNoteText('')
      fetchLogs()
    })
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
        <FileText className="w-4 h-4 text-slate-500" />
        <h3 className="font-bold text-sm text-slate-700">Bitácora del Expediente</h3>
        <span className="ml-auto text-xs text-slate-400 font-medium">inmutable · {logs.length} entradas</span>
      </div>

      {/* Entries */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 p-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        )}
        {!loading && logs.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">Sin entradas aún.</p>
        )}
        {logs.map(log => {
          const cfg = TYPE_CONFIG[log.type] ?? TYPE_CONFIG.manual_note
          const Icon = cfg.icon
          return (
            <div key={log.id} className={`flex gap-3 p-3 rounded-lg border ${cfg.bg}`}>
              <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                {log.event_label && (
                  <p className={`text-xs font-bold mb-0.5 ${cfg.color}`}>{log.event_label}</p>
                )}
                <p className="text-sm text-slate-700 leading-snug">{log.note}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {log.profiles?.full_name ?? 'Sistema'}
                  {log.actor_role && <span className="ml-1 capitalize opacity-70">({log.actor_role})</span>}
                  {' · '}
                  {formatTime(log.created_at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input manual */}
      {canAddNotes && (
        <div className="border-t border-slate-200 p-3 bg-slate-50 space-y-2">
          {noteErr && (
            <div className="flex items-center gap-2 text-red-600 text-xs">
              <AlertCircle className="w-3.5 h-3.5" /> {noteErr}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote() }}
              placeholder="Agregar nota... (Ctrl+Enter para enviar)"
              rows={2}
              className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none outline-none"
            />
            <button
              onClick={handleAddNote}
              disabled={isPending || !noteText.trim()}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-40 self-end"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">Las notas son permanentes y no pueden editarse.</p>
        </div>
      )}
    </div>
  )
}
