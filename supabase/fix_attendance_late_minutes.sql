-- ============================================================
-- CORRECCIÓN: Recalcular late_minutes para TODOS los registros
-- (históricos y futuros) usando la zona horaria correcta de México.
-- ============================================================

UPDATE public.attendance_logs al
SET late_minutes = GREATEST(0,
    (
      EXTRACT(HOUR   FROM al.clock_in_time AT TIME ZONE 'America/Mexico_City') * 60 +
      EXTRACT(MINUTE FROM al.clock_in_time AT TIME ZONE 'America/Mexico_City')
    )
    -
    (
      EXTRACT(HOUR   FROM p.hora_entrada) * 60 +
      EXTRACT(MINUTE FROM p.hora_entrada)
    )
)
FROM public.profiles p
WHERE al.profile_id = p.id
  AND p.hora_entrada IS NOT NULL;

-- Verificar todos los registros históricos
SELECT
  al.log_date,
  p.full_name,
  p.hora_entrada,
  al.clock_in_time AT TIME ZONE 'America/Mexico_City' AS clock_in_local,
  al.late_minutes
FROM public.attendance_logs al
JOIN public.profiles p ON p.id = al.profile_id
ORDER BY al.log_date DESC, p.full_name;
