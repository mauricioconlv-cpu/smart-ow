-- Limpiar grua_asignada de operadores offline (el campo que el monitor usa para filtrar)
UPDATE public.profiles
SET tow_truck_id = NULL, grua_asignada = NULL, duty_status = 'offline'
WHERE role = 'operator'
  AND (duty_status = 'offline' OR tow_truck_id IS NULL);

-- Verificar resultado final
SELECT full_name, duty_status, tow_truck_id, grua_asignada
FROM public.profiles
WHERE role = 'operator'
ORDER BY duty_status, full_name;
