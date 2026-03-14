-- Elimina todos los servicios de prueba (los 3 registros del screenshot)
-- EJECUTAR EN SUPABASE SQL EDITOR

-- Primero elimina service_logs relacionados si existen
DELETE FROM public.service_logs
WHERE service_id IN (
  SELECT id FROM public.services ORDER BY created_at ASC LIMIT 3
);

-- Luego elimina los servicios
DELETE FROM public.services
WHERE id IN (
  SELECT id FROM public.services ORDER BY created_at ASC LIMIT 3
);

-- Verifica que quedaron eliminados:
SELECT folio, status, created_at FROM public.services ORDER BY created_at;
