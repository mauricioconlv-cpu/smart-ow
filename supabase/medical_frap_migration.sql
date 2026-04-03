-- ============================================================
-- Extensión de Datos Clínicos (Estilo FRAP / Nota de Evolución)
-- Ejecutar en Supabase Studio -> SQL Editor
-- ============================================================

ALTER TABLE public.medical_services
  ADD COLUMN IF NOT EXISTS patient_age        INTEGER,
  ADD COLUMN IF NOT EXISTS patient_gender     TEXT,
  ADD COLUMN IF NOT EXISTS patient_occupation TEXT,
  
  ADD COLUMN IF NOT EXISTS patient_weight     NUMERIC,
  ADD COLUMN IF NOT EXISTS patient_height     NUMERIC,
  
  ADD COLUMN IF NOT EXISTS anamnesis          TEXT,
  ADD COLUMN IF NOT EXISTS exploracion_fisica TEXT,
  
  ADD COLUMN IF NOT EXISTS firma_medico_url   TEXT;
