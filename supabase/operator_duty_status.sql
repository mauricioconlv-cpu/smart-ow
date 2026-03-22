-- ============================================================
-- Sincronización de estado de turno del operador
-- (break, pausa, activo) + logs para nóminas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar duty_status y duty_status_since a profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS duty_status       TEXT    DEFAULT 'offline' CHECK (duty_status IN ('active','break','pause','offline')),
  ADD COLUMN IF NOT EXISTS duty_status_since TIMESTAMPTZ;

-- 2. Tabla de eventos de turno (para nóminas y auditoría)
CREATE TABLE IF NOT EXISTS public.operator_shift_events (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id   UUID        REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  operator_id  UUID        REFERENCES public.profiles(id)  ON DELETE CASCADE NOT NULL,
  event_type   TEXT        NOT NULL CHECK (event_type IN (
                             'shift_start','shift_end',
                             'break_start','break_end',
                             'pause_start','pause_end'
                           )),
  started_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ended_at     TIMESTAMPTZ,
  duration_seconds INTEGER -- se llena al cerrar el evento (ended_at - started_at)
);

ALTER TABLE public.operator_shift_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ose_select" ON public.operator_shift_events
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "ose_insert" ON public.operator_shift_events
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR operator_id = auth.uid()
  );

CREATE POLICY "ose_update" ON public.operator_shift_events
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR operator_id = auth.uid()
  );

-- 3. Habilitar Realtime en profiles (para que el monitor se actualice en vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- 4. Habilitar Realtime en operator_shift_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_shift_events;

-- 5. RPC: set_duty_status
--    Actualiza el perfil del operador y registra el evento de turno
CREATE OR REPLACE FUNCTION public.set_operator_duty_status(
  p_status TEXT  -- 'active' | 'break' | 'pause' | 'offline'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op_id      UUID;
  v_company_id UUID;
  v_old_status TEXT;
  v_since      TIMESTAMPTZ;
  v_event_type TEXT;
  v_duration   INTEGER;
BEGIN
  v_op_id := auth.uid();

  SELECT company_id, duty_status, duty_status_since
    INTO v_company_id, v_old_status, v_since
    FROM public.profiles WHERE id = v_op_id;

  -- Calcular duración del estado anterior
  IF v_since IS NOT NULL AND v_old_status IS NOT NULL AND v_old_status != p_status THEN
    v_duration := EXTRACT(EPOCH FROM (NOW() - v_since))::INTEGER;

    -- Cerrar el evento anterior
    UPDATE public.operator_shift_events
       SET ended_at = NOW(), duration_seconds = v_duration
     WHERE operator_id = v_op_id AND ended_at IS NULL
       AND event_type IN ('break_start','pause_start','shift_start');
  END IF;

  -- Determinar qué evento abrir ahora
  v_event_type := CASE p_status
    WHEN 'active'  THEN 'shift_start'
    WHEN 'break'   THEN 'break_start'
    WHEN 'pause'   THEN 'pause_start'
    WHEN 'offline' THEN 'shift_end'
    ELSE NULL
  END;

  -- Abrir nuevo evento
  IF v_event_type IS NOT NULL AND p_status != 'offline' THEN
    INSERT INTO public.operator_shift_events (company_id, operator_id, event_type)
    VALUES (v_company_id, v_op_id, v_event_type);
  END IF;

  -- Actualizar perfil
  UPDATE public.profiles
     SET duty_status       = p_status,
         duty_status_since = NOW()
   WHERE id = v_op_id;

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

-- 6. Recargar schema cache
NOTIFY pgrst, 'reload schema';

-- 7. Verificar columnas agregadas
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'profiles'
   AND column_name IN ('duty_status','duty_status_since')
 ORDER BY column_name;
