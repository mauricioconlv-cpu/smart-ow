-- =====================================================================
-- Dispatcher Supervision Levels & Force Logout
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- 1. Agregar columna supervisor_level a profiles
--    0 = Despachador básico (sin poderes extra)
--    1 = Supervisor (puede forzar cierre de turno de operadores)
--    2 = Supervisor Jefe (mismos poderes que admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supervisor_level INTEGER NOT NULL DEFAULT 0;

-- 2. Agregar columna last_login_at para heartbeat/auditoría
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 3. Función RPC: force_operator_logout
--    Puede ser llamada por:
--      - Cualquier admin de la misma empresa
--      - Cualquier dispatcher con supervisor_level >= 1 de la misma empresa
CREATE OR REPLACE FUNCTION public.force_operator_logout(p_operator_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role     text;
  v_caller_level    integer;
  v_caller_company  uuid;
  v_op_company      uuid;
  v_op_name         text;
BEGIN
  -- Obtener datos del invocador
  SELECT role, supervisor_level, company_id
    INTO v_caller_role, v_caller_level, v_caller_company
    FROM public.profiles
   WHERE id = auth.uid();

  -- Verificar permiso
  IF v_caller_role NOT IN ('admin', 'dispatcher', 'superadmin') THEN
    RAISE EXCEPTION 'Permiso denegado: rol insuficiente';
  END IF;

  IF v_caller_role = 'dispatcher' AND v_caller_level < 1 THEN
    RAISE EXCEPTION 'Permiso denegado: nivel de supervisión insuficiente';
  END IF;

  -- Obtener datos del operador
  SELECT company_id, full_name
    INTO v_op_company, v_op_name
    FROM public.profiles
   WHERE id = p_operator_id;

  IF v_op_company IS NULL THEN
    RAISE EXCEPTION 'Operador no encontrado';
  END IF;

  -- Verificar que pertenezcan a la misma empresa (excepto superadmin)
  IF v_caller_role != 'superadmin' AND v_caller_company != v_op_company THEN
    RAISE EXCEPTION 'Permiso denegado: empresa distinta';
  END IF;

  -- Limpiar vinculación del operador
  UPDATE public.profiles
     SET tow_truck_id  = NULL,
         grua_asignada = NULL
   WHERE id = p_operator_id;

  RETURN jsonb_build_object(
    'success', true,
    'operator_name', v_op_name
  );
END;
$$;

-- 4. Verificar resultado
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name = 'profiles'
   AND column_name IN ('supervisor_level', 'last_seen_at')
 ORDER BY column_name;
