-- =====================================================================
-- RESET DEFINITIVO DE RLS — Multi-Tenant Isolation
-- Este script elimina TODAS las políticas existentes en profiles y
-- tow_trucks (sin importar su nombre) y recrea solo las correctas.
--
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- ─── PASO 1: Borrar ABSOLUTAMENTE TODAS las políticas existentes ─────
-- Usamos un bloque dinámico para no depender de nombres específicos
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Eliminar todas las políticas de profiles
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    RAISE NOTICE 'Dropped profiles policy: %', r.policyname;
  END LOOP;

  -- Eliminar todas las políticas de tow_trucks
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'tow_trucks' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tow_trucks', r.policyname);
    RAISE NOTICE 'Dropped tow_trucks policy: %', r.policyname;
  END LOOP;
END$$;

-- ─── PASO 2: Verificar que RLS está habilitado en ambas tablas ────────
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tow_trucks ENABLE ROW LEVEL SECURITY;

-- ─── PASO 3: Funciones auxiliares (SECURITY DEFINER) ─────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS
$$ SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS
$$ SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1; $$;

-- ─── PASO 4: Función de analytics del CEO (sin exponer PII) ──────────
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
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    c.id,
    c.name,
    COUNT(DISTINCT p.id),
    COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'operator'),
    COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'dispatcher'),
    COUNT(DISTINCT t.id),
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at >= now() - interval '30 days'),
    MAX(p.created_at)
  FROM public.companies c
  LEFT JOIN public.profiles   p ON p.company_id = c.id
  LEFT JOIN public.tow_trucks t ON t.company_id = c.id
  LEFT JOIN public.services   s ON s.company_id = c.id
  GROUP BY c.id, c.name
  ORDER BY c.name;
$$;

-- ─── PASO 5: Nuevas políticas PROFILES ───────────────────────────────
-- Regla:
--   superadmin → solo su propio perfil (usa get_platform_analytics para ver empresas)
--   admin / dispatcher → todos los perfiles de SU empresa
--   operator → solo el suyo

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (
      public.get_my_role() IN ('admin', 'dispatcher', 'superadmin')
      AND company_id = public.get_my_company_id()
    )
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ─── PASO 6: Nuevas políticas TOW_TRUCKS ─────────────────────────────
-- Regla:
--   superadmin → NINGUNA grúa directamente (no gestiona flotillas de clientes)
--   admin / dispatcher → solo las grúas de SU empresa
--   operator → solo su grúa asignada

CREATE POLICY "tow_trucks_select" ON public.tow_trucks
  FOR SELECT USING (
    (
      public.get_my_role() IN ('admin', 'dispatcher')
      AND company_id = public.get_my_company_id()
    )
    OR id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "tow_trucks_update_own" ON public.tow_trucks
  FOR UPDATE USING (
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "tow_trucks_insert" ON public.tow_trucks
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('admin', 'superadmin')
  );

CREATE POLICY "tow_trucks_delete" ON public.tow_trucks
  FOR DELETE USING (
    public.get_my_role() IN ('admin', 'superadmin')
    AND company_id = public.get_my_company_id()
  );

-- ─── VERIFICAR resultado ──────────────────────────────────────────────
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'tow_trucks')
ORDER BY tablename, policyname;
