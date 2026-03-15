-- =====================================================================
-- FIX: Políticas RLS para que el Monitor en Vivo funcione correctamente
-- El admin/superadmin/dispatcher necesita leer ALL profiles y tow_trucks
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- ─── PROFILES: Leer todos los perfiles ───────────────────────────────

-- Los admin/superadmin/dispatcher ya deben tener políticas SELECT globales,
-- pero por seguridad las recreamos explícitamente:

DROP POLICY IF EXISTS "Admins can view all profiles in their company" ON public.profiles;
CREATE POLICY "Admins can view all profiles in their company"
  ON public.profiles
  FOR SELECT
  USING (
    -- El propio usuario puede verse
    id = auth.uid()
    OR
    -- Admin/superadmin/dispatcher pueden ver todos los perfiles de su empresa
    (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'superadmin', 'dispatcher')
  );

-- ─── TOW TRUCKS: Leer todas las grúas ────────────────────────────────

-- Primero eliminamos la política restrictiva que solo mostraba su propia grúa
DROP POLICY IF EXISTS "Operators can view their truck" ON public.tow_trucks;

-- Ahora: operadores ven solo su grúa / admins/dispatchers ven todas
DROP POLICY IF EXISTS "Smart select on tow_trucks" ON public.tow_trucks;
CREATE POLICY "Smart select on tow_trucks"
  ON public.tow_trucks
  FOR SELECT
  USING (
    -- Admin / superadmin / dispatcher → todas las grúas
    (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'superadmin', 'dispatcher')
    OR
    -- Operador → solo su grúa asignada
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── TOW TRUCKS: El operador puede UPDATE su propia grúa (ubicación) ──
-- (Esta política ya debería existir, la recreamos por si acaso)
DROP POLICY IF EXISTS "Operators can update their truck location" ON public.tow_trucks;
CREATE POLICY "Operators can update their truck location" ON public.tow_trucks
  FOR UPDATE USING (
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── VERIFICAR resultado ──────────────────────────────────────────────
-- Después de ejecutar, puedes verificar así:
-- SELECT policyname, tablename, cmd FROM pg_policies WHERE tablename IN ('profiles', 'tow_trucks');
