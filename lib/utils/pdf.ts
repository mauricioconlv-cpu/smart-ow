import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// Helper: load image from URL as base64 for jsPDF
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

const TIPO_LABELS: Record<string, string> = {
  grua:      'Grúa',
  corriente: 'Paso de Corriente',
  llanta:    'Cambio de Llanta',
  gasolina:  'Suministro de Gasolina',
}
const ESPERA_LABELS: Record<string, string> = {
  '0-45':   '0 – 45 minutos',
  '45-60':  '45 – 60 minutos',
  'mas-60': 'Más de 60 minutos',
}
const CALIDAD_LABELS: Record<string, string> = {
  excelente: 'Excelente',
  buena:     'Buena',
  regular:   'Regular',
  mala:      'Mala',
}

export async function generateDescriptiveMemory(
  service: any,
  companyLogoUrl?: string | null,
  companyName?: string | null
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  // ── LOGO + HEADER ──────────────────────────────────────────────────────
  // Load logo
  const logoB64 = companyLogoUrl ? await loadImageAsBase64(companyLogoUrl) : null

  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', margin, y, 36, 18, undefined, 'FAST') } catch {}
    // Company name next to logo
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(companyName ?? '', margin + 40, y + 8)
    doc.setFont('helvetica', 'normal')
    y += 24
  } else {
    // Text header fallback
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(37, 99, 235)
    doc.text(companyName ?? 'Smart Tow', margin, y + 6)
    y += 12
  }

  // Top rule
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  // Title
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('MEMORIA DESCRIPTIVA DE SERVICIO', margin, y)
  y += 3

  // Sub-rule
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // ── DATOS DEL SERVICIO ────────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('DATOS GENERALES', margin, y); y += 5

  const generalData = [
    ['Folio del Servicio',     `#${service.folio}`],
    ['Cliente / Aseguradora',  service.clients?.name ?? 'N/A'],
    ['Folio Aseguradora',      service.insurance_folio ?? '—'],
    ['Tipo de Servicio',       service.tipo_servicio ?? '—'],
    ['Fecha de Solicitud',     new Date(service.created_at).toLocaleString('es-MX')],
    ['Fecha de Cierre',        service.updated_at ? new Date(service.updated_at).toLocaleString('es-MX') : '—'],
  ]

  ;(doc as any).autoTable({
    startY: y,
    head: [],
    body: generalData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, textColor: [71, 85, 105] },
      1: { cellWidth: 110 },
    },
    margin: { left: margin, right: margin },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // ── VEHÍCULO ──────────────────────────────────────────────────────────
  const vehicle = [service.marca_vehiculo, service.modelo_vehiculo, service.anio_vehiculo].filter(Boolean).join(' ')
  if (vehicle || service.placas_vehiculo || service.color_vehiculo) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(10)
    doc.text('VEHÍCULO ASISTIDO', margin, y); y += 5

    const vehicleData = [
      ['Vehículo',  vehicle || '—'],
      ['Placas',    service.placas_vehiculo ?? '—'],
      ['Color',     service.color_vehiculo ?? '—'],
    ]
    ;(doc as any).autoTable({
      startY: y, head: [], body: vehicleData, theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 41, 59] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: [71, 85, 105] }, 1: { cellWidth: 110 } },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  }

  // ── TRAYECTO ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.text('TRAYECTO REALIZADO', margin, y); y += 5

  const routeData = [
    ['Origen',    service.origen_address || service.origen_coords?.address || 'Sin registrar'],
    ['Destino',   service.destino_address || service.destino_coords?.address || 'Sin registrar'],
    ['Distancia', service.distancia_km != null ? `${service.distancia_km} km` : '—'],
  ]
  ;(doc as any).autoTable({
    startY: y, head: [], body: routeData, theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: [71, 85, 105] }, 1: { cellWidth: 110 } },
    margin: { left: margin, right: margin },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // ── PROGRESO DEL SERVICIO ─────────────────────────────────────────────
  const stepLabels: Record<string, string> = {
    rumbo_contacto:     '🚛 En Camino al Origen',
    arribo_origen:      '📍 Llegó al Origen',
    contacto_usuario:   '🤝 Contacto con Usuario',
    contacto:           '🔗 Maniobra / Enganche',
    inicio_traslado:    '🏎️ En Traslado al Destino',
    traslado_concluido: '🏁 Entregado en Destino',
    servicio_cerrado:   '✅ Servicio Cerrado',
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.text('PROGRESO DEL SERVICIO', margin, y); y += 5

  const stepRows = Object.entries(stepLabels).map(([key, label]) => {
    const reached = isStatusReached(service.status, key)
    return [reached ? '✔' : '○', label, reached ? 'Completado' : 'Pendiente']
  })

  ;(doc as any).autoTable({
    startY: y,
    head: [['', 'Etapa', 'Estado']],
    body: stepRows,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 100 }, 2: { cellWidth: 40 } },
    margin: { left: margin, right: margin },
    didDrawCell: (data: any) => {
      if (data.column.index === 2 && data.cell.raw === 'Completado') {
        doc.setTextColor(22, 163, 74)
      }
    },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // ── ECONÓMICO ─────────────────────────────────────────────────────────
  if (service.costo_calculado) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(10)
    doc.text('RESUMEN FINANCIERO', margin, y); y += 5

    const finData = [
      ['Tipo de tarifa', service.tipo_servicio === 'local' ? 'Local (Fija)' : 'Foránea (Banderazo + Km)'],
      ['Total a Facturar', `$${Number(service.costo_calculado).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`],
    ]
    ;(doc as any).autoTable({
      startY: y, head: [], body: finData, theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 41, 59] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: [71, 85, 105] }, 1: { cellWidth: 110 } },
      margin: { left: margin, right: margin },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  }

  // ── ENCUESTA DE CALIDAD ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.text('ENCUESTA DE CALIDAD', margin, y); y += 5

  const qualityData: [string, string][] = [
    ['Tipo de Asistencia',       TIPO_LABELS[service.tipo_asistencia]   ?? service.tipo_asistencia   ?? '—'],
    ['Tiempo de Espera',         ESPERA_LABELS[service.tiempo_espera]   ?? service.tiempo_espera     ?? '—'],
    ['Atención del Operador',    CALIDAD_LABELS[service.calidad_operador] ?? service.calidad_operador ?? '—'],
    ['Calificación (estrellas)', service.calidad_estrellas ? `${'★'.repeat(service.calidad_estrellas)}${'☆'.repeat(5 - service.calidad_estrellas)} (${service.calidad_estrellas}/5)` : '—'],
    ['Observaciones',            service.comentarios_calidad || '—'],
    ['Nombre del Cliente',       service.nombre_cliente_firma || '—'],
  ]
  ;(doc as any).autoTable({
    startY: y, head: [], body: qualityData, theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: [71, 85, 105] }, 1: { cellWidth: 110 } },
    margin: { left: margin, right: margin },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  // ── FIRMA ─────────────────────────────────────────────────────────────
  if (service.firma_url) {
    // Check if new page needed
    if (y > 220) { doc.addPage(); y = margin }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(10)
    doc.text('FIRMA DE CONFORMIDAD', margin, y); y += 4

    const firmaB64 = await loadImageAsBase64(service.firma_url)
    if (firmaB64) {
      try { doc.addImage(firmaB64, 'PNG', margin, y, 70, 35, undefined, 'FAST') } catch {}
    } else {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text('(Firma no disponible)', margin, y + 10)
    }

    // Signature line label
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Firmado por: ${service.nombre_cliente_firma ?? 'Cliente'}`, margin, y + 40)
    y += 48
  }

  // ── FOOTER ────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, pageH - 18, pageW - margin, pageH - 18)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Generado el ${new Date().toLocaleString('es-MX')} · ${companyName ?? 'Smart Tow'} · Documento oficial del servicio`,
    margin, pageH - 12
  )

  doc.save(`Memoria_Descriptiva_Folio_${service.folio}.pdf`)
}

// Helper: check if a status has been reached in the flow
function isStatusReached(currentStatus: string, targetStatus: string): boolean {
  const ORDER = [
    'rumbo_contacto', 'arribo_origen', 'contacto_usuario',
    'contacto', 'inicio_traslado', 'traslado_concluido', 'servicio_cerrado',
  ]
  const curr = ORDER.indexOf(currentStatus)
  const tgt  = ORDER.indexOf(targetStatus)
  return curr >= 0 && tgt >= 0 && curr >= tgt
}
