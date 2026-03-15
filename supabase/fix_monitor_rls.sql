-- =====================================================================
-- FIX v2: Corrección de RLS para perfiles y grúas sin deadlock recursivo
-- El problema del script anterior era que la política de profiles
-- usaba un subquery en la misma tabla profiles, causando un deadlock.
-- 
-- La solución es usar una función SECURITY DEFINER que bypasea RLS
-- para leer el role del usuario actual de forma segura.
--
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- ─── 1. Función auxiliar para obtener el role del usuario actual ─────
-- SECURITY DEFINER corre con los permisos del superusuario (bypasea RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─── 2. PROFILES: Eliminar políticas conflictivas ────────────────────
-- Eliminamos la política que causó el deadlock
DROP POLICY IF EXISTS "Admins can view all profiles in their company" ON public.profiles;

-- También eliminamos cualquier política antigua que solo permitía ver el propio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON public.profiles;

-- ─── 3. PROFILES: Nueva política SELECT sin deadlock ─────────────────
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT
  USING (
    -- Superadmin/admin/dispatcher ven TODOS los perfiles
    public.get_my_role() IN ('superadmin', 'admin', 'dispatcher')
    OR
    -- Todos los demás solo ven su propio perfil
    id = auth.uid()
  );

-- ─── 4. TOW TRUCKS: Eliminar políticas conflictivas ──────────────────
DROP POLICY IF EXISTS "Operators can view their truck" ON public.tow_trucks;
DROP POLICY IF EXISTS "Smart select on tow_trucks" ON public.tow_trucks;

-- ─── 5. TOW TRUCKS: Nueva política SELECT sin deadlock ───────────────
CREATE POLICY "tow_trucks_select_policy" ON public.tow_trucks
  FOR SELECT
  USING (
    -- Admin/superadmin/dispatcher → todas las grúas
    public.get_my_role() IN ('superadmin', 'admin', 'dispatcher')
    OR
    -- Operador → solo su grúa asignada
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── 6. TOW TRUCKS: Operador puede UPDATE su ubicación ───────────────
DROP POLICY IF EXISTS "Operators can update their truck location" ON public.tow_trucks;
CREATE POLICY "tow_trucks_update_policy" ON public.tow_trucks
  FOR UPDATE USING (
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── Verificación ────────────────────────────────────────────────────
-- SELECT policyname, tablename, cmd FROM pg_policies 
-- WHERE tablename IN ('profiles', 'tow_trucks');
