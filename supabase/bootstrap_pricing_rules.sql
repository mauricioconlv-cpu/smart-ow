-- ============================================================
-- SOLUCIÓN DEFINITIVA: Agregar 'general' al enum y seed de pricing_rules
-- EJECUTAR EN SUPABASE SQL EDITOR (proyecto correcto)
-- ============================================================

-- 1. Agregar el valor 'general' al ENUM rule_type
--    (IF NOT EXISTS disponible desde PostgreSQL 9.3)
ALTER TYPE rule_type ADD VALUE IF NOT EXISTS 'general';

-- 2. Crear pricing_rules para todos los clientes que no tienen ninguna
INSERT INTO public.pricing_rules (client_id, company_id, tipo, costo_base, costo_km)
SELECT c.id, c.company_id, 'general', 0, 0
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules pr WHERE pr.client_id = c.id
);

-- 3. Trigger: crea pricing_rule automáticamente para nuevos clientes
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

-- 4. Verificar que quedó bien (debes ver axa, Cliente, ike con tipo=general)
SELECT c.name, pr.tipo, pr.costo_base
FROM public.clients c
LEFT JOIN public.pricing_rules pr ON pr.client_id = c.id
ORDER BY c.name;
