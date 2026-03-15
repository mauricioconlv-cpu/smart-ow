-- DIAGNÓSTICO: Ejecutar en Supabase SQL Editor para ver el estado real
-- 1. Ver todos los pricing_rules
SELECT 
  pr.id,
  c.name as cliente,
  pr.tipo,
  pr.costo_base,
  pr.costo_km,
  pr.company_id
FROM public.pricing_rules pr
JOIN public.clients c ON c.id = pr.client_id
ORDER BY c.name;

-- 2. Ver todos los clientes
SELECT id, name, company_id FROM public.clients ORDER BY name;

-- 3. Insertar UNA regla de prueba MANUAL para el cliente 'axa'
-- (reemplaza AXA_CLIENT_ID con el id real que aparece en la query anterior)
-- INSERT INTO public.pricing_rules (client_id, company_id, tipo, costo_base, costo_km)
-- SELECT id, company_id, 'general', 1000, 20 FROM public.clients WHERE name = 'axa';
