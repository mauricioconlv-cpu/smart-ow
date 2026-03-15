-- ============================================================
-- BUG FIXES: ejecutar en Supabase SQL Editor
-- 1. Recargar schema cache (fix: tools column not found)
-- 2. Nuevas columnas de costo por tipo de grúa (local, banderazo, km)
-- ============================================================

-- 1. RECARGAR SCHEMA CACHE de PostgREST
--    Esto resuelve el error "Could not find 'tools' column in schema cache"
NOTIFY pgrst, 'reload schema';

-- 2. NUEVAS COLUMNAS: costo local / banderazo / km por tipo de grúa
--    UNA SOLA regla de pricing por cliente (ya no se separa en local/foraneo)
--    Cada tipo de grúa A, B, C, D tiene sus propias tarifas.
ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS costo_local_tipo_a  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_a  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_a     numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_local_tipo_b  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_b  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_b     numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_local_tipo_c  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_c  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_c     numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_local_tipo_d  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_d  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_d     numeric DEFAULT 0;

-- 3. NUEVAS COLUMNAS en services para los campos de la captura
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS contact_name         text,
  ADD COLUMN IF NOT EXISTS contact_phone        text,
  ADD COLUMN IF NOT EXISTS insurance_contact    text,
  ADD COLUMN IF NOT EXISTS insurance_folio      text,
  ADD COLUMN IF NOT EXISTS service_reason       text,
  ADD COLUMN IF NOT EXISTS assistance_type      text,
  ADD COLUMN IF NOT EXISTS assistance_notes     text,
  ADD COLUMN IF NOT EXISTS adjuster_present     boolean,
  ADD COLUMN IF NOT EXISTS caused_damage        boolean,
  ADD COLUMN IF NOT EXISTS authority_intervened boolean,
  ADD COLUMN IF NOT EXISTS vehicle_damage_desc  text,
  ADD COLUMN IF NOT EXISTS vehicle_year         integer,
  ADD COLUMN IF NOT EXISTS vehicle_brand        text,
  ADD COLUMN IF NOT EXISTS vehicle_type         text,
  ADD COLUMN IF NOT EXISTS vehicle_plates       text,
  ADD COLUMN IF NOT EXISTS vehicle_color        text,
  ADD COLUMN IF NOT EXISTS maneuver_neutral     boolean,
  ADD COLUMN IF NOT EXISTS transmission_type    text,
  ADD COLUMN IF NOT EXISTS wheels_spin          boolean,
  ADD COLUMN IF NOT EXISTS steering_spins       boolean,
  ADD COLUMN IF NOT EXISTS vehicle_at           text,
  ADD COLUMN IF NOT EXISTS parking_type         text,
  ADD COLUMN IF NOT EXISTS parking_notes        text,
  ADD COLUMN IF NOT EXISTS origin_state         text,
  ADD COLUMN IF NOT EXISTS origin_municipality  text,
  ADD COLUMN IF NOT EXISTS origin_colonia       text,
  ADD COLUMN IF NOT EXISTS origin_street        text,
  ADD COLUMN IF NOT EXISTS origin_cross_streets text,
  ADD COLUMN IF NOT EXISTS origin_references    text,
  ADD COLUMN IF NOT EXISTS destination_type     text,
  ADD COLUMN IF NOT EXISTS travels_inventory    boolean,
  ADD COLUMN IF NOT EXISTS destination_receiver text,
  ADD COLUMN IF NOT EXISTS dest_state           text,
  ADD COLUMN IF NOT EXISTS dest_municipality    text,
  ADD COLUMN IF NOT EXISTS dest_colonia         text,
  ADD COLUMN IF NOT EXISTS dest_street          text,
  ADD COLUMN IF NOT EXISTS dest_cross_streets   text,
  ADD COLUMN IF NOT EXISTS dest_references      text;

-- Recargar nuevamente al final para asegurar que todos los cambios sean visibles
NOTIFY pgrst, 'reload schema';
