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

function ItemRow({ label, stateAntes, stateDespues }: { label: string; stateAntes?: string, stateDespues?: string }) {
  const clsAntes = STATE_COLORS[stateAntes ?? ''] ?? 'bg-slate-100 text-slate-400'
  const txtAntes = STATE_LABELS[stateAntes ?? ''] ?? '—'
  
  const clsDespues = STATE_COLORS[stateDespues ?? ''] ?? 'bg-slate-100 text-slate-400'
  const txtDespues = STATE_LABELS[stateDespues ?? ''] ?? 'Pendiente'

  return (
    <div className="grid grid-cols-[1fr_120px_120px] gap-4 items-center py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-2 rounded-lg">
      <span className="text-sm text-slate-700 font-medium">{label}</span>
      <div className="flex justify-start">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${clsAntes}`}>{txtAntes}</span>
      </div>
      <div className="flex justify-start">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${clsDespues}`}>{txtDespues}</span>
      </div>
    </div>
  )
}

function InventorySection({
  title, items, dataAntes, dataDespues
}: { title: string; items: InventoryItem[]; dataAntes: any; dataDespues: any }) {
  return (
    <div className="mb-6">
      <div className="grid grid-cols-[1fr_120px_120px] gap-4 mb-3 border-b-2 border-slate-200 pb-2 px-2">
        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h5>
        <h5 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">📥 Recepción</h5>
        <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">📤 Entrega</h5>
      </div>
      {items.map(item => (
        <ItemRow 
          key={item.id} 
          label={item.label} 
          stateAntes={dataAntes?.items?.[item.id]} 
          stateDespues={dataDespues?.items?.[item.id]} 
        />
      ))}
    </div>
  )
}

function InventoryCombinedCard({
  service, items
}: { service: any; items: InventoryItem[] }) {
  const grouped = ['exteriores', 'interiores', 'accesorios'].map(sec => ({
    sec, secItems: items.filter(i => i.seccion === sec)
  }))

  const savedAntes = service.inv_antes_guardado
  const savedDespues = service.inv_despues_guardado

  return (
    <div className={`border-l-4 rounded-xl shadow-sm overflow-hidden bg-white border-blue-500`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-blue-50">
        <h4 className="font-bold text-slate-800 text-blue-700">Comparativa de Condiciones</h4>
        <div className="flex gap-2">
          {savedAntes && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">Recepción: Guardada</span>}
          {savedDespues && <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">Entrega: Guardada</span>}
        </div>
      </div>

      {!savedAntes ? (
        <div className="px-5 py-6 text-center text-slate-400 text-sm italic">
          El operador aún no ha registrado el inventario inicial de recepción.
        </div>
      ) : (
        <div className="px-5 py-4">
          {grouped.map(({ sec, secItems }) => secItems.length > 0 && (
            <InventorySection
              key={sec}
              title={SECTION_LABELS[sec] ?? sec}
              items={secItems}
              dataAntes={service.inventario_antes}
              dataDespues={service.inventario_despues}
            />
          ))}

          {/* Metadata y Fotografías */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-200">
            {/* Columna Recepción */}
            <div className="space-y-4">
              <h5 className="text-sm font-bold text-amber-700 border-b border-amber-200 pb-2">📥 Detalles de Recepción</h5>
              
              {service.inventario_antes?.km && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 text-sm">🔢 Kilometraje:</span>
                  <span className="font-bold text-slate-800 text-sm">{service.inventario_antes.km} km</span>
                </div>
              )}
              
              {service.inventario_antes?.combustible !== undefined && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-500 text-sm">⛽ Combustible</span>
                    <span className="font-bold text-slate-800 text-sm">{service.inventario_antes.combustible}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${service.inventario_antes.combustible}%` }} />
                  </div>
                </div>
              )}

              {service.inventario_antes?.obs && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs text-amber-700 font-bold mb-1">📝 Observaciones extras:</p>
                  <p className="text-sm text-slate-700">{service.inventario_antes.obs}</p>
                </div>
              )}

              {service.inv_antes_firma && (
                 <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                   <span className="text-amber-600">✍️</span><span className="text-xs font-bold text-amber-800">Firma Registrada</span>
                 </div>
              )}

              {service.inv_antes_fotos?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-2">📸 Fotos de Recepción</p>
                  <div className="flex flex-wrap gap-2">
                    {service.inv_antes_fotos.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 block hover:opacity-80">
                        <img src={url} alt={`antes-foto-${i+1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Columna Entrega */}
            <div className="space-y-4">
              <h5 className="text-sm font-bold text-emerald-700 border-b border-emerald-200 pb-2">📤 Detalles de Entrega</h5>
              
              {!savedDespues ? (
                 <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-400 text-sm">
                   Inventario de entrega pendiente
                 </div>
              ) : (
                <>
                  {service.inventario_despues?.obs && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <p className="text-xs text-emerald-700 font-bold mb-1">📝 Observaciones extra de entrega:</p>
                      <p className="text-sm text-slate-700">{service.inventario_despues.obs}</p>
                    </div>
                  )}

                  {service.inv_despues_firma && (
                     <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                       <span className="text-emerald-600">✍️</span><span className="text-xs font-bold text-emerald-800">Firma de Entrega Registrada</span>
                     </div>
                  )}

                  {service.inv_despues_fotos?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-2">📸 Fotos de Entrega</p>
                      <div className="flex flex-wrap gap-2">
                        {service.inv_despues_fotos.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 block hover:opacity-80">
                            <img src={url} alt={`despues-foto-${i+1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
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

      <div className="p-6">
        <InventoryCombinedCard service={service} items={inventoryItems} />
      </div>
    </div>
  )
}
