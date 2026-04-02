-- ══════════════════════════════════════════════════════════════
-- ÍNDICES DE PERFORMANCE — SmartTow
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── Servicios (tabla más crítica) ────────────────────────────
-- Consultas por empresa + estatus (Monitor en Vivo, listado de servicios)
CREATE INDEX IF NOT EXISTS idx_services_company_status
  ON services(company_id, status);

-- Consultas por operador (vista del operador en app móvil)
CREATE INDEX IF NOT EXISTS idx_services_operator_status
  ON services(operator_id, status) WHERE operator_id IS NOT NULL;

-- Consultas por cliente (reportes, historial)
CREATE INDEX IF NOT EXISTS idx_services_client_id
  ON services(client_id) WHERE client_id IS NOT NULL;

-- Ordenado por fecha (listados más recientes primero)
CREATE INDEX IF NOT EXISTS idx_services_created_at
  ON services(company_id, created_at DESC);

-- Grúas activas por empresa (filtrado de grúas ocupadas al crear servicio)
CREATE INDEX IF NOT EXISTS idx_services_active_tow_truck
  ON services(company_id, tow_truck_id, status)
  WHERE tow_truck_id IS NOT NULL;

-- ── Bitácora (service_logs) ───────────────────────────────────
-- Carga de bitácora en capturas y tracking
CREATE INDEX IF NOT EXISTS idx_service_logs_service_id
  ON service_logs(service_id, created_at DESC);

-- ── Profiles / Operadores ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_company_role
  ON profiles(company_id, role);

CREATE INDEX IF NOT EXISTS idx_profiles_tow_truck_id
  ON profiles(tow_truck_id) WHERE tow_truck_id IS NOT NULL;

-- ── Grúas ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tow_trucks_company_active
  ON tow_trucks(company_id, is_active);

-- ── Inventario ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_service_id
  ON inventory_items(service_id) WHERE service_id IS NOT NULL;

-- ── Pricing Rules ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pricing_rules_client_id
  ON pricing_rules(client_id);

-- ── Asistencia / Nómina ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_operator_date
  ON attendance_records(operator_id, date DESC);

-- Notificar al query planner que actualice estadísticas
ANALYZE services;
ANALYZE service_logs;
ANALYZE profiles;
ANALYZE tow_trucks;
