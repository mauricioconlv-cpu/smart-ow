import { jsPDF } from 'jspdf'

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
const STEP_ORDER = [
  { key: 'rumbo_contacto',     label: 'En Camino al Origen' },
  { key: 'arribo_origen',      label: 'Llegó al Origen' },
  { key: 'contacto_usuario',   label: 'Contacto con Usuario' },
  { key: 'contacto',           label: 'Maniobra / Enganche' },
  { key: 'inicio_traslado',    label: 'En Traslado al Destino' },
  { key: 'traslado_concluido', label: 'Entregado en Destino' },
  { key: 'servicio_cerrado',   label: 'Servicio Cerrado' },
]

function statusIndex(s: string) {
  return STEP_ORDER.findIndex(x => x.key === s)
}

// ── Helper: draw a section header ─────────────────────────────────────
function sectionHeader(doc: jsPDF, text: string, y: number, pageW: number, mx: number) {
  doc.setFillColor(37, 99, 235)
  doc.rect(mx, y - 4, pageW - mx * 2, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(text.toUpperCase(), mx + 2, y + 0.5)
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'normal')
  return y + 9
}

// ── Helper: draw a row (label + value) ────────────────────────────────
function row(doc: jsPDF, label: string, value: string, y: number, mx: number, pageW: number) {
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text(label + ':', mx, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  // Wrap value if long
  const maxW = pageW - mx - mx - 48
  const lines = doc.splitTextToSize(value || '—', maxW)
  doc.text(lines, mx + 48, y)
  return y + (lines.length > 1 ? lines.length * 5 : 6)
}

export async function generateDescriptiveMemory(
  service: any,
  companyLogoUrl?: string | null,
  companyName?: string | null
) {
  const doc   = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const mx    = 14
  let   y     = mx

  // ── HEADER ────────────────────────────────────────────────────────
  // Blue top bar
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageW, 18, 'F')

  // Logo (try, skip on error — no fetch needed if url is already an image)
  let logoOk = false
  if (companyLogoUrl) {
    try {
      doc.addImage(companyLogoUrl, 'PNG', mx, 2, 0, 14)
      logoOk = true
    } catch {}
    if (!logoOk) {
      try {
        doc.addImage(companyLogoUrl, 'JPEG', mx, 2, 0, 14)
        logoOk = true
      } catch {}
    }
  }

  // Company name / title
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const titleX = logoOk ? mx + 36 : mx
  doc.text(companyName ?? 'Smart Tow', titleX, 8)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('MEMORIA DESCRIPTIVA DE SERVICIO', titleX, 14)

  // Folio badge (top right)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Folio #${service.folio}`, pageW - mx - 24, 11)

  y = 24

  // ── DATOS GENERALES ────────────────────────────────────────────────
  y = sectionHeader(doc, '1. Datos Generales', y, pageW, mx)
  y = row(doc, 'Cliente', (service.clients as any)?.name ?? '—', y, mx, pageW)
  y = row(doc, 'Folio Aseguradora', service.insurance_folio ?? '—', y, mx, pageW)
  y = row(doc, 'Expediente', service.numero_expediente ?? '—', y, mx, pageW)
  y = row(doc, 'Tipo de Servicio', service.tipo_servicio ?? '—', y, mx, pageW)
  y = row(doc, 'Operador Asignado', (service.profiles as any)?.full_name ?? '—', y, mx, pageW)
  y = row(doc, 'Fecha Solicitud', new Date(service.created_at).toLocaleString('es-MX'), y, mx, pageW)
  y = row(doc, 'Fecha Cierre', service.updated_at ? new Date(service.updated_at).toLocaleString('es-MX') : '—', y, mx, pageW)
  y += 4

  // ── TRAYECTO ──────────────────────────────────────────────────────
  y = sectionHeader(doc, '2. Trayecto Realizado', y, pageW, mx)
  const origen  = (service.origen_coords as any)?.address  ?? service.origen_coords  ?? '—'
  const destino = (service.destino_coords as any)?.address ?? service.destino_coords ?? '—'
  y = row(doc, 'Origen', typeof origen  === 'string' ? origen  : JSON.stringify(origen),  y, mx, pageW)
  y = row(doc, 'Destino', typeof destino === 'string' ? destino : JSON.stringify(destino), y, mx, pageW)
  y += 4

  // ── PROGRESO ──────────────────────────────────────────────────────
  y = sectionHeader(doc, '3. Etapas del Servicio', y, pageW, mx)
  const curIdx = statusIndex(service.status)
  STEP_ORDER.forEach((step, i) => {
    const done = curIdx >= 0 && i <= curIdx
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(done ? 22 : 148, done ? 163 : 163, done ? 74 : 184)
    doc.text(done ? '✔' : '○', mx, y)
    doc.setTextColor(15, 23, 42)
    doc.text(step.label, mx + 8, y)
    if (done) {
      doc.setTextColor(22, 163, 74)
      doc.text('Completado', pageW - mx - 22, y)
      doc.setTextColor(15, 23, 42)
    }
    y += 5.5
  })
  y += 4

  // ── FINANCIERO ────────────────────────────────────────────────────
  if (service.costo_calculado) {
    y = sectionHeader(doc, '4. Resumen Financiero', y, pageW, mx)
    y = row(doc, 'Tarifa', service.tipo_servicio === 'local' ? 'Local (Fija)' : 'Foránea (Banderazo + Km)', y, mx, pageW)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 163, 74)
    doc.text(`Total: $${Number(service.costo_calculado).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`, mx, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    y += 9
  }

  // ── ENCUESTA ──────────────────────────────────────────────────────
  y = sectionHeader(doc, '5. Encuesta de Calidad', y, pageW, mx)
  y = row(doc, 'Tipo de Asistencia',    TIPO_LABELS[service.tipo_asistencia] ?? service.tipo_asistencia ?? '—', y, mx, pageW)
  y = row(doc, 'Tiempo de Espera',      ESPERA_LABELS[service.tiempo_espera] ?? service.tiempo_espera ?? '—', y, mx, pageW)
  y = row(doc, 'Atención del Operador', CALIDAD_LABELS[service.calidad_operador] ?? service.calidad_operador ?? '—', y, mx, pageW)
  const stars = service.calidad_estrellas ?? 0
  y = row(doc, 'Calificación',          stars > 0 ? `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} (${stars}/5)` : '—', y, mx, pageW)
  y = row(doc, 'Observaciones',         service.comentarios_calidad ?? '—', y, mx, pageW)
  y = row(doc, 'Nombre del Cliente',    service.nombre_cliente_firma ?? '—', y, mx, pageW)
  y += 4

  // ── FIRMA ─────────────────────────────────────────────────────────
  if (service.firma_url) {
    // New page if not enough space
    if (y > pageH - 60) { doc.addPage(); y = mx }
    y = sectionHeader(doc, '6. Firma de Conformidad', y, pageW, mx)
    try {
      doc.addImage(service.firma_url, 'PNG', mx, y, 70, 35)
      y += 38
    } catch {
      try {
        doc.addImage(service.firma_url, 'JPEG', mx, y, 70, 35)
        y += 38
      } catch {
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text('(Firma no disponible para este expediente)', mx, y + 5)
        y += 12
      }
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(`Firmado por: ${service.nombre_cliente_firma ?? 'Cliente'}`, mx, y)
    y += 6
  }

  // ── FOOTER ────────────────────────────────────────────────────────
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(mx, pageH - 12, pageW - mx, pageH - 12)
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Generado: ${new Date().toLocaleString('es-MX')}  ·  ${companyName ?? 'Smart Tow'}  ·  Documento oficial del servicio`,
    mx, pageH - 7
  )

  // ── SAVE ──────────────────────────────────────────────────────────
  doc.save(`Memoria_Descriptiva_Folio_${service.folio}.pdf`)
}
