'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, AlertTriangle, FileText, Upload, Loader2, Users, History, CheckCircle, ShieldAlert, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

function compressImage(file: File, maxMB: number = 1): Promise<File> {
  return new Promise((resolve, reject) => {
    // Si no es imagen, retornar original (ej. pdf)
    if (!file.type.startsWith('image/')) return resolve(file)

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        if (width > 1600) {
          height = Math.round((height * 1600) / width)
          width = 1600
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.imageSmoothingEnabled === true
        ctx?.imageSmoothingQuality === 'high'
        ctx?.drawImage(img, 0, 0, width, height)
        
        let quality = 0.9
        const compress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Fallo al comprimir imagen'))
            if (blob.size > maxMB * 1024 * 1024 && quality > 0.2) {
              quality -= 0.1
              compress()
            } else {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }))
            }
          }, 'image/jpeg', quality)
        }
        compress()
      }
      img.onerror = () => reject(new Error('Error al leer imagen'))
    }
  })
}

interface PayrollClientProps {
  employees: any[]
  attendanceLogs: any[]
  timeOffRequests: any[]
  auditLogs: any[]
  currentUserId: string
  companyId: string
  isAdmin: boolean
}

export default function PayrollClient({
  employees, attendanceLogs, timeOffRequests, auditLogs, currentUserId, companyId, isAdmin
}: PayrollClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'asistencia' | 'incidencias' | 'auditoria'>('asistencia')
  
  // Modals / Formularios
  const [showIncidenciaModal, setShowIncidenciaModal] = useState(false)
  const [incidenciaForm, setIncidenciaForm] = useState({
    profile_id: '', type: 'vacaciones', start_date: '', end_date: '', notes: ''
  })
  const [incidenciaFile, setIncidenciaFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreateIncidencia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incidenciaForm.profile_id || !incidenciaForm.start_date || !incidenciaForm.end_date) return
    setLoading(true)

    try {
      let evidence_url = null
      if (incidenciaFile) {
        let fileToUpload = incidenciaFile
        if (fileToUpload.type.startsWith('image/')) {
          fileToUpload = await compressImage(fileToUpload, 1)
        }
        const ext = fileToUpload.name.split('.').pop()
        const path = `${companyId}/${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`
        
        const { data, error } = await supabase.storage.from('payroll_evidences').upload(path, fileToUpload)
        if (error) throw error
        
        const { data: publicUrl } = supabase.storage.from('payroll_evidences').getPublicUrl(path)
        evidence_url = publicUrl.publicUrl
      }

      const { error } = await supabase.from('time_off_requests').insert({
        company_id: companyId,
        profile_id: incidenciaForm.profile_id,
        type: incidenciaForm.type,
        start_date: incidenciaForm.start_date,
        end_date: incidenciaForm.end_date,
        notes: incidenciaForm.notes,
        evidence_url,
        created_by: currentUserId
      })

      if (error) throw error
      
      // Log audit
      await supabase.from('schedule_audit_logs').insert({
        company_id: companyId,
        actor_id: currentUserId,
        target_profile_id: incidenciaForm.profile_id,
        action: 'incidencia_creada',
        new_data: { type: incidenciaForm.type, notes: incidenciaForm.notes }
      })

      setShowIncidenciaModal(false)
      setIncidenciaFile(null)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Error al guardar la incidencia")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nóminas y Recursos Humanos</h1>
          <p className="text-slate-500 text-sm mt-1">
            Control de asistencia, incidencias formales y monitoreo de retardos de empleados.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-200">
        <button onClick={() => setActiveTab('asistencia')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'asistencia' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <div className="flex items-center gap-2"><Clock className="w-4 h-4"/> Récord de Asistencia</div>
        </button>
        <button onClick={() => setActiveTab('incidencias')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'incidencias' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Bajas Temporales e Incidencias</div>
        </button>
        {isAdmin && (
          <button onClick={() => setActiveTab('auditoria')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'auditoria' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <div className="flex items-center gap-2"><History className="w-4 h-4"/> Auditoría (Cambios RH)</div>
          </button>
        )}
      </div>

      {/* TABS CONTENT */}
      {activeTab === 'asistencia' && (
        <div className="space-y-6">
          
          <h3 className="font-bold text-lg text-slate-800 mb-2 mt-4">Desempeño Global (Días Asistidos vs Retardos)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map(emp => {
              const empLogs = attendanceLogs.filter(l => l.profile?.id === emp.id || l.profile_id === emp.id)
              const diasAsistidos = new Set(empLogs.map(l => l.log_date)).size
              const retardos = empLogs.filter(l => l.late_minutes > 0).length
              const totalMinsExtra = empLogs.reduce((acc, l) => acc + (l.overtime_minutes || 0), 0)

              return (
                <div key={emp.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <img src={emp.avatar_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full border border-slate-200" alt=""/>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-tight">{emp.full_name}</p>
                      <p className="text-[10px] font-black uppercase text-slate-400">{emp.role} • Ent: {emp.hora_entrada || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="bg-slate-50 border border-slate-100 rounded p-2">
                       <p className="text-[10px] uppercase font-bold text-slate-400">Asistencias</p>
                       <p className="font-bold text-blue-600 text-lg">{diasAsistidos}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded p-2">
                       <p className="text-[10px] uppercase font-bold text-slate-400">Retardos</p>
                       <p className={`font-bold text-lg ${retardos > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{retardos}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded p-2">
                       <p className="text-[10px] uppercase font-bold text-slate-400">Extra (Hrs)</p>
                       <p className="font-bold text-amber-600 text-lg">{(totalMinsExtra/60).toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <h3 className="font-bold text-lg text-slate-800 mb-2 mt-6">Bitácora Detallada de Turnos</h3>
          <div className="bg-white shadow rounded-xl p-0 overflow-hidden border border-slate-200">
           <table className="w-full text-left text-sm text-slate-600">
             <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
               <tr>
                 <th className="px-6 py-4">Empleado</th>
                 <th className="px-6 py-4">Fecha Turno</th>
                 <th className="px-6 py-4">Entrada Real</th>
                 <th className="px-6 py-4">Retardo acumulado</th>
                 <th className="px-6 py-4">Min. Break</th>
                 <th className="px-6 py-4">OT Extra (Salida)</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {attendanceLogs.length === 0 ? (
                 <tr><td colSpan={6} className="text-center py-6 text-slate-400">Sin registros de asistencia recientes.</td></tr>
               ) : (
                 attendanceLogs.map((log) => (
                   <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4 flex items-center gap-3">
                        <img src={log.profile?.avatar_url || 'https://via.placeholder.com/40'} className="w-8 h-8 rounded-full border border-slate-200" alt="Avatar"/>
                        <div>
                          <p className="font-bold text-slate-900">{log.profile?.full_name}</p>
                          <p className="text-[10px] uppercase text-stone-500">{log.profile?.role}</p>
                        </div>
                     </td>
                     <td className="px-6 py-4 font-mono text-xs">{log.log_date}</td>
                     <td className="px-6 py-4">
                        <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-xs font-semibold">
                          {new Date(log.clock_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                     </td>
                     <td className="px-6 py-4">
                        {log.late_minutes > 0 ? (
                          <span className="flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded-md w-max">
                            <AlertTriangle className="w-3 h-3"/> {log.late_minutes} min tarde
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md w-max">
                            <CheckCircle className="w-3 h-3"/> A tiempo
                          </span>
                        )}
                     </td>
                     <td className="px-6 py-4 font-bold text-amber-600">
                        {log.total_break_minutes} min
                     </td>
                     <td className="px-6 py-4 font-bold text-blue-600">
                        {log.overtime_minutes > 0 ? `+${log.overtime_minutes} min extra` : '--'}
                     </td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
          </div>
        </div>
      )}

      {activeTab === 'incidencias' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => setShowIncidenciaModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-sm">
              <Plus className="w-4 h-4"/> Registrar Incidencia / Incapacidad
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timeOffRequests.length === 0 && (
              <div className="col-span-3 text-center py-10 text-slate-400">No hay incidencias registradas.</div>
            )}
            {timeOffRequests.map(req => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 shrink-0 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${req.type === 'incapacidad' ? 'bg-rose-500' : req.type === 'vacaciones' ? 'bg-amber-400' : 'bg-purple-500'}`}/>
                <p className="font-bold text-slate-800 text-sm">{req.profile?.full_name}</p>
                <p className="text-xs font-black uppercase text-slate-400 mb-4">{req.type.replace('_', ' ')}</p>
                
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                  <Calendar className="w-3.5 h-3.5"/>
                  <span className="font-mono">{req.start_date} <span className="text-slate-400">al</span> {req.end_date}</span>
                </div>
                {req.notes && <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">{req.notes}</p>}

                {req.evidence_url && (
                  <a href={req.evidence_url} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold py-2 rounded-lg transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Ver Justificante / Evidencia
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'auditoria' && isAdmin && (
        <div className="bg-white shadow rounded-xl p-6 border border-slate-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4">Auditoría de Supervisores (Últimos Cambios a Nóminas)</h3>
          <ul className="space-y-4">
            {auditLogs.length === 0 && <p className="text-slate-400 text-sm">No hay registros de auditoría.</p>}
            {auditLogs.map(log => (
              <li key={log.id} className="text-sm bg-slate-50 p-4 rounded-lg border border-slate-100 flex gap-4">
                <ShieldAlert className="w-5 h-5 text-slate-400 shrink-0"/>
                <div>
                  <p className="text-slate-500 mb-1 text-xs">{new Date(log.created_at).toLocaleString()}</p>
                  <p className="text-slate-800">
                    El supervisor / admin <span className="font-bold text-blue-700">{log.actor?.full_name}</span> generó la acción <span className="font-mono uppercase bg-slate-200 px-1 py-0.5 rounded text-[10px]">{log.action}</span> hacia el empleado <span className="font-bold text-slate-900">{log.target?.full_name}</span>.
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
        </div>
      )}

      {/* Incidencia Modal */}
      {showIncidenciaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Registrar Faltas o Incidencias</h2>
            <form onSubmit={handleCreateIncidencia} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Empleado Afectado</label>
                <select 
                  required value={incidenciaForm.profile_id} 
                  onChange={e => setIncidenciaForm({...incidenciaForm, profile_id: e.target.value})}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500 font-medium text-slate-800"
                >
                  <option value="">Seleccione empleado...</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Ausencia</label>
                <select 
                  required value={incidenciaForm.type} 
                  onChange={e => setIncidenciaForm({...incidenciaForm, type: e.target.value})}
                  className="w-full border-slate-300 rounded-lg focus:ring-blue-500"
                >
                  <option value="vacaciones">Vacaciones Pre-Aprobadas</option>
                  <option value="permiso_goce">Falta (Permiso CON goce de sueldo)</option>
                  <option value="permiso_sin_goce">Falta Injustificada (Permiso SIN goce)</option>
                  <option value="incapacidad">Incapacidad Médica Segura</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Inicio</label>
                  <input type="date" required value={incidenciaForm.start_date} onChange={e => setIncidenciaForm({...incidenciaForm, start_date: e.target.value})} className="w-full border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Fin</label>
                  <input type="date" required value={incidenciaForm.end_date} onChange={e => setIncidenciaForm({...incidenciaForm, end_date: e.target.value})} className="w-full border-slate-300 rounded-lg" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Evidencia / Justificante Médico (Aplica compresión automática * 1MB MÁX)</label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl px-4 py-6 text-center hover:bg-slate-50 transition-colors">
                  <input 
                    type="file" 
                    id="evi"
                    accept="image/*,.pdf" 
                    className="hidden" 
                    onChange={e => e.target.files && setIncidenciaFile(e.target.files[0])}
                  />
                  <label htmlFor="evi" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-6 h-6 text-blue-500 mb-2"/>
                    <span className="text-sm font-bold text-blue-600">Subir imagen / PDF</span>
                    <span className="text-xs text-slate-500 mt-1">{incidenciaFile ? incidenciaFile.name : 'No file chosen'}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas Opcionales</label>
                <textarea 
                  rows={2} value={incidenciaForm.notes} 
                  onChange={e => setIncidenciaForm({...incidenciaForm, notes: e.target.value})}
                  className="w-full border-slate-300 rounded-lg" 
                  placeholder="Detalles sobre por qué se ausenta..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowIncidenciaModal(false)} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Guardar y Archivar'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
