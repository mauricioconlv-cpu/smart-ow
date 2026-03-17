'use client'

import { useState, useEffect, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { assignOperator } from './actions'
import {
  ArrowLeft, Truck, MapPin, Clock, Navigation,
  Loader2, CheckCircle2, AlertCircle, UserX, Zap
} from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Haversine (backup line-of-sight) ────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── OSRM route call ──────────────────────────────────────────
async function getRouteInfo(
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number
): Promise<{ distanceKm: number; etaMin: number }> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}?overview=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const json = await res.json()
    if (json.routes?.[0]) {
      return {
        distanceKm: json.routes[0].distance / 1000,
        etaMin: Math.ceil(json.routes[0].duration / 60),
      }
    }
  } catch {}
  // fallback: straight-line + 30% road factor
  const km = haversineKm(fromLat, fromLng, toLat, toLng) * 1.3
  return { distanceKm: km, etaMin: Math.ceil((km / 40) * 60) }
}

// ── Types ────────────────────────────────────────────────────
interface OperatorCard {
  operatorId: string
  fullName: string
  truckId: string
  economicNumber: string
  plates: string
  currentLat: number | null
  currentLng: number | null
  distanceKm: number | null
  etaMin: number | null
  routeLoaded: boolean
}

// ── Component ────────────────────────────────────────────────
export default function AssignPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [service, setService] = useState<any>(null)
  const [operators, setOperators] = useState<OperatorCard[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assignError, setAssignError] = useState('')

  // ── Load service + operators ─────────────────────────────
  useEffect(() => {
    async function load() {
      // 1. Carga el servicio
      const { data: svc } = await supabase
        .from('services')
        .select('id, folio, origen_coords, clients(name)')
        .eq('id', id)
        .single()
      if (!svc) { setLoading(false); return }
      setService(svc)

      // 2. Carga operadores que tienen grúa asignada
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, tow_truck_id')
        .not('tow_truck_id', 'is', null)
        .eq('role', 'operator')

      if (!profiles?.length) { setLoading(false); return }

      // 3. Carga datos de las grúas (ubicación GPS)
      const truckIds = profiles.map(p => p.tow_truck_id!).filter(Boolean)
      const { data: trucks } = await supabase
        .from('tow_trucks')
        .select('id, economic_number, plates, current_location, is_active')
        .in('id', truckIds)
        .eq('is_active', true)

      const truckMap: Record<string, any> = {}
      for (const t of trucks ?? []) truckMap[t.id] = t

      // 4. Construir cards iniciales
      const cards: OperatorCard[] = profiles
        .filter(p => truckMap[p.tow_truck_id!])
        .map(p => {
          const truck = truckMap[p.tow_truck_id!]
          const loc = truck.current_location
          return {
            operatorId: p.id,
            fullName: p.full_name ?? 'Sin nombre',
            truckId: truck.id,
            economicNumber: truck.economic_number,
            plates: truck.plates,
            currentLat: loc?.lat ?? null,
            currentLng: loc?.lng ?? null,
            distanceKm: null,
            etaMin: null,
            routeLoaded: false,
          }
        })
        .sort((a, b) => (a.currentLat ? 0 : 1) - (b.currentLat ? 0 : 1)) // con GPS primero

      setOperators(cards)
      setLoading(false)

      // 5. Para cada operador con GPS, calcular ruta en paralelo
      const originLat = svc.origen_coords?.lat
      const originLng = svc.origen_coords?.lng
      if (!originLat || !originLng) return

      await Promise.all(
        cards.map(async (card, idx) => {
          if (!card.currentLat || !card.currentLng) return
          const route = await getRouteInfo(
            card.currentLat, card.currentLng,
            originLat, originLng
          )
          setOperators(prev =>
            prev.map((c, i) =>
              i === idx
                ? { ...c, distanceKm: route.distanceKm, etaMin: route.etaMin, routeLoaded: true }
                : c
            )
          )
        })
      )

      // Reordenar por distancia
      setOperators(prev => [...prev].sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0
        if (a.distanceKm === null) return 1
        if (b.distanceKm === null) return -1
        return a.distanceKm - b.distanceKm
      }))
    }
    load()
  }, [id])

  // ── Assign handler ───────────────────────────────────────
  function handleAssign(operatorId: string) {
    setAssigning(operatorId)
    setAssignError('')
    startTransition(async () => {
      const res = await assignOperator(id, operatorId)
      if (res.error) {
        setAssignError(res.error)
        setAssigning(null)
      } else {
        router.push(`/dashboard/services/${id}/capture?assigned=true`)
      }
    })
  }

  // ── Render ───────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      <p className="text-slate-500 text-sm">Calculando rutas y ETAs...</p>
    </div>
  )

  const hasOrigin = service?.origen_coords?.lat

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Asignar Grúa</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Folio{' '}
            <span className="font-bold text-blue-600">#{service?.folio}</span>
            {' · '}
            <span className="font-semibold">{service?.clients?.name}</span>
          </p>
        </div>
        {/* Indicador de origen */}
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
          hasOrigin ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <MapPin className="w-3.5 h-3.5" />
          {hasOrigin ? 'Origen con GPS' : 'Sin coords de origen'}
        </div>
      </div>

      {/* Error de asignación */}
      {assignError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {assignError}
        </div>
      )}

      {/* Sin origen GPS — aviso */}
      {!hasOrigin && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            Este servicio no tiene coordenadas de origen capturadas. Las distancias y ETAs no están disponibles,
            pero puedes asignar la grúa manualmente.
          </p>
        </div>
      )}

      {/* Lista de operadores */}
      {operators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 gap-4">
          <UserX className="w-12 h-12 text-slate-300" />
          <div className="text-center">
            <p className="font-semibold text-slate-600">Sin operadores disponibles</p>
            <p className="text-sm text-slate-400 mt-1">
              Asegúrate de que los operadores tengan una grúa asignada y estén activos.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {operators.length} operador{operators.length !== 1 ? 'es' : ''} disponible{operators.length !== 1 ? 's' : ''} — ordenados por cercanía
          </p>

          {operators.map((op, idx) => {
            const isFirst = idx === 0 && op.distanceKm !== null
            const isAssigning = assigning === op.operatorId
            const hasGps = op.currentLat !== null

            return (
              <div
                key={op.operatorId}
                className={`relative bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  isFirst ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'
                }`}
              >
                {/* Badge "más cercano" */}
                {isFirst && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
                    <Zap className="w-3 h-3" /> MÁS CERCANO
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                      isFirst ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      <Truck className={`w-6 h-6 ${isFirst ? 'text-blue-600' : 'text-slate-500'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-base leading-snug">{op.fullName}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Grúa <span className="font-semibold text-slate-700">{op.economicNumber}</span>
                        {' · '}
                        <span className="font-mono text-xs">{op.plates}</span>
                      </p>

                      {/* Métricas */}
                      <div className="mt-3 flex flex-wrap gap-3">
                        {/* Distancia */}
                        <div className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${
                          !hasGps
                            ? 'bg-slate-100 text-slate-400'
                            : !op.routeLoaded
                            ? 'bg-slate-50 text-slate-400'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          <Navigation className="w-4 h-4" />
                          {!hasGps
                            ? 'Sin GPS'
                            : !op.routeLoaded
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : `${op.distanceKm!.toFixed(1)} km`
                          }
                        </div>

                        {/* ETA */}
                        <div className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg ${
                          !hasGps
                            ? 'bg-slate-100 text-slate-400'
                            : !op.routeLoaded
                            ? 'bg-slate-50 text-slate-400'
                            : 'bg-violet-50 text-violet-700'
                        }`}>
                          <Clock className="w-4 h-4" />
                          {!hasGps
                            ? 'Sin GPS'
                            : !op.routeLoaded
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : `~${op.etaMin} min`
                          }
                        </div>

                        {/* GPS status */}
                        {!hasGps && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Operador sin GPS activo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botón asignar */}
                  <button
                    onClick={() => handleAssign(op.operatorId)}
                    disabled={!!assigning || isPending}
                    className={`mt-4 w-full py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                      isFirst
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50'
                        : 'bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50'
                    }`}
                  >
                    {isAssigning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Asignando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Asignar a {op.fullName.split(' ')[0]}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
