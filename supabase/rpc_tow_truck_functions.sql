-- ============================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Crea funciones RPC para update/insert de grúas
-- Esto bypasea el schema cache de PostgREST completamente
-- ============================================================

-- FUNCIÓN 1: Insertar nueva grúa
CREATE OR REPLACE FUNCTION public.rpc_insert_tow_truck(
  p_company_id      uuid,
  p_brand           text,
  p_model           text,
  p_serial_number   text,
  p_economic_number text,
  p_plates          text,
  p_unit_type       text,
  p_tools           text[],
  p_current_lat     numeric DEFAULT 19.4326,
  p_current_lng     numeric DEFAULT -99.1332
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  INSERT INTO public.tow_trucks (
    company_id, brand, model, serial_number,
    economic_number, plates, unit_type, tools,
    current_lat, current_lng, is_active
  ) VALUES (
    p_company_id, p_brand, p_model, p_serial_number,
    p_economic_number, p_plates, p_unit_type, p_tools,
    p_current_lat, p_current_lng, true
  );
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Ya existe una grúa con ese número económico o placas.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- FUNCIÓN 2: Actualizar grúa existente
CREATE OR REPLACE FUNCTION public.rpc_update_tow_truck(
  p_id              uuid,
  p_brand           text,
  p_model           text,
  p_serial_number   text,
  p_economic_number text,
  p_plates          text,
  p_unit_type       text,
  p_tools           text[],
  p_is_active       boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tow_trucks SET
    brand           = p_brand,
    model           = p_model,
    serial_number   = p_serial_number,
    economic_number = p_economic_number,
    plates          = p_plates,
    unit_type       = p_unit_type,
    tools           = p_tools,
    is_active       = p_is_active
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Grúa no encontrada o sin permisos.');
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.rpc_insert_tow_truck TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_tow_truck TO authenticated;

-- Recargar schema para que las nuevas funciones sean visibles
NOTIFY pgrst, 'reload schema';
