-- ============================================================
-- EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- Agrega las columnas que faltan en la base de datos
-- Es seguro ejecutarlo varias veces (IF NOT EXISTS en todo)
-- ============================================================

-- 1. GRÚAS: columnas de tipo de unidad y herramientas
ALTER TABLE public.tow_trucks
  ADD COLUMN IF NOT EXISTS unit_type TEXT CHECK (unit_type IN ('A','B','C','D')),
  ADD COLUMN IF NOT EXISTS tools     TEXT[] DEFAULT '{}';

-- 2. TARIFAS: columnas de costo por tipo de grúa (local, banderazo, km)
--    NOTA: el SQL anterior agrego costo_tipo_a/b/c/d (un solo costo por tipo)
--    ahora necesitamos 3 costos separados por tipo (local, banderazo, km)
ALTER TABLE public.pricing_rules
  -- Tipo A
  ADD COLUMN IF NOT EXISTS costo_local_tipo_a  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_a  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_a     NUMERIC DEFAULT 0,
  -- Tipo B
  ADD COLUMN IF NOT EXISTS costo_local_tipo_b  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_b  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_b     NUMERIC DEFAULT 0,
  -- Tipo C
  ADD COLUMN IF NOT EXISTS costo_local_tipo_c  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_c  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_c     NUMERIC DEFAULT 0,
  -- Tipo D
  ADD COLUMN IF NOT EXISTS costo_local_tipo_d  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_bande_tipo_d  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_km_tipo_d     NUMERIC DEFAULT 0,
  -- Costos adicionales genéricos (ya deberían existir del SQL anterior)
  ADD COLUMN IF NOT EXISTS costo_maniobra            NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_hora_espera         NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_abanderamiento      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_resguardo           NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_dollys              NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_patines             NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_go_jacks            NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_rescate_subterraneo NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_adaptacion          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_1          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_2          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_3          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_4          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_5          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_6          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_7          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_kg_carga            NUMERIC DEFAULT 0;

-- 3. SERVICIOS: columnas de captura de servicio (formulario)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS contact_name         TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone        TEXT,
  ADD COLUMN IF NOT EXISTS insurance_contact    TEXT,
  ADD COLUMN IF NOT EXISTS insurance_folio      TEXT,
  ADD COLUMN IF NOT EXISTS service_reason       TEXT,
  ADD COLUMN IF NOT EXISTS assistance_type      TEXT,
  ADD COLUMN IF NOT EXISTS assistance_notes     TEXT,
  ADD COLUMN IF NOT EXISTS adjuster_present     BOOLEAN,
  ADD COLUMN IF NOT EXISTS caused_damage        BOOLEAN,
  ADD COLUMN IF NOT EXISTS authority_intervened BOOLEAN,
  ADD COLUMN IF NOT EXISTS vehicle_damage_desc  TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_year         INTEGER,
  ADD COLUMN IF NOT EXISTS vehicle_brand        TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_plates       TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_color        TEXT,
  ADD COLUMN IF NOT EXISTS maneuver_neutral     BOOLEAN,
  ADD COLUMN IF NOT EXISTS transmission_type    TEXT,
  ADD COLUMN IF NOT EXISTS wheels_spin          BOOLEAN,
  ADD COLUMN IF NOT EXISTS steering_spins       BOOLEAN,
  ADD COLUMN IF NOT EXISTS vehicle_at           TEXT,
  ADD COLUMN IF NOT EXISTS parking_type         TEXT,
  ADD COLUMN IF NOT EXISTS parking_notes        TEXT,
  ADD COLUMN IF NOT EXISTS origin_state         TEXT,
  ADD COLUMN IF NOT EXISTS origin_municipality  TEXT,
  ADD COLUMN IF NOT EXISTS origin_colonia       TEXT,
  ADD COLUMN IF NOT EXISTS origin_street        TEXT,
  ADD COLUMN IF NOT EXISTS origin_cross_streets TEXT,
  ADD COLUMN IF NOT EXISTS origin_references    TEXT,
  ADD COLUMN IF NOT EXISTS destination_type     TEXT,
  ADD COLUMN IF NOT EXISTS travels_inventory    BOOLEAN,
  ADD COLUMN IF NOT EXISTS destination_receiver TEXT,
  ADD COLUMN IF NOT EXISTS dest_state           TEXT,
  ADD COLUMN IF NOT EXISTS dest_municipality    TEXT,
  ADD COLUMN IF NOT EXISTS dest_colonia         TEXT,
  ADD COLUMN IF NOT EXISTS dest_street          TEXT,
  ADD COLUMN IF NOT EXISTS dest_cross_streets   TEXT,
  ADD COLUMN IF NOT EXISTS dest_references      TEXT;

-- 4. RECARGAR SCHEMA CACHE de PostgREST
NOTIFY pgrst, 'reload schema';
