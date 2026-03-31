'use client'
// app/dashboard/configuracion/inventario/page.tsx
// Configuración de ítems de inventario de vehículo — solo para administradores

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, Trash2, GripVertical, Check, X, Settings2 } from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SECCIONES = [
  { key: 'exteriores', label: '🚗 Exteriores', color: 'blue' },
  { key: 'interiores', label: '🪑 Interiores', color: 'indigo' },
  { key: 'accesorios', label: '🔧 Accesorios', color: 'emerald' },
] as const

type SeccionKey = 'exteriores' | 'interiores' | 'accesorios'

interface Item {
  id: string
  seccion: SeccionKey
  label: string
  orden: number
  activo: boolean
}

export default function InventarioConfigPage() {
  const [items,     setItems]     = useState<Item[]>([])
  const [loading,   setLoading]   = useState(true)
  const [adding,    setAdding]    = useState<SeccionKey | null>(null)
  const [newLabel,  setNewLabel]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Cargar ítems
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: it } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('seccion').order('orden')

      if (it) setItems(it as Item[])
      setLoading(false)
    }
    load()
  }, [])

  const itemsBySection = (sec: SeccionKey) => items.filter(i => i.seccion === sec)

  // Agregar ítem
  const handleAdd = async (sec: SeccionKey) => {
    if (!newLabel.trim() || !companyId) return
    setSaving(true)
    const maxOrden = Math.max(0, ...itemsBySection(sec).map(i => i.orden))
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({ company_id: companyId, seccion: sec, label: newLabel.trim(), orden: maxOrden + 1 })
      .select('*')
      .single()
    if (!error && data) {
      setItems(prev => [...prev, data as Item])
      setNewLabel('')
      setAdding(null)
    }
    setSaving(false)
  }

  // Toggle activo/inactivo
  const handleToggle = async (item: Item) => {
    const { error } = await supabase
      .from('inventory_items')
      .update({ activo: !item.activo })
      .eq('id', item.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, activo: !i.activo } : i))
    }
  }

  // Eliminar ítem
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este ítem? No se podrá recuperar.')) return
    const { error } = await supabase.from('inventory_items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  // Renombrar ítem
  const handleRename = async (item: Item, newName: string) => {
    if (!newName.trim() || newName === item.label) return
    const { error } = await supabase
      .from('inventory_items')
      .update({ label: newName.trim() })
      .eq('id', item.id)
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, label: newName.trim() } : i))
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-60">
      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-100 rounded-xl">
          <Settings2 className="w-6 h-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ítems de Inventario</h1>
          <p className="text-sm text-slate-500">Configura las preguntas del formulario de inventario de vehículo</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        ⚠️ Los cambios aplican a todos los servicios futuros marcados como "viaja bajo inventario".
        Los servicios ya guardados no se verán afectados.
      </div>

      {/* Secciones */}
      {SECCIONES.map(sec => (
        <div key={sec.key} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header sección */}
          <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 text-base">{sec.label}</h2>
            <span className="text-xs text-slate-400">{itemsBySection(sec.key).filter(i => i.activo).length} activos / {itemsBySection(sec.key).length} total</span>
          </div>

          {/* Lista de ítems */}
          <div className="divide-y divide-slate-100">
            {itemsBySection(sec.key).map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={() => handleToggle(item)}
                onDelete={() => handleDelete(item.id)}
                onRename={(name) => handleRename(item, name)}
              />
            ))}
            {itemsBySection(sec.key).length === 0 && (
              <p className="text-center text-slate-400 text-sm py-6 italic">Sin ítems — agrega el primero</p>
            )}
          </div>

          {/* Agregar ítem */}
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
            {adding === sec.key ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(sec.key); if (e.key === 'Escape') setAdding(null) }}
                  placeholder="Nombre del ítem (ej: Tapetes)"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={() => handleAdd(sec.key)}
                  disabled={saving || !newLabel.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? '...' : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => { setAdding(null); setNewLabel('') }}
                  className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAdding(sec.key); setNewLabel('') }}
                className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                <Plus className="w-4 h-4" /> Agregar ítem
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Fila de ítem ────────────────────────────────────────────────────────────

function ItemRow({ item, onToggle, onDelete, onRename }: {
  item: Item
  onToggle: () => void
  onDelete: () => void
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(item.label)

  return (
    <div className={`flex items-center gap-3 px-5 py-3 group transition ${!item.activo ? 'opacity-50' : ''}`}>
      <GripVertical className="w-4 h-4 text-slate-300 cursor-grab flex-shrink-0" />

      {editing ? (
        <input
          autoFocus
          className="flex-1 border border-blue-300 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { onRename(val); setEditing(false) }}
          onKeyDown={e => { if (e.key === 'Enter') { onRename(val); setEditing(false) } if (e.key === 'Escape') { setVal(item.label); setEditing(false) } }}
        />
      ) : (
        <span
          className="flex-1 text-sm text-slate-700 cursor-pointer hover:text-blue-600 transition"
          onDoubleClick={() => setEditing(true)}
          title="Doble clic para renombrar"
        >
          {item.label}
        </span>
      )}

      {/* Toggle activo */}
      <button
        onClick={onToggle}
        className={`px-2 py-0.5 rounded-full text-xs font-bold transition ${
          item.activo
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
        }`}
        title={item.activo ? 'Desactivar' : 'Activar'}
      >
        {item.activo ? '✓ Activo' : 'Inactivo'}
      </button>

      {/* Eliminar */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
        title="Eliminar ítem"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
