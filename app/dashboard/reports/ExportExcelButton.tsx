'use client'

import { FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function ExportExcelButton({ data }: { data: any[] }) {
  
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert("No hay datos para exportar")
      return
    }

    // Aplanar y formatear la data para el Excel
    const formattedData = data.map(svc => ({
      Folio: svc.folio,
      Fecha_Cierre: new Date(svc.updated_at).toLocaleDateString(),
      Cliente: svc.clients?.name || 'N/A',
      Operador: svc.profiles?.full_name || 'N/A',
      Tipo_Tarifa: svc.tipo_servicio,
      Estado: svc.status,
      Monto_MXN: Number(svc.costo_calculado) || 0,
      Calidad_Estrellas: svc.calidad_estrellas || 'Sin calificar',
      Comentarios: svc.comentarios_calidad || '',
      Origen: svc.origen_coords?.address || '',
      Destino: svc.destino_coords?.address || ''
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
