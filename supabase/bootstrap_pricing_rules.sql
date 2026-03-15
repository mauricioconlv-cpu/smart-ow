-- ============================================================
-- SOLUCIÓN DEFINITIVA: Bootstrap de pricing_rules
-- EJECUTAR EN SUPABASE SQL EDITOR (proyecto correcto)
-- Es seguro ejecutar varias veces
-- ============================================================

-- 1. CREAR pricing_rules para todos los clientes que aún no tienen una
--    (incluye axa, Cliente, ike, y cualquier otro que falte)
INSERT INTO public.pricing_rules (client_id, company_id, tipo, costo_base, costo_km)
SELECT c.id, c.company_id, 'general', 0, 0
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules pr WHERE pr.client_id = c.id
);

-- 2. TRIGGER: cuando se crea un cliente nuevo, crea automáticamente
--    su pricing_rule vacía. Así el app NUNCA necesita hacer INSERT.
CREATE OR REPLACE FUNCTION public.fn_create_default_pricing_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.pricing_rules (client_id, company_id, tipo, costo_base, costo_km)
  VALUES (NEW.id, NEW.company_id, 'general', 0, 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_pricing_rule ON public.clients;
CREATE TRIGGER trg_create_pricing_rule
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_default_pricing_rule();

-- 3. Verificar que todo quedó bien
SELECT c.name, pr.tipo, pr.costo_base
FROM public.clients c
LEFT JOIN public.pricing_rules pr ON pr.client_id = c.id
ORDER BY c.name;
