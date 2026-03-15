-- =====================================================================
-- FIX: Aislamiento Multi-Tenant correcto para perfiles y grúas
--      + Panel analítico para el superadmin CEO
--
-- REGLAS:
--   superadmin → SOLO ve su propio perfil (no datos de clientes)
--   admin/dispatcher → solo ve perfiles de SU empresa
--   operator → solo se ve a sí mismo
--
-- Para el superadmin, los datos de empresas se exponen via función
-- SECURITY DEFINER get_platform_analytics() → métricas agregadas
--
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- ─── Funciones auxiliares (SECURITY DEFINER para evitar deadlock) ────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1; $$;

-- ─── Función de analytics para el superadmin ─────────────────────────
-- Retorna métricas por empresa sin exponer datos personales de usuarios
-- Solo puede ser llamada via RPC desde el server component
CREATE OR REPLACE FUNCTION public.get_platform_analytics()
RETURNS TABLE (
  company_id        uuid,
  company_name      text,
  total_users       bigint,
  total_operators   bigint,
  total_dispatchers bigint,
  total_trucks      bigint,
  services_30d      bigint,
  last_activity     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id                                        AS company_id,
    c.name                                      AS company_name,
    COUNT(DISTINCT p.id)                        AS total_users,
    COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'operator')   AS total_operators,
    COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'dispatcher') AS total_dispatchers,
    COUNT(DISTINCT t.id)                        AS total_trucks,
    COUNT(DISTINCT s.id) FILTER (
      WHERE s.created_at >= now() - interval '30 days'
    )                                           AS services_30d,
    MAX(p.created_at)                           AS last_activity
  FROM public.companies c
  LEFT JOIN public.profiles  p ON p.company_id = c.id
  LEFT JOIN public.tow_trucks t ON t.company_id = c.id
  LEFT JOIN public.services   s ON s.company_id = c.id
  GROUP BY c.id, c.name
  ORDER BY company_name;
$$;

-- ─── PROFILES: Limpiar políticas existentes ───────────────────────────
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON public.profiles;

-- ─── PROFILES: Política con aislamiento correcto ──────────────────────
-- NOTA: superadmin YA NO ve perfiles de otras empresas
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT
  USING (
    -- Siempre ve su propio perfil
    id = auth.uid()
    OR
    -- Admin y dispatcher ven solo los perfiles de SU empresa
    -- (superadmin NO entra aquí → usa la función analítica en su lugar)
    (
      public.get_my_role() IN ('admin', 'dispatcher')
      AND company_id = public.get_my_company_id()
    )
  );

-- ─── TOW TRUCKS: Limpiar políticas existentes ────────────────────────
DROP POLICY IF EXISTS "tow_trucks_select_policy" ON public.tow_trucks;
DROP POLICY IF EXISTS "tow_trucks_update_policy" ON public.tow_trucks;
DROP POLICY IF EXISTS "Operators can view their truck" ON public.tow_trucks;
DROP POLICY IF EXISTS "Smart select on tow_trucks" ON public.tow_trucks;
DROP POLICY IF EXISTS "Operators can update their truck location" ON public.tow_trucks;

-- ─── TOW TRUCKS: Política con aislamiento correcto ───────────────────
CREATE POLICY "tow_trucks_select_policy" ON public.tow_trucks
  FOR SELECT
  USING (
    -- Admin y dispatcher ven las grúas de SU empresa
    (
      public.get_my_role() IN ('admin', 'dispatcher')
      AND company_id = public.get_my_company_id()
    )
    OR
    -- Operador ve solo su grúa asignada
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── TOW TRUCKS: Operador puede actualizar su ubicación ──────────────
CREATE POLICY "tow_trucks_update_policy" ON public.tow_trucks
  FOR UPDATE USING (
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── Verificar ───────────────────────────────────────────────────────
-- SELECT policyname, tablename, cmd FROM pg_policies
-- WHERE tablename IN ('profiles', 'tow_trucks');
