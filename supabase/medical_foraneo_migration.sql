-- ============================================================
-- Soporte para cobro Foráneo en Servicios Médicos
-- Ejecutar en Supabase Studio -> SQL Editor
-- ============================================================

-- 1. Renombrar columnas existentes a formato "local"
ALTER TABLE public.pricing_rules
  RENAME COLUMN costo_medico_domicilio TO costo_local_tipo_medico_domicilio;
  
ALTER TABLE public.pricing_rules
  RENAME COLUMN costo_reparto_medicamento TO costo_local_tipo_reparto_medicamento;

ALTER TABLE public.pricing_rules
  RENAME COLUMN costo_telemedicina TO costo_local_tipo_telemedicina;

-- 2. Añadir columnas para Banderazo y Kilometraje foráneo
ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_medico_domicilio NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_medico_domicilio    NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_reparto_medicamento NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_reparto_medicamento    NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_telemedicina NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_telemedicina    NUMERIC(10,2) NOT NULL DEFAULT 0;
