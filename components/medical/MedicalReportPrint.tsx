'use client'

import { useEffect } from 'react'

export function MedicalReportPrint({ service }: { service: any }) {
  useEffect(() => {
    // Auto print when component loads
    setTimeout(() => {
      window.print()
    }, 500)
  }, [])

  if (!service) return null

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:m-0 print:w-full">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-emerald-600 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-emerald-800">SMART TOW</h1>
          <p className="text-sm text-slate-500 uppercase tracking-widest mt-1">Reporte Médico y Nota de Evolución</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-xl">{service.folio_prefix}-{String(service.folio).padStart(4, '0')}</p>
          <p className="text-sm text-slate-500 mt-1">
            Fecha: {new Date(service.closed_at || service.created_at).toLocaleDateString('es-MX')}
          </p>
        </div>
      </div>

      {/* Datos del Paciente */}
      <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 print:bg-slate-100 font-bold text-slate-700">
          DATOS DEL PACIENTE
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
          <div><span className="text-slate-500 block text-xs">Nombre</span><span className="font-medium">{service.patient_name}</span></div>
          <div><span className="text-slate-500 block text-xs">Edad</span><span className="font-medium">{service.patient_age ? `${service.patient_age} años` : '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">Género</span><span className="font-medium">{service.patient_gender === 'M' ? 'Masculino' : service.patient_gender === 'F' ? 'Femenino' : service.patient_gender || '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">Ocupación</span><span className="font-medium">{service.patient_occupation || '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">Teléfono</span><span className="font-medium">{service.patient_phone || '--'}</span></div>
          {service.numero_expediente && <div><span className="text-slate-500 block text-xs">Expediente</span><span className="font-medium">{service.numero_expediente}</span></div>}
          <div className="col-span-full"><span className="text-slate-500 block text-xs">Dirección</span><span className="font-medium">{service.patient_address || '--'}</span></div>
        </div>
      </div>

      {/* Clínico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">Motivo de Consulta (Anamnesis)</h3>
          <p className="text-sm whitespace-pre-wrap">{service.anamnesis || service.symptoms || 'Sin registro'}</p>
        </div>
        <div>
          <h3 className="font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">Exploración Física</h3>
          <p className="text-sm whitespace-pre-wrap">{service.exploracion_fisica || 'Sin registro'}</p>
        </div>
      </div>

      {/* Vitals */}
      <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 print:bg-slate-100 font-bold text-slate-700 flex justify-between">
          <span>SIGNOS VITALES Y ANTROPOMETRÍA</span>
        </div>
        <div className="p-4 flex flex-wrap gap-6 text-sm">
          <div><span className="text-slate-500 block text-xs">T/A</span><span className="font-medium">{service.signos_vitales?.presion || '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">FC</span><span className="font-medium">{service.signos_vitales?.pulso ? `${service.signos_vitales.pulso} lpm` : '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">FR</span><span className="font-medium">{service.signos_vitales?.frecResp ? `${service.signos_vitales.frecResp} rpm` : '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">Temp</span><span className="font-medium">{service.signos_vitales?.temperatura ? `${service.signos_vitales.temperatura} °C` : '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">SpO2</span><span className="font-medium">{service.signos_vitales?.spO2 ? `${service.signos_vitales.spO2} %` : '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">Glucosa</span><span className="font-medium">{service.signos_vitales?.glucosa || '--'}</span></div>
          <div className="w-px bg-slate-200 mx-2 hidden md:block"></div>
          <div><span className="text-slate-500 block text-xs">Peso</span><span className="font-medium">{service.patient_weight ? `${service.patient_weight} kg` : '--'}</span></div>
          <div><span className="text-slate-500 block text-xs">Talla</span><span className="font-medium">{service.patient_height ? `${service.patient_height} m` : '--'}</span></div>
        </div>
      </div>

      {/* Diagnostico y Receta */}
      <div className="mb-6 space-y-4">
        <div>
          <h3 className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-1">Diagnóstico</h3>
          <p className="text-sm whitespace-pre-wrap">{service.diagnostico || 'Sin registro'}</p>
        </div>
        <div>
          <h3 className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-1">Tratamiento Indicado</h3>
          <p className="text-sm whitespace-pre-wrap">{service.tratamiento || 'Sin registro'}</p>
        </div>
        <div>
          <h3 className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-1">Medicamento Recetado</h3>
          <p className="text-sm whitespace-pre-wrap">{service.medicamento_recetado || 'Sin registro'}</p>
        </div>
        {service.notas_medico && (
          <div>
            <h3 className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-1">Observaciones / Pronóstico</h3>
            <p className="text-sm whitespace-pre-wrap">{service.notas_medico}</p>
          </div>
        )}
      </div>

      {/* Firmas */}
      <div className="mt-12 flex justify-around items-end text-center">
        <div className="w-64">
          {service.firma_medico_url ? (
            <img src={service.firma_medico_url} alt="Firma Médico" className="mx-auto h-20 object-contain mb-2 mix-blend-multiply" />
          ) : (
            <div className="h-20 mb-2"></div>
          )}
          <div className="border-t border-slate-400 pt-2 font-medium text-sm">
            Dr(a). {service.doctor?.full_name || '______________'}
            {service.doctor?.cedula && <br/>}
            {service.doctor?.cedula && <span className="text-xs text-slate-500">Cédula: {service.doctor.cedula}</span>}
          </div>
        </div>
        <div className="w-64">
          {service.firma_paciente_url ? (
            <img src={service.firma_paciente_url} alt="Firma Paciente" className="mx-auto h-20 object-contain mb-2 mix-blend-multiply" />
          ) : (
            <div className="h-20 mb-2"></div>
          )}
          <div className="border-t border-slate-400 pt-2 font-medium text-sm">
            Paciente / Responsable
          </div>
        </div>
      </div>
      
      <div className="mt-10 text-center text-xs text-slate-400 print:mt-16">
        Documento generado electrónicamente por Smart Tow.
      </div>
    </div>
  )
}
