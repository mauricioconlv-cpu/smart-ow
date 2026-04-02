-- ============================================================
-- TRIGGER: Auto-registrar asistencia cuando operador vincula grúa
-- Funciona desde cualquier app (web, APK, API) sin necesitar cambios de código
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_auto_attendance_on_truck_link()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today       DATE;
  v_hour_in     INTEGER;
  v_min_in      INTEGER;
  v_expected_h  INTEGER;
  v_expected_m  INTEGER;
  v_late_mins   INTEGER := 0;
BEGIN
  -- Solo aplica a operadores y despachadores (no admin)
  IF NEW.role NOT IN ('operator', 'dispatcher') THEN
    RETURN NEW;
  END IF;

  -- Vinculando grúa: tow_truck_id pasó de NULL → valor
  IF (OLD.tow_truck_id IS NULL AND NEW.tow_truck_id IS NOT NULL) THEN

    -- Fecha local México
    v_today := (NOW() AT TIME ZONE 'America/Mexico_City')::DATE;

    -- Si ya existe log hoy, no duplicar
    IF EXISTS (
      SELECT 1 FROM public.attendance_logs
      WHERE profile_id = NEW.id AND log_date = v_today
    ) THEN
      RETURN NEW;
    END IF;

    -- Calcular retardo en hora México
    v_hour_in := EXTRACT(HOUR   FROM NOW() AT TIME ZONE 'America/Mexico_City');
    v_min_in  := EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'America/Mexico_City');

    IF NEW.hora_entrada IS NOT NULL THEN
      v_expected_h := EXTRACT(HOUR   FROM NEW.hora_entrada);
      v_expected_m := EXTRACT(MINUTE FROM NEW.hora_entrada);
      v_late_mins  := GREATEST(0,
        (v_hour_in * 60 + v_min_in) - (v_expected_h * 60 + v_expected_m)
      );
    END IF;

    -- Insertar registro de asistencia
    INSERT INTO public.attendance_logs (
      profile_id, company_id, log_date, clock_in_time, late_minutes, break_status
    ) VALUES (
      NEW.id, NEW.company_id, v_today, NOW(), v_late_mins, 'active'
    );

    -- Marcar activo en el turno (duty_status)
    NEW.duty_status       := 'active';
    NEW.duty_status_since := NOW();

  -- Desvinculando grúa: tow_truck_id pasó de valor → NULL
  ELSIF (OLD.tow_truck_id IS NOT NULL AND NEW.tow_truck_id IS NULL) THEN

    NEW.duty_status       := 'offline';
    NEW.duty_status_since := NOW();

    -- Registrar hora de salida
    UPDATE public.attendance_logs
    SET clock_out_time = NOW(),
        break_status   = 'completed'
    WHERE profile_id = NEW.id
      AND log_date = (NOW() AT TIME ZONE 'America/Mexico_City')::DATE
      AND clock_out_time IS NULL;

  END IF;

  RETURN NEW;
END;
$$;

-- Crear el trigger en profiles
DROP TRIGGER IF EXISTS trg_auto_attendance_on_truck_link ON public.profiles;
CREATE TRIGGER trg_auto_attendance_on_truck_link
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_attendance_on_truck_link();

-- Verificar
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_auto_attendance_on_truck_link';
