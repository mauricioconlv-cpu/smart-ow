-- ══════════════════════════════════════════════════════════════════════════════
-- RESET COMPLETO DE DATOS — SmartTow
-- Elimina todas las empresas, usuarios, datos operativos, y deja SOLO
-- al usuario CEO (superadmin / multitenant) intacto.
--
-- ⚠️  EJECUTAR EN SUPABASE SQL EDITOR
-- ⚠️  ESTO ES DESTRUCTIVO — no se puede deshacer
-- ══════════════════════════════════════════════════════════════════════════════

-- PASO 0: Identificar al CEO antes de borrar nada
-- (Ejecuta esto primero si quieres verificar quién es el CEO)
DO $$
DECLARE
  ceo_count INT;
BEGIN
  SELECT COUNT(*) INTO ceo_count FROM public.profiles WHERE role = 'superadmin';
  RAISE NOTICE '✅ Superadmins encontrados: %', ceo_count;
  IF ceo_count = 0 THEN
    RAISE EXCEPTION '🚨 No hay ningún superadmin — abortando para no perder acceso al sistema.';
  END IF;
END $$;


-- ══════════════════════════════════════════════
-- PASO 1: LIMPIAR DATOS OPERATIVOS (hoja por hoja, respetando FK)
-- ══════════════════════════════════════════════

-- 1.1 Nómina y asistencia
DELETE FROM public.schedule_audit_logs;
DELETE FROM public.time_off_requests;
DELETE FROM public.attendance_logs;

-- 1.2 Eventos de turno de operadores
DELETE FROM public.operator_shift_events;

-- 1.3 Bitácora de servicios
DELETE FROM public.service_logs;

-- 1.4 Servicios
DELETE FROM public.services;

-- 1.5 Inventario de vehículos (ítems de configuración por empresa)
DELETE FROM public.inventory_items;

-- 1.6 Reglas de tarifas
DELETE FROM public.pricing_rules;

-- 1.7 Clientes / aseguradoras
DELETE FROM public.clients;

-- 1.8 Grúas / flota
UPDATE public.profiles SET tow_truck_id = NULL, grua_asignada = NULL;
DELETE FROM public.tow_trucks;


-- ══════════════════════════════════════════════
-- PASO 2: ELIMINAR USUARIOS NO-CEO DE auth.users (via RPC seguro)
-- Primero borramos los perfiles de empresa y luego los usuarios de auth
-- ══════════════════════════════════════════════

-- 2.1 Primero borrar los PROFILES (FK child) de usuarios no-CEO
--     (el profile tiene FK → auth.users, así que va primero)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.full_name, p.role
    FROM public.profiles p
    WHERE p.role != 'superadmin'
  LOOP
    RAISE NOTICE 'Borrando profile: % (%) - rol: %', r.full_name, r.id, r.role;
    DELETE FROM public.profiles WHERE id = r.id;
  END LOOP;
END $$;

-- 2.2 Ahora sí borrar los usuarios de auth.users (ya sin referencias)
--     Excluimos al CEO por su auth.users id
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'superadmin'
);


-- ══════════════════════════════════════════════
-- PASO 3: ELIMINAR TODAS LAS EMPRESAS
-- (Los perfiles de empresa ya se borraron en cascada en el paso anterior)
-- ══════════════════════════════════════════════
DELETE FROM public.companies;


-- ══════════════════════════════════════════════
-- PASO 4: LIMPIAR ESTADO DEL CEO (duty_status, grua_asignada)
-- El perfil del CEO permanece, solo limpiamos campos operativos residuales
-- ══════════════════════════════════════════════
UPDATE public.profiles
SET
  company_id       = NULL,
  tow_truck_id     = NULL,
  grua_asignada    = NULL,
  duty_status      = 'offline',
  duty_status_since = NULL
WHERE role = 'superadmin';


-- ══════════════════════════════════════════════
-- PASO 5: VERIFICACIÓN FINAL
-- ══════════════════════════════════════════════
SELECT '=== ESTADO FINAL ===' AS info;

SELECT 'Empresas' AS tabla, COUNT(*) AS registros FROM public.companies
UNION ALL
SELECT 'Usuarios (profiles)', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'CEO superadmin', COUNT(*) FROM public.profiles WHERE role = 'superadmin'
UNION ALL
SELECT 'Grúas', COUNT(*) FROM public.tow_trucks
UNION ALL
SELECT 'Clientes', COUNT(*) FROM public.clients
UNION ALL
SELECT 'Servicios', COUNT(*) FROM public.services
UNION ALL
SELECT 'Bitácora (service_logs)', COUNT(*) FROM public.service_logs
UNION ALL
SELECT 'Asistencia (attendance_logs)', COUNT(*) FROM public.attendance_logs
UNION ALL
SELECT 'Inventario (inventory_items)', COUNT(*) FROM public.inventory_items
UNION ALL
SELECT 'Eventos turno operador', COUNT(*) FROM public.operator_shift_events;

-- Mostrar datos del CEO
SELECT 'CEO info:' AS info, id, full_name, role, company_id
FROM public.profiles WHERE role = 'superadmin';
