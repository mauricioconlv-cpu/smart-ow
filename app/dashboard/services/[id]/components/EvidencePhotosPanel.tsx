'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Camera, ChevronDown, ChevronUp } from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STAGE_LABELS: Record<string, string> = {
  arribo_origen:      '📍 Llegué al Origen',
  contacto_usuario:   '👋 Contacto con Usuario',
  contacto:           '🔗 Maniobra / Enganche',
  traslado_concluido: '✅ Entregado en Destino',
}

interface Props {
  serviceId: string
}

export default function EvidencePhotosPanel({ serviceId }: Props) {
  const [byStage, setByStage] = useState<Record<string, { url: string; time: string }[]>>({})
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('service_logs')
        .select('id, note, resource_url, created_at')
        .eq('service_id', serviceId)
        .eq('type', 'photo_evidence')
        .order('created_at', { ascending: true })

      if (data) {
        const grouped: Record<string, { url: string; time: string }[]> = {}
        for (const log of data) {
          if (!log.resource_url) continue
          // Extraer stage del note: "📷 Evidencia fotográfica — arribo_origen"
          const match = log.note?.match(/—\s*(\w+)$/)
          const stage = match?.[1] ?? 'general'
          if (!grouped[stage]) grouped[stage] = []
          grouped[stage].push({
            url: log.resource_url,
            time: new Date(log.created_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
          })
        }
        setByStage(grouped)
      }
      setLoading(false)
    }

    load()

    // Escuchar nuevas fotos en tiempo real
    const ch = supabase.channel(`evidence-${serviceId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'service_logs',
        filter: `service_id=eq.${serviceId}`,
      }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [serviceId])

  const totalPhotos = Object.values(byStage).reduce((s, a) => s + a.length, 0)
  const hasPhotos = totalPhotos > 0

  if (loading) return null
  if (!hasPhotos) return (
    <div className="max-w-4xl mx-auto bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
      <Camera className="w-5 h-5 text-amber-400 shrink-0" />
      <p className="text-sm text-amber-700 font-medium">Sin evidencias fotográficas subidas por el operador aún.</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-5 py-3.5 border-b border-amber-100 bg-amber-50 hover:bg-amber-100 transition text-left"
      >
        <Camera className="w-4 h-4 text-amber-600" />
        <h3 className="font-bold text-sm text-amber-800">Evidencias Fotográficas del Operador</h3>
        <span className="ml-2 text-xs bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-full">
          {totalPhotos} foto{totalPhotos !== 1 ? 's' : ''}
        </span>
        <span className="ml-auto text-amber-500">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="p-5 space-y-6">
          {Object.entries(STAGE_LABELS).map(([stage, label]) => {
            const photos = byStage[stage]
            if (!photos?.length) return null
            return (
              <div key={stage}>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">
                  {label}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map((p, i) => (
                    <a
                      key={i}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block rounded-xl overflow-hidden border border-amber-100 aspect-square bg-amber-50 hover:shadow-md transition"
                    >
                      <img
                        src={p.url}
                        alt={`Evidencia ${label} #${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition">
                        <p className="text-white text-[10px] font-medium">{p.time}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Etapas sin label conocido (fallback) */}
          {byStage['general'] && byStage['general'].length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Otras evidencias</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {byStage['general'].map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer"
                    className="block rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-50 hover:shadow-md transition">
                    <img src={p.url} alt={`Evidencia #${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
