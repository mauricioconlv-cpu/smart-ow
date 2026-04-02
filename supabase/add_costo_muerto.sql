-- ══════════════════════════════════════════════════════════════
-- Cancelado Posterior · Costo Muerto
-- ══════════════════════════════════════════════════════════════

-- 1. Configuración de Costo Muerto por cliente/aseguradora
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS costo_muerto_activo    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS costo_muerto_umbral_min INTEGER NOT NULL DEFAULT 15,   -- minutos de gracia
  ADD COLUMN IF NOT EXISTS costo_muerto_pct        NUMERIC(5,2) NOT NULL DEFAULT 25; -- % del costo total

-- 2. Columnas en servicios para rastrear asignación y costo muerto resultante
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS assigned_at  TIMESTAMPTZ,     -- momento exacto en que se asignó operador
  ADD COLUMN IF NOT EXISTS costo_muerto NUMERIC(10,2);    -- costo final del cancelado posterior

-- 3. Refrescar el schema cache de PostgREST
NOTIFY pgrst, 'reload schema';
