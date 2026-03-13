-- 1. Añadir los nuevos estados a los tipos ENUM existentes 
-- (PostgreSQL requiere bloque DO para capturar duplicados limpiamente si usamos condicionales,
-- pero ADD VALUE IF NOT EXISTS está soportado en Postgres 12+)

ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'en_captura';
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'sin_operador';
-- 'rumbo_contacto' ya existe
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'contactado';
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'comienzo_traslado';
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'destino';
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'terminado';
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'cancelado_momento';
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'cancelado_posterior';

-- 2. Añadir las columnas de tiempo y metadatos a la tabla "services" 
-- Usamos IF NOT EXISTS por si se corre múltiples veces
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS captura_iniciada_at timestamp with time zone default now();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS captura_finalizada_at timestamp with time zone;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS operador_asignado_at timestamp with time zone;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS contacto_at timestamp with time zone;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS traslado_inicio_at timestamp with time zone;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS llegada_destino_at timestamp with time zone;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS fin_servicio_at timestamp with time zone;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS cancelacion_motivo text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS es_foraneo boolean default false;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS ruta_km numeric;

-- Opcional: Para controlar la evidencia bloqueante:
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS foto_contacto_url text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS placas_vehiculo text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS foto_destino_url text;
