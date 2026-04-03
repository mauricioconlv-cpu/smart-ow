-- ============================================================
-- Nuevas columnas de costos médicos en pricing_rules
-- Ejecutar en Supabase Studio → SQL Editor
-- ============================================================

ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS costo_medico_domicilio    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_reparto_medicamento NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_telemedicina        NUMERIC(10,2) NOT NULL DEFAULT 0;
