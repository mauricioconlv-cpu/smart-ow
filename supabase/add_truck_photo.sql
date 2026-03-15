-- =====================================================================
-- Agregar columna photo_url a tow_trucks para fotos de grúas
-- + Asegurarse de que el bucket 'tow-trucks' existe en Supabase Storage
-- =====================================================================

-- 1. Agregar columna photo_url
ALTER TABLE public.tow_trucks
  ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Actualizar RPC upsert_tow_truck para aceptar photo_url (si existe)
-- Nota: Supabase Postgres JSONB payload — el campo se toma directamente del payload
-- Si el RPC no acepta photo_url aún, ejecutar esto también:
/*
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
        tools           = COALESCE((payload->'tools')::jsonb, '[]'::jsonb),
        photo_url       = COALESCE(payload->>'photo_url', photo_url),
        is_active       = COALESCE((payload->>'is_active')::boolean, is_active)
      WHERE id = (payload->>'id')::uuid;
      RETURN jsonb_build_object('id', payload->>'id');
    ELSE
      INSERT INTO public.tow_trucks (company_id, brand, model, serial_number, economic_number, plates, unit_type, tools, photo_url)
      VALUES (
        (payload->>'company_id')::uuid,
        payload->>'brand',
        payload->>'model',
        COALESCE(payload->>'serial_number', ''),
        payload->>'economic_number',
        payload->>'plates',
        payload->>'unit_type',
        COALESCE((payload->'tools')::jsonb, '[]'::jsonb),
        payload->>'photo_url'
      )
      RETURNING id INTO v_id;
      RETURN jsonb_build_object('id', v_id);
    END IF;
  END;
  $$;
*/

-- 3. Verificar
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tow_trucks' AND column_name = 'photo_url';
