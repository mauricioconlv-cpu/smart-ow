-- ============================================================
-- FIX: service_logs — sistema de mensajería operador/despachador
-- Ejecutar en Supabase SQL Editor (es seguro repetir)
-- ============================================================

-- 1. Convertir la columna 'type' de ENUM estricto a TEXT libre
--    El ENUM log_type solo tenía: foto, audio_ptt, gps_hitch, system_note, panic_button
--    Con TEXT podemos agregar cualquier nuevo tipo sin ALTER TYPE cada vez.
ALTER TABLE public.service_logs
  ALTER COLUMN type TYPE TEXT;

-- 2. Eliminar el ENUM log_type (ya no lo necesitamos)
DROP TYPE IF EXISTS log_type;

-- 3. Agregar columnas que faltaban en service_logs
ALTER TABLE public.service_logs
  ADD COLUMN IF NOT EXISTS event_label TEXT,
  ADD COLUMN IF NOT EXISTS actor_role  TEXT;

-- 4. Hacer company_id opcional con default automático desde el servicio vinculado.
--    Esto permite que el código no tenga que enviar company_id explícitamente.
ALTER TABLE public.service_logs
  ALTER COLUMN company_id DROP NOT NULL;

-- 5. Trigger: auto-completar company_id desde services cuando no viene en el INSERT
CREATE OR REPLACE FUNCTION public.auto_fill_service_log_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.services WHERE id = NEW.service_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_log_company ON public.service_logs;
CREATE TRIGGER trg_service_log_company
  BEFORE INSERT ON public.service_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_service_log_company();

-- 6. RLS: asegurar que el operador también puede INSERTAR en service_logs
--    (la política actual solo permite SELECT/INSERT a users de la misma empresa,
--     pero el operador en móvil puede no pasar company_id, el trigger lo llena)
DROP POLICY IF EXISTS "Tenancy policy for service logs" ON public.service_logs;

CREATE POLICY "service_logs_select" ON public.service_logs
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "service_logs_insert" ON public.service_logs
  FOR INSERT WITH CHECK (
    -- El service_id debe pertenecer a la empresa del usuario
    EXISTS (
      SELECT 1 FROM public.services s
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE s.id = service_id AND s.company_id = p.company_id
    )
  );

CREATE POLICY "service_logs_update" ON public.service_logs
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- 7. Habilitar Realtime en service_logs (necesario para notificaciones en vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_logs;

-- 8. Recargar schema cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- 9. Verificar resultado
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'service_logs'
   AND column_name IN ('type', 'event_label', 'actor_role', 'company_id')
 ORDER BY column_name;
