-- ============================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Agrega columnas y tipos para el flujo de expediente + bitácora
-- ============================================================

-- 1. Motivo de desbloqueo en servicios
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS edit_reason TEXT;

-- 2. Nuevos tipos de log para la bitácora
ALTER TYPE public.log_type ADD VALUE IF NOT EXISTS 'edit_unlock';
ALTER TYPE public.log_type ADD VALUE IF NOT EXISTS 'status_change';
ALTER TYPE public.log_type ADD VALUE IF NOT EXISTS 'assignment';
ALTER TYPE public.log_type ADD VALUE IF NOT EXISTS 'manual_note';

-- 3. Rol del actor que creó el log (dispatcher / operator / system)
ALTER TABLE public.service_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;

-- 4. Nota legible del evento (además del campo note genérico)
ALTER TABLE public.service_logs ADD COLUMN IF NOT EXISTS event_label TEXT;

-- 5. Recargar schema cache
NOTIFY pgrst, 'reload schema';
