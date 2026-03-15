-- ============================================================
-- EJECUTAR EN SUPABASE SQL EDITOR  
-- Función universal para actualizar/insertar grúas
-- Recibe datos en JSONB para evitar el schema cache
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_tow_truck(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id          uuid;
  v_company_id  uuid;
  v_unit_type   text;
  v_tools       text[];
  v_is_active   boolean;
BEGIN
  v_id          := (payload->>'id')::uuid;
  v_company_id  := (payload->>'company_id')::uuid;
  v_unit_type   := payload->>'unit_type';
  v_is_active   := COALESCE((payload->>'is_active')::boolean, true);
  
  -- Convertir tools de JSON array a text[]
  SELECT array_agg(t.value::text)
  INTO v_tools
  FROM jsonb_array_elements_text(COALESCE(payload->'tools', '[]'::jsonb)) AS t(value);

  IF v_id IS NULL THEN
    -- INSERT nueva grúa
    INSERT INTO public.tow_trucks (
      company_id, brand, model, serial_number,
      economic_number, plates, unit_type, tools,
      current_lat, current_lng, is_active
    ) VALUES (
      v_company_id,
      payload->>'brand',
      payload->>'model',
      COALESCE(payload->>'serial_number', ''),
      payload->>'economic_number',
      payload->>'plates',
      v_unit_type,
      COALESCE(v_tools, ARRAY[]::text[]),
      COALESCE((payload->>'current_lat')::numeric, 19.4326),
      COALESCE((payload->>'current_lng')::numeric, -99.1332),
      v_is_active
    );
  ELSE
    -- UPDATE grúa existente
    UPDATE public.tow_trucks SET
      brand           = payload->>'brand',
      model           = payload->>'model',
      serial_number   = COALESCE(payload->>'serial_number', ''),
      economic_number = payload->>'economic_number',
      plates          = payload->>'plates',
      unit_type       = v_unit_type,
      tools           = COALESCE(v_tools, ARRAY[]::text[]),
      is_active       = v_is_active
    WHERE id = v_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Grúa no encontrada o sin permisos.');
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Ya existe una grúa con ese número económico o placas.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_tow_truck(jsonb) TO authenticated;

-- Recargar schema
NOTIFY pgrst, 'reload schema';
