-- =====================================================================
-- Actualizar RPC upsert_tow_truck para soportar 'tipo_vehiculo'
-- Ejecutar en SQL Editor de Supabase
-- =====================================================================

CREATE OR REPLACE FUNCTION public.upsert_tow_truck(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  IF payload->>'id' IS NOT NULL THEN
    UPDATE public.tow_trucks SET
      brand           = payload->>'brand',
      model           = payload->>'model',
      serial_number   = payload->>'serial_number',
      economic_number = payload->>'economic_number',
      plates          = payload->>'plates',
      unit_type       = payload->>'unit_type',
      tipo_vehiculo   = COALESCE(payload->>'tipo_vehiculo', tipo_vehiculo),
      tools           = COALESCE((payload->'tools')::jsonb, '[]'::jsonb),
      photo_url       = COALESCE(payload->>'photo_url', photo_url),
      is_active       = COALESCE((payload->>'is_active')::boolean, is_active)
    WHERE id = (payload->>'id')::uuid;
    
    RETURN jsonb_build_object('id', payload->>'id');
  ELSE
    INSERT INTO public.tow_trucks (
      company_id, brand, model, serial_number, economic_number, 
      plates, unit_type, tipo_vehiculo, tools, photo_url
    )
    VALUES (
      (payload->>'company_id')::uuid,
      payload->>'brand',
      payload->>'model',
      COALESCE(payload->>'serial_number', ''),
      payload->>'economic_number',
      payload->>'plates',
      payload->>'unit_type',
      COALESCE(payload->>'tipo_vehiculo', 'grua'),
      COALESCE((payload->>'tools')::jsonb, '[]'::jsonb),
      payload->>'photo_url'
    )
    RETURNING id INTO v_id;
    
    RETURN jsonb_build_object('id', v_id);
  END IF;
END;
$$;
