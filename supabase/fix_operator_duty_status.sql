-- ============================================================
-- CORRECCIÓN INMEDIATA: Activar operadores que ya vincularon
-- su grúa pero no aparecen en el monitor del dashboard
-- (Su duty_status está en 'offline' por el bug)
-- ============================================================

-- Poner como 'active' a todos los operadores que tienen
-- tow_truck_id asignado pero duty_status = 'offline'
UPDATE public.profiles
SET 
  duty_status = 'active',
  duty_status_since = NOW()
WHERE 
  role = 'operator'
  AND tow_truck_id IS NOT NULL
  AND (duty_status = 'offline' OR duty_status IS NULL);

-- Verificar
SELECT id, full_name, duty_status, duty_status_since, tow_truck_id
FROM public.profiles
WHERE role = 'operator'
ORDER BY full_name;
