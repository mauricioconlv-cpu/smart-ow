-- ============================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Función para guardar tarifas de clientes via RPC (JSONB)
-- Migra el formato antiguo (tipo=local/foraneo) al nuevo (tipo=general)
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_client_rates(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id  uuid;
  v_company_id uuid;
BEGIN
  v_client_id := (payload->>'client_id')::uuid;

  -- Obtener company_id directamente del cliente (más confiable que desde profiles)
  SELECT company_id INTO v_company_id
  FROM public.clients
  WHERE id = v_client_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Cliente no encontrado o sin empresa asignada.');
  END IF;

  -- Eliminar reglas antiguas y reemplazar con una sola regla en nuevo formato
  -- Esto garantiza que no queden reglas en el formato viejo (tipo=local/foraneo)
  DELETE FROM public.pricing_rules WHERE client_id = v_client_id;

  INSERT INTO public.pricing_rules (
    client_id, company_id, tipo, costo_base, costo_km,
    -- Costos por tipo de grúa (nuevo formato)
    costo_local_tipo_a, costo_bande_tipo_a, costo_km_tipo_a,
    costo_local_tipo_b, costo_bande_tipo_b, costo_km_tipo_b,
    costo_local_tipo_c, costo_bande_tipo_c, costo_km_tipo_c,
    costo_local_tipo_d, costo_bande_tipo_d, costo_km_tipo_d,
    -- Costos adicionales genéricos
    costo_maniobra, costo_hora_espera, costo_abanderamiento, costo_resguardo,
    costo_dollys, costo_patines, costo_go_jacks,
    costo_rescate_subterraneo, costo_adaptacion,
    costo_blindaje_1, costo_blindaje_2, costo_blindaje_3, costo_blindaje_4,
    costo_blindaje_5, costo_blindaje_6, costo_blindaje_7,
    costo_kg_carga
  ) VALUES (
    v_client_id, v_company_id, 'general', 0, 0,
    COALESCE((payload->>'costo_local_tipo_a')::numeric, 0),
    COALESCE((payload->>'costo_bande_tipo_a')::numeric, 0),
    COALESCE((payload->>'costo_km_tipo_a')::numeric,    0),
    COALESCE((payload->>'costo_local_tipo_b')::numeric, 0),
    COALESCE((payload->>'costo_bande_tipo_b')::numeric, 0),
    COALESCE((payload->>'costo_km_tipo_b')::numeric,    0),
    COALESCE((payload->>'costo_local_tipo_c')::numeric, 0),
    COALESCE((payload->>'costo_bande_tipo_c')::numeric, 0),
    COALESCE((payload->>'costo_km_tipo_c')::numeric,    0),
    COALESCE((payload->>'costo_local_tipo_d')::numeric, 0),
    COALESCE((payload->>'costo_bande_tipo_d')::numeric, 0),
    COALESCE((payload->>'costo_km_tipo_d')::numeric,    0),
    COALESCE((payload->>'costo_maniobra')::numeric,            0),
    COALESCE((payload->>'costo_hora_espera')::numeric,         0),
    COALESCE((payload->>'costo_abanderamiento')::numeric,      0),
    COALESCE((payload->>'costo_resguardo')::numeric,           0),
    COALESCE((payload->>'costo_dollys')::numeric,              0),
    COALESCE((payload->>'costo_patines')::numeric,             0),
    COALESCE((payload->>'costo_go_jacks')::numeric,            0),
    COALESCE((payload->>'costo_rescate_subterraneo')::numeric, 0),
    COALESCE((payload->>'costo_adaptacion')::numeric,          0),
    COALESCE((payload->>'costo_blindaje_1')::numeric,          0),
    COALESCE((payload->>'costo_blindaje_2')::numeric,          0),
    COALESCE((payload->>'costo_blindaje_3')::numeric,          0),
    COALESCE((payload->>'costo_blindaje_4')::numeric,          0),
    COALESCE((payload->>'costo_blindaje_5')::numeric,          0),
    COALESCE((payload->>'costo_blindaje_6')::numeric,          0),
    COALESCE((payload->>'costo_blindaje_7')::numeric,          0),
    COALESCE((payload->>'costo_kg_carga')::numeric,            0)
  );

  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_client_rates(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
