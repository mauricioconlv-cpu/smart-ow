-- ================================================================
-- Nuevos campos para el formulario completo de captura de servicio
-- Ejecutar en Supabase SQL Editor
-- ================================================================

-- 1. Nuevas columnas en services
ALTER TABLE public.services
  -- Sección: Contacto
  ADD COLUMN IF NOT EXISTS contact_name        text,
  ADD COLUMN IF NOT EXISTS contact_phone       text,
  ADD COLUMN IF NOT EXISTS insurance_contact   text,
  ADD COLUMN IF NOT EXISTS insurance_folio     text,

  -- Sección: Motivo
  ADD COLUMN IF NOT EXISTS service_reason      text,   -- 'siniestro' | 'asistencia'
  ADD COLUMN IF NOT EXISTS assistance_type     text,   -- 'mecanica' | 'electrica'
  ADD COLUMN IF NOT EXISTS assistance_notes    text,

  -- Siniestro specific
  ADD COLUMN IF NOT EXISTS adjuster_present    boolean,
  ADD COLUMN IF NOT EXISTS caused_damage       boolean,
  ADD COLUMN IF NOT EXISTS authority_intervened boolean,
  ADD COLUMN IF NOT EXISTS vehicle_damage_desc text,

  -- Sección: Vehículo
  ADD COLUMN IF NOT EXISTS vehicle_year        integer,
  ADD COLUMN IF NOT EXISTS vehicle_brand       text,
  ADD COLUMN IF NOT EXISTS vehicle_type        text,
  ADD COLUMN IF NOT EXISTS vehicle_plates      text,
  ADD COLUMN IF NOT EXISTS vehicle_color       text,

  -- Sección: Maniobras
  ADD COLUMN IF NOT EXISTS maneuver_neutral    boolean,
  ADD COLUMN IF NOT EXISTS transmission_type   text,   -- 'estandar' | 'automatico'
  ADD COLUMN IF NOT EXISTS wheels_spin         boolean,
  ADD COLUMN IF NOT EXISTS steering_spins      boolean,
  ADD COLUMN IF NOT EXISTS vehicle_at          text,   -- 'calle' | 'garage'
  ADD COLUMN IF NOT EXISTS parking_type        text,   -- 'techado' | 'aire_libre'
  ADD COLUMN IF NOT EXISTS parking_notes       text,

  -- Sección: Ubicación Origen
  ADD COLUMN IF NOT EXISTS origin_state        text,
  ADD COLUMN IF NOT EXISTS origin_municipality text,
  ADD COLUMN IF NOT EXISTS origin_colonia      text,
  ADD COLUMN IF NOT EXISTS origin_street       text,
  ADD COLUMN IF NOT EXISTS origin_cross_streets text,
  ADD COLUMN IF NOT EXISTS origin_references   text,

  -- Sección: Destino
  ADD COLUMN IF NOT EXISTS destination_type    text,   -- 'agencia' | 'taller' | 'domicilio'
  ADD COLUMN IF NOT EXISTS travels_inventory   boolean,
  ADD COLUMN IF NOT EXISTS destination_receiver text,

  -- Sección: Ubicación Destino
  ADD COLUMN IF NOT EXISTS dest_state          text,
  ADD COLUMN IF NOT EXISTS dest_municipality   text,
  ADD COLUMN IF NOT EXISTS dest_colonia        text,
  ADD COLUMN IF NOT EXISTS dest_street         text,
  ADD COLUMN IF NOT EXISTS dest_cross_streets  text,
  ADD COLUMN IF NOT EXISTS dest_references     text;

-- 2. Nuevos estados en el enum service_status
ALTER TYPE service_status ADD VALUE IF NOT EXISTS 'asignando';
ALTER TYPE service_status ADD VALUE IF NOT EXISTS 'cotizacion';
ALTER TYPE service_status ADD VALUE IF NOT EXISTS 'cancelado_cliente';

