-- ============================================================
-- Segmentación Regional del Directorio Médico
-- Ejecutar en Supabase Studio -> SQL Editor
-- ============================================================

ALTER TABLE public.medical_providers
  ADD COLUMN IF NOT EXISTS state        TEXT,
  ADD COLUMN IF NOT EXISTS municipality TEXT;
