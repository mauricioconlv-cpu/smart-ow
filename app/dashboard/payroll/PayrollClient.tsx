'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar, Clock, AlertTriangle, FileText, Upload, Loader2,
  History, CheckCircle, ShieldAlert, Plus, Search, Filter,
  TrendingUp, UserCheck, UserX, Timer, ChevronUp, ChevronDown,
  ChevronsUpDown, X
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ─── Image Compressor ────────────────────────────────────────────────────────
function compressImage(file: File, maxMB = 1): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve(file)
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > 1600) { height = Math.round((height * 1600) / width); width = 1600 }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height)
        let quality = 0.9
        const compress = () => canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Fallo al comprimir'))
          if (blob.size > maxMB * 1024 * 1024 && quality > 0.2) { quality -= 0.1; compress() }
          else resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        }, 'image/jpeg', quality)
        compress()
      }
      img.onerror = () => reject(new Error('Error al leer imagen'))
    }
  })
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface PayrollClientProps {
  employees: any[]
  attendanceLogs: any[]
  timeOffRequests: any[]
  auditLogs: any[]
  currentUserId: string
  companyId: string
  isAdmin: boolean
}

type SortField = 'full_name' | 'role' | 'late_minutes' | 'clock_in_time' | 'total_break_minutes'
type SortDir   = 'asc' | 'desc'

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 16, padding: '20px 22px',
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ─── Sort Header ──────────────────────────────────────────────────────────────
function SortTh({ label, field, sortField, sortDir, onSort }: {
  label: string; field: SortField; sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void
}) {
  const active = sortField === field
  return (
    <th
      onClick={() => onSort(field)}
      style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
        color: active ? '#3b82f6' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active
          ? sortDir === 'asc' ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />
          : <ChevronsUpDown style={{ width: 13, height: 13, opacity: 0.4 }} />}
      </span>
    </th>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PayrollClient({
  employees, attendanceLogs, timeOffRequests, auditLogs, currentUserId, companyId, isAdmin
}: PayrollClientProps) {
  const router   = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<'asistencia' | 'incidencias' | 'auditoria'>('asistencia')

  // ── Filters & Sort ──
  const [search,     setSearch]     = useState('')
  const [filterRole, setFilterRole] = useState<'all' | 'operator' | 'dispatcher'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'late' | 'ontime' | 'absent'>('all')
  const [sortField,  setSortField]  = useState<SortField>('full_name')
  const [sortDir,    setSortDir]    = useState<SortDir>('asc')

  // ── Incidencias ──
  const [showIncidenciaModal, setShowIncidenciaModal] = useState(false)
  const [incidenciaForm, setIncidenciaForm] = useState({ profile_id: '', type: 'vacaciones', start_date: '', end_date: '', notes: '' })
  const [incidenciaFile, setIncidenciaFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // ── Merge employee + today's log ──────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-CA')

  const enriched = useMemo(() => employees.map(emp => {
    const allLogs = attendanceLogs.filter(l => l.profile_id === emp.id || l.profile?.id === emp.id)
    const todayLog = allLogs.find(l => l.log_date === today) ?? null
    const diasAsistidos = new Set(allLogs.map(l => l.log_date)).size
    const retardos = allLogs.filter(l => l.late_minutes > 0).length
    const totalOT  = allLogs.reduce((s, l) => s + (l.overtime_minutes || 0), 0)
    return { ...emp, todayLog, diasAsistidos, retardos, totalOT }
  }), [employees, attendanceLogs, today])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activeToday = enriched.filter(e => e.todayLog).length
    const lateToday   = enriched.filter(e => e.todayLog?.late_minutes > 0).length
    const ontimeToday = enriched.filter(e => e.todayLog && e.todayLog.late_minutes === 0).length
    const absentToday = enriched.filter(e => !e.todayLog).length
    return { activeToday, lateToday, ontimeToday, absentToday }
  }, [enriched])

  // ── Filtered & sorted rows ────────────────────────────────────────────────
  const rows = useMemo(() => {
    let r = enriched.filter(e => {
      if (search && !e.full_name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterRole !== 'all' && e.role !== filterRole) return false
      if (filterStatus === 'late'   && !(e.todayLog?.late_minutes > 0)) return false
      if (filterStatus === 'ontime' && !(e.todayLog && e.todayLog.late_minutes === 0)) return false
      if (filterStatus === 'absent' && e.todayLog) return false
      return true
    })
    r = [...r].sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'full_name')            { va = a.full_name;                               vb = b.full_name }
      else if (sortField === 'role')            { va = a.role;                                    vb = b.role }
      else if (sortField === 'late_minutes')    { va = a.todayLog?.late_minutes ?? -1;            vb = b.todayLog?.late_minutes ?? -1 }
      else if (sortField === 'clock_in_time')   { va = a.todayLog?.clock_in_time ?? '';           vb = b.todayLog?.clock_in_time ?? '' }
      else if (sortField === 'total_break_minutes') { va = a.todayLog?.total_break_minutes ?? -1; vb = b.todayLog?.total_break_minutes ?? -1 }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ?  1 : -1
      return 0
    })
    return r
  }, [enriched, search, filterRole, filterStatus, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // ── Incidencias form ──────────────────────────────────────────────────────
  const handleCreateIncidencia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incidenciaForm.profile_id || !incidenciaForm.start_date || !incidenciaForm.end_date) return
    setLoading(true)
    try {
      let evidence_url = null
      if (incidenciaFile) {
        let fileToUpload = incidenciaFile
        if (fileToUpload.type.startsWith('image/')) fileToUpload = await compressImage(fileToUpload, 1)
        const ext  = fileToUpload.name.split('.').pop()
        const path = `${companyId}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`
        const { error } = await supabase.storage.from('payroll_evidences').upload(path, fileToUpload)
        if (error) throw error
        const { data: pub } = supabase.storage.from('payroll_evidences').getPublicUrl(path)
        evidence_url = pub.publicUrl
      }
      const { error } = await supabase.from('time_off_requests').insert({
        company_id: companyId, profile_id: incidenciaForm.profile_id,
        type: incidenciaForm.type, start_date: incidenciaForm.start_date,
        end_date: incidenciaForm.end_date, notes: incidenciaForm.notes,
        evidence_url, created_by: currentUserId
      })
      if (error) throw error
      await supabase.from('schedule_audit_logs').insert({
        company_id: companyId, actor_id: currentUserId,
        target_profile_id: incidenciaForm.profile_id, action: 'incidencia_creada',
        new_data: { type: incidenciaForm.type, notes: incidenciaForm.notes }
      })
      setShowIncidenciaModal(false); setIncidenciaFile(null)
      router.refresh()
    } catch (err) {
      console.error(err); alert('Error al guardar la incidencia')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Nóminas y Asistencia</h1>
          <p className="text-slate-500 text-sm mt-0.5">Control de asistencia, incidencias formales y monitoreo de retardos.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-200">
        {[
          { id: 'asistencia',  label: 'Récord de Asistencia',        icon: <Clock  className="w-4 h-4" /> },
          { id: 'incidencias', label: 'Bajas Temporales e Incidencias', icon: <Calendar className="w-4 h-4" /> },
          ...(isAdmin ? [{ id: 'auditoria', label: 'Auditoría (Cambios RH)', icon: <History className="w-4 h-4" /> }] : []),
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2
              ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB: ASISTENCIA
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'asistencia' && (
        <div className="space-y-5">

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Activos Hoy"  value={kpis.activeToday}  sub={`de ${employees.length} empleados`} color="#3b82f6" icon={<UserCheck style={{ width: 22, height: 22 }} />} />
            <KpiCard label="A Tiempo"     value={kpis.ontimeToday}  sub="sin retardo hoy"                    color="#10b981" icon={<CheckCircle style={{ width: 22, height: 22 }} />} />
            <KpiCard label="Con Retardo"  value={kpis.lateToday}    sub="llegaron tarde hoy"                 color="#ef4444" icon={<AlertTriangle style={{ width: 22, height: 22 }} />} />
            <KpiCard label="Sin Registro" value={kpis.absentToday}  sub="sin entrada hoy"                    color="#f59e0b" icon={<UserX style={{ width: 22, height: 22 }} />} />
          </div>

          {/* Filters bar */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text" placeholder="Buscar empleado..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role filter */}
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm font-semibold">
              {[
                { v: 'all',        l: 'Todos' },
                { v: 'operator',   l: 'Operadores' },
                { v: 'dispatcher', l: 'Despachadores' },
              ].map(opt => (
                <button key={opt.v} onClick={() => setFilterRole(opt.v as any)}
                  className={`px-3 py-2 transition-colors ${filterRole === opt.v ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {opt.l}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm font-semibold">
              {[
                { v: 'all',    l: 'Todos',      cls: '' },
                { v: 'ontime', l: '✓ A Tiempo',  cls: '' },
                { v: 'late',   l: '⚠ Retardo',   cls: '' },
                { v: 'absent', l: '— Sin entrada', cls: '' },
              ].map(opt => (
                <button key={opt.v} onClick={() => setFilterStatus(opt.v as any)}
                  className={`px-3 py-2 transition-colors text-xs ${filterStatus === opt.v ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {opt.l}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-400 ml-auto">{rows.length} resultado{rows.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                      color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      Empleado
                    </th>
                    <SortTh label="Rol"          field="role"                 sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Entrada Real" field="clock_in_time"        sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Retardo"      field="late_minutes"         sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Break"        field="total_break_minutes"  sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                      color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      Asistencias
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                      color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      OT Extra
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: 13 }}>
                        No hay empleados con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                  {rows.map((emp, idx) => {
                    const log      = emp.todayLog
                    const isLate   = log?.late_minutes > 0
                    const isOntime = log && !isLate
                    const isAbsent = !log

                    return (
                      <tr key={emp.id} style={{
                        borderBottom: idx < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfc')}
                      >
                        {/* Empleado */}
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <img
                                src={emp.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.full_name)}&background=e2e8f0&color=475569&size=64`}
                                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }}
                                alt=""
                              />
                              <span style={{
                                position: 'absolute', bottom: 0, right: 0,
                                width: 9, height: 9, borderRadius: '50%', border: '1.5px solid #fff',
                                background: isOntime ? '#10b981' : isLate ? '#ef4444' : '#d1d5db'
                              }} />
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{emp.full_name}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                                Turno: {emp.hora_entrada ? String(emp.hora_entrada).slice(0,5) : '--'} – {emp.hora_salida ? String(emp.hora_salida).slice(0,5) : '--'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Rol */}
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                            padding: '3px 8px', borderRadius: 6,
                            background: emp.role === 'operator' ? '#eff6ff' : '#fefce8',
                            color: emp.role === 'operator' ? '#1d4ed8' : '#92400e',
                          }}>
                            {emp.role === 'operator' ? 'Operador' : 'Despachador'}
                          </span>
                        </td>

                        {/* Entrada Real */}
                        <td style={{ padding: '11px 16px' }}>
                          {log ? (
                            <span style={{
                              fontSize: 13, fontWeight: 600, color: '#0f172a',
                              background: '#f8fafc', border: '1px solid #e2e8f0',
                              padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace'
                            }}>
                              {new Date(log.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#cbd5e1' }}>Sin registro</span>
                          )}
                        </td>

                        {/* Retardo */}
                        <td style={{ padding: '11px 16px' }}>
                          {isAbsent ? (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                          ) : isLate ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 12, fontWeight: 700, color: '#dc2626',
                              background: '#fef2f2', border: '1px solid #fecaca',
                              padding: '3px 8px', borderRadius: 6,
                            }}>
                              <AlertTriangle style={{ width: 11, height: 11 }} />
                              {log.late_minutes} min
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 12, fontWeight: 700, color: '#059669',
                              background: '#f0fdf4', border: '1px solid #bbf7d0',
                              padding: '3px 8px', borderRadius: 6,
                            }}>
                              <CheckCircle style={{ width: 11, height: 11 }} />
                              A tiempo
                            </span>
                          )}
                        </td>

                        {/* Break */}
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontSize: 13, color: log?.total_break_minutes > 0 ? '#d97706' : '#94a3b8', fontWeight: log?.total_break_minutes > 0 ? 700 : 400 }}>
                            {log ? `${log.total_break_minutes || 0} min` : '—'}
                          </span>
                        </td>

                        {/* Asistencias acumuladas */}
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 900, color: '#1d4ed8' }}>{emp.diasAsistidos}</span>
                            {emp.retardos > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 6px', borderRadius: 10 }}>
                                {emp.retardos} tard.
                              </span>
                            )}
                          </div>
                        </td>

                        {/* OT Extra */}
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontSize: 13, color: emp.totalOT > 0 ? '#7c3aed' : '#94a3b8', fontWeight: emp.totalOT > 0 ? 700 : 400 }}>
                            {emp.totalOT > 0 ? `+${(emp.totalOT / 60).toFixed(1)} hrs` : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: INCIDENCIAS
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'incidencias' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button onClick={() => setShowIncidenciaModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-sm transition-colors">
              <Plus className="w-4 h-4" /> Registrar Incidencia / Incapacidad
            </button>
          </div>

          {timeOffRequests.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay incidencias registradas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {timeOffRequests.map(req => (
                <div key={req.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1.5 h-full rounded-l-xl ${
                    req.type === 'incapacidad' ? 'bg-rose-500' : req.type === 'vacaciones' ? 'bg-amber-400' : 'bg-purple-500'
                  }`}/>
                  <p className="font-bold text-slate-800 text-sm">{req.profile?.full_name}</p>
                  <p className="text-xs font-black uppercase text-slate-400 mb-4">{req.type.replace('_', ' ')}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                    <Calendar className="w-3.5 h-3.5"/>
                    <span className="font-mono">{req.start_date} <span className="text-slate-400">al</span> {req.end_date}</span>
                  </div>
                  {req.notes && <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">{req.notes}</p>}
                  {req.evidence_url && (
                    <a href={req.evidence_url} target="_blank" rel="noopener noreferrer"
                      className="mt-4 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold py-2 rounded-lg transition-colors">
                      <FileText className="w-3.5 h-3.5" /> Ver Justificante / Evidencia
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: AUDITORÍA
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'auditoria' && isAdmin && (
        <div className="bg-white shadow rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4">Auditoría de Supervisores</h3>
          {auditLogs.length === 0
            ? <p className="text-slate-400 text-sm">No hay registros de auditoría.</p>
            : (
              <ul className="space-y-3">
                {auditLogs.map(log => (
                  <li key={log.id} className="text-sm bg-slate-50 p-4 rounded-lg border border-slate-100 flex gap-4">
                    <ShieldAlert className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-slate-500 mb-1 text-xs">{new Date(log.created_at).toLocaleString()}</p>
                      <p className="text-slate-800">
                        <span className="font-bold text-blue-700">{log.actor?.full_name}</span> →{' '}
                        <span className="font-mono uppercase bg-slate-200 px-1 py-0.5 rounded text-[10px]">{log.action}</span>{' '}
                        sobre <span className="font-bold text-slate-900">{log.target?.full_name}</span>
                      </p>
                      {log.new_data && (
                        <pre className="mt-2 text-[10px] bg-slate-800 text-green-400 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL: INCIDENCIA
      ══════════════════════════════════════════════════════════ */}
      {showIncidenciaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Registrar Faltas o Incidencias</h2>
              <button onClick={() => setShowIncidenciaModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateIncidencia} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Empleado Afectado</label>
                <select required value={incidenciaForm.profile_id}
                  onChange={e => setIncidenciaForm({ ...incidenciaForm, profile_id: e.target.value })}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500 font-medium text-slate-800">
                  <option value="">Seleccione empleado...</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Ausencia</label>
                <select required value={incidenciaForm.type}
                  onChange={e => setIncidenciaForm({ ...incidenciaForm, type: e.target.value })}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500">
                  <option value="vacaciones">Vacaciones Pre-Aprobadas</option>
                  <option value="permiso_goce">Falta (Permiso CON goce de sueldo)</option>
                  <option value="permiso_sin_goce">Falta Injustificada (Permiso SIN goce)</option>
                  <option value="incapacidad">Incapacidad Médica Segura</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Inicio</label>
                  <input type="date" required value={incidenciaForm.start_date}
                    onChange={e => setIncidenciaForm({ ...incidenciaForm, start_date: e.target.value })}
                    className="w-full border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Fin</label>
                  <input type="date" required value={incidenciaForm.end_date}
                    onChange={e => setIncidenciaForm({ ...incidenciaForm, end_date: e.target.value })}
                    className="w-full border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Evidencia / Justificante (compresión automática a 1MB)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl px-4 py-5 text-center hover:bg-slate-50 transition-colors">
                  <input type="file" id="evi" accept="image/*,.pdf" className="hidden"
                    onChange={e => e.target.files && setIncidenciaFile(e.target.files[0])} />
                  <label htmlFor="evi" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-6 h-6 text-blue-500 mb-1" />
                    <span className="text-sm font-bold text-blue-600">Subir imagen / PDF</span>
                    <span className="text-xs text-slate-500 mt-1">{incidenciaFile ? incidenciaFile.name : 'No file chosen'}</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas Opcionales</label>
                <textarea rows={2} value={incidenciaForm.notes}
                  onChange={e => setIncidenciaForm({ ...incidenciaForm, notes: e.target.value })}
                  className="w-full border-slate-300 rounded-lg"
                  placeholder="Detalles sobre la ausencia..." />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowIncidenciaModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar y Archivar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
