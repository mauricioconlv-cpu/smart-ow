import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export async function generateDescriptiveMemory(service: any) {
  const doc = new jsPDF()

  // --- Header ---
  doc.setFontSize(22)
  doc.setTextColor(37, 99, 235) // Blue-600
  doc.text('Smart Tow', 14, 20)
  
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text('MEMORIA DESCRIPTIVA DE SERVICIO', 14, 30)

  // --- Datos Generales ---
  doc.setFontSize(10)
  doc.text(`Folio del Servicio: #${service.folio}`, 14, 45)
  doc.text(`Cliente / Aseguradora: ${service.clients?.name || 'N/A'}`, 14, 52)
  doc.text(`Fecha Solicitud: ${new Date(service.created_at).toLocaleString()}`, 14, 59)
  if (service.operator_id) {
    doc.text(`Operador Asignado: ${service.profiles?.full_name} (${service.profiles?.grua_asignada})`, 14, 66)
  }

  // --- Ubicaciones ---
  doc.setFontSize(12)
  doc.setTextColor(100, 100, 100)
  doc.text('Trayecto Realizado:', 14, 80)
  
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(`Origen: ${service.origen_coords?.address || 'Sin registrar'}`, 14, 87)
  doc.text(`Destino: ${service.destino_coords?.address || 'Sin registrar'}`, 14, 94)

  // --- Cotización ---
  let finalY = 110
  if (service.costo_calculado) {
    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    doc.text('Resumen Financiero:', 14, finalY)
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    finalY += 7
    doc.text(`Tipo de Tarifa: ${service.tipo_servicio === 'local' ? 'Local (Fija)' : 'Foránea (Banderazo + Km)'}`, 14, finalY)
    finalY += 7
    doc.setFont('', 'bold')
    doc.text(`Total a Facturar: $${Number(service.costo_calculado).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`, 14, finalY)
    doc.setFont('', 'normal')
  }

  // --- Cierre y Calidad ---
  finalY += 20
  doc.setFontSize(12)
  doc.setTextColor(100, 100, 100)
  doc.text('Cierre de Servicio:', 14, finalY)
  
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  finalY += 7
  doc.text(`Calidad Otorgada: ${service.calidad_estrellas ? `${service.calidad_estrellas} Estrellas` : 'No calificado'}`, 14, finalY)
  if (service.comentarios_calidad) {
    finalY += 7
    doc.text(`Comentarios: ${service.comentarios_calidad}`, 14, finalY)
  }

  // --- Firma ---
  if (service.firma_url) {
     finalY += 20
     doc.text('Firma de Conformidad del Cliente:', 14, finalY)
     finalY += 5
     
     try {
       // Insertar imagen de la firma desde Supabase Storage
       // Para PDFs en frontend es mejor tener la b64, pero jsPDF soporta URLs limpias si no hay CORS agresivo
       doc.addImage(service.firma_url, 'PNG', 14, finalY, 80, 40)
     } catch(e) {
       doc.text('(No se pudo renderizar la imagen de la firma)', 14, finalY + 10)
     }
  }

  // Guardar y descargar
  doc.save(`Memoria_Descriptiva_Folio_${service.folio}.pdf`)
}
