'use client'

import { FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function ExportExcelButton({ data }: { data: any[] }) {
  
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert("No hay datos para exportar")
      return
    }

    const formatTime = (isoString?: string) => {
      if (!isoString) return ''
      return new Date(isoString).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (isoString?: string) => {
      if (!isoString) return ''
      return new Date(isoString).toLocaleDateString('es-MX')
    }

    // Aplanar y formatear la data para el Excel según encabezados solicitados
    const formattedData = data.map(svc => ({
      'Folio': svc.folio || '',
      'Fecha': formatDate(svc.created_at),
      'Hora de captura': formatTime(svc.captura_iniciada_at || svc.created_at),
      'cliente': svc.clients?.name || 'N/A',
      'Folio/exp aseguradora': svc.numero_expediente || svc.insurance_folio || '',
      'Vehiculo': [svc.vehicle_brand, svc.vehicle_type, svc.vehicle_color, svc.vehicle_plates, svc.vehicle_year].filter(Boolean).join(' ') || 'N/A',
      'modelo': svc.vehicle_year || '',
      'coord origen': svc.origen_coords?.address || '',
      'coord destino': svc.destino_coords?.address || '',
      'local/foraneo': svc.tipo_servicio === 'foraneo' || svc.es_foraneo ? 'FORANEO' : 'LOCAL',
      'operador': svc.profiles?.full_name || 'Sin Asignar',
      'Grua asignada': svc.profiles?.grua_asignada || 'N/A',
      'coord grua': 'N/A (Tracking en vivo)', 
      'hora de asignacion': formatTime(svc.operador_asignado_at),
      'hora de arribo': formatTime(svc.contacto_at), // Se asume contacto en origen
      'hora de contacto': formatTime(svc.contacto_at),
      'hora de termino': formatTime(svc.fin_servicio_at || svc.updated_at),
      'costo': Number(svc.costo_calculado) || 0,
      
      // -- Columnas extras para ayudar al análisis en volumen --
      'Estado Final': svc.status,
      'Distancia (KM)': svc.ruta_km || svc.distancia_km || 0,
      'Motivo de Servicio': svc.service_reason || '',
      'Tipo de Asistencia': svc.assistance_type || '',
      'Calidad Estrellas': svc.calidad_estrellas || 'Sin calificar',
      'Comentarios de Calidad': svc.comentarios_calidad || '',
      'Motivo de Cancelacion': svc.cancelacion_motivo || ''
    }))

    // Crear libro de trabajo
    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Servicios")

    // Descargar
    XLSX.writeFile(workbook, `Reporte_SmartTow_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <button 
      onClick={handleExport}
      className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
    >
      <FileDown className="h-5 w-5" />
      <span>Exportar a Excel</span>
    </button>
  )
}
