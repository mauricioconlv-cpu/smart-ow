'use client'
// components/InventoryPanel.tsx
// Panel de visualización del inventario de vehículo en el dashboard de admin/dispatcher

const STATE_COLORS: Record<string, string> = {
  bien:  'bg-green-100 text-green-700',
  danio: 'bg-amber-100 text-amber-700',
  falta: 'bg-red-100 text-red-700',
}

const STATE_LABELS: Record<string, string> = {
  bien: '✓ Bien', danio: '⚠ Daño', falta: '✗ Falta',
}

const SECTION_LABELS: Record<string, string> = {
  exteriores: '🚗 Exteriores',
  interiores: '🪑 Interiores',
  accesorios: '🔧 Accesorios',
}

interface InventoryItem { id: string; seccion: string; label: string; orden: number }

interface Props {
  service: any
  inventoryItems: InventoryItem[]
}

function ItemRow({ label, state }: { label: string; state?: string }) {
  const cls = STATE_COLORS[state ?? ''] ?? 'bg-slate-100 text-slate-400'
  const txt = STATE_LABELS[state ?? ''] ?? '—'
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{txt}</span>
    </div>
  )
}

function InventorySection({
  title, items, itemStates
}: { title: string; items: InventoryItem[]; itemStates: Record<string, string> }) {
  return (
    <div className="mb-4">
      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</h5>
      {items.map(item => (
        <ItemRow key={item.id} label={item.label} state={itemStates?.[item.id]} />
      ))}
    </div>
  )
}

function InventoryCard({
  title, color, data, fotos, firma, saved, items
}: {
  title: string; color: string; data: any; fotos: string[]; firma?: string; saved: boolean; items: InventoryItem[]
}) {
  const grouped = ['exteriores', 'interiores', 'accesorios'].map(sec => ({
    sec, secItems: items.filter(i => i.seccion === sec)
  }))

  return (
    <div className={`border-l-4 rounded-xl shadow-sm overflow-hidden bg-white`} style={{ borderColor: color }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100" style={{ backgroundColor: color + '10' }}>
        <h4 className="font-bold text-slate-800" style={{ color }}>{title}</h4>
        {saved
          ? <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">✓ Guardado y bloqueado</span>
          : <span className="text-xs font-bold bg-slate-100 text-slate-400 px-3 py-1 rounded-full">Pendiente</span>
        }
      </div>

      {!saved ? (
        <div className="px-5 py-6 text-center text-slate-400 text-sm italic">
          El operador aún no ha registrado este inventario.
        </div>
      ) : (
        <div className="px-5 py-4">
          {/* Ítems por sección */}
          {grouped.map(({ sec, secItems }) => secItems.length > 0 && (
            <InventorySection
              key={sec}
              title={SECTION_LABELS[sec] ?? sec}
              items={secItems}
              itemStates={data?.items ?? {}}
            />
          ))}

          {/* Kilometraje y combustible (solo recepción) */}
          {data?.km && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-500 text-sm">🔢 Km al recoger:</span>
              <span className="font-bold text-slate-800 text-sm">{data.km} km</span>
            </div>
          )}
          {data?.combustible !== undefined && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-500 text-sm">⛽ Nivel de combustible</span>
                <span className="font-bold text-slate-800 text-sm">{data.combustible}%</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${data.combustible}%` }} />
              </div>
            </div>
          )}

          {/* Observaciones */}
          {data?.obs && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 font-semibold mb-1">📝 Observaciones:</p>
              <p className="text-sm text-slate-700">{data.obs}</p>
            </div>
          )}

          {/* Firma */}
          {firma && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <span className="text-green-600 text-lg">✍️</span>
              <span className="text-sm font-semibold text-green-700">Firma de conformidad registrada</span>
            </div>
          )}

          {/* Fotos */}
          {fotos.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">📸 Fotos del vehículo</p>
              <div className="flex flex-wrap gap-2">
                {fotos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 block hover:opacity-80 transition">
                    <img src={url} alt={`foto-${i+1}`} className="w-full h-full object-cover" />
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

export default function InventoryPanel({ service, inventoryItems }: Props) {
  if (!service?.viaja_bajo_inventario) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
      {/* Header panel */}
      <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border-b border-amber-200">
        <span className="text-2xl">📋</span>
        <div>
          <h3 className="font-bold text-amber-900 text-base">Inventario de Vehículo</h3>
          <p className="text-xs text-amber-600">Este servicio se realiza bajo inventario de condición</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <InventoryCard
          title="📥 Recepción — Estado del vehículo al recoger"
          color="#f59e0b"
          data={service.inventario_antes}
          fotos={service.inv_antes_fotos ?? []}
          firma={service.inv_antes_firma}
          saved={service.inv_antes_guardado}
          items={inventoryItems}
        />
        <InventoryCard
          title="📤 Entrega — Estado del vehículo al entregar"
          color="#10b981"
          data={service.inventario_despues}
          fotos={service.inv_despues_fotos ?? []}
          firma={service.inv_despues_firma}
          saved={service.inv_despues_guardado}
          items={inventoryItems}
        />
      </div>
    </div>
  )
}
