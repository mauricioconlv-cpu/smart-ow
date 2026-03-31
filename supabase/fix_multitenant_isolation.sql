-- =====================================================================
-- FIX CRÍTICO: Aislamiento multi-tenant completo (sin DO$$ loops)
-- Nadie puede ver datos de otra empresa.
-- Ejecutar en Supabase → SQL Editor → Run
-- =====================================================================

-- ─── FUNCIONES HELPER ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1; $$;

-- ─── 1. SERVICES ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenancy policy for services select"  ON public.services;
DROP POLICY IF EXISTS "Tenancy policy for services insert"  ON public.services;
DROP POLICY IF EXISTS "Tenancy policy for services update"  ON public.services;
DROP POLICY IF EXISTS "Tenancy policy for services delete"  ON public.services;
DROP POLICY IF EXISTS "services_select"                     ON public.services;
DROP POLICY IF EXISTS "services_insert"                     ON public.services;
DROP POLICY IF EXISTS "services_update"                     ON public.services;
DROP POLICY IF EXISTS "services_delete"                     ON public.services;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_select" ON public.services
  FOR SELECT USING (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY "services_insert" ON public.services
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('admin', 'dispatcher')
  );

CREATE POLICY "services_update" ON public.services
  FOR UPDATE USING (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY "services_delete" ON public.services
  FOR DELETE USING (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- ─── 2. CLIENTS ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenancy policy for clients"  ON public.clients;
DROP POLICY IF EXISTS "clients_select"               ON public.clients;
DROP POLICY IF EXISTS "clients_insert"               ON public.clients;
DROP POLICY IF EXISTS "clients_update"               ON public.clients;
DROP POLICY IF EXISTS "clients_delete"               ON public.clients;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select" ON public.clients
  FOR SELECT USING (
    company_id IS NOT NULL AND company_id = public.get_my_company_id()
  );

CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('admin', 'dispatcher')
  );

CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE USING (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('admin', 'dispatcher')
  );

CREATE POLICY "clients_delete" ON public.clients
  FOR DELETE USING (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- ─── 3. SERVICE_LOGS ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenancy policy for service logs"  ON public.service_logs;
DROP POLICY IF EXISTS "service_logs_select"               ON public.service_logs;
DROP POLICY IF EXISTS "service_logs_insert"               ON public.service_logs;
DROP POLICY IF EXISTS "service_logs_update"               ON public.service_logs;

ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_logs_select" ON public.service_logs
  FOR SELECT USING (
    (company_id IS NOT NULL AND company_id = public.get_my_company_id())
    OR
    EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_logs.service_id
        AND s.company_id = public.get_my_company_id()
    )
  );

CREATE POLICY "service_logs_insert" ON public.service_logs
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
  );

-- ─── 4. PRICING_RULES ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenancy policy for pricing_rules"  ON public.pricing_rules;
DROP POLICY IF EXISTS "pricing_rules_all"                  ON public.pricing_rules;

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_rules_all" ON public.pricing_rules
  FOR ALL
  USING (company_id IS NOT NULL AND company_id = public.get_my_company_id())
  WITH CHECK (company_id IS NOT NULL AND company_id = public.get_my_company_id());

-- ─── 5. TOW_TRUCKS ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenancy policy for tow_trucks"          ON public.tow_trucks;
DROP POLICY IF EXISTS "Tenancy policy for tow_trucks update"   ON public.tow_trucks;
DROP POLICY IF EXISTS "Tenancy policy for tow_trucks delete"   ON public.tow_trucks;
DROP POLICY IF EXISTS "tow_trucks_select"                       ON public.tow_trucks;
DROP POLICY IF EXISTS "tow_trucks_insert"                       ON public.tow_trucks;
DROP POLICY IF EXISTS "tow_trucks_update"                       ON public.tow_trucks;
DROP POLICY IF EXISTS "tow_trucks_update_own"                   ON public.tow_trucks;
DROP POLICY IF EXISTS "tow_trucks_delete"                       ON public.tow_trucks;

ALTER TABLE public.tow_trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tow_trucks_select" ON public.tow_trucks
  FOR SELECT USING (
    (company_id IS NOT NULL AND company_id = public.get_my_company_id())
    OR
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tow_trucks_insert" ON public.tow_trucks
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "tow_trucks_update" ON public.tow_trucks
  FOR UPDATE USING (
    (company_id IS NOT NULL AND company_id = public.get_my_company_id() AND public.get_my_role() = 'admin')
    OR
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "tow_trucks_delete" ON public.tow_trucks
  FOR DELETE USING (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- ─── 6. PROFILES ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view profiles of their own company"  ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in their company"   ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their company"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"                  ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"                               ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"                           ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"                         ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"                               ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (
      company_id IS NOT NULL
      AND company_id = public.get_my_company_id()
      AND public.get_my_role() IN ('admin', 'dispatcher')
    )
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    company_id IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND public.get_my_role() = 'admin'
  );

-- ─── 7. COMPANIES ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own company"      ON public.companies;
DROP POLICY IF EXISTS "Admins can update their own company"   ON public.companies;
DROP POLICY IF EXISTS "companies_select"                      ON public.companies;
DROP POLICY IF EXISTS "companies_update"                      ON public.companies;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (id = public.get_my_company_id());

CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE
  USING (id = public.get_my_company_id() AND public.get_my_role() = 'admin')
  WITH CHECK (id = public.get_my_company_id() AND public.get_my_role() = 'admin');

-- ─── 8. PASSWORD_REQUESTS ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin can view password requests"     ON public.password_requests;
DROP POLICY IF EXISTS "Admin can update password requests"   ON public.password_requests;
DROP POLICY IF EXISTS "Anyone can insert password requests"  ON public.password_requests;
DROP POLICY IF EXISTS "Users can manage own requests"        ON public.password_requests;
DROP POLICY IF EXISTS "Admins can view company requests"     ON public.password_requests;
DROP POLICY IF EXISTS "Admins can update company requests"   ON public.password_requests;
DROP POLICY IF EXISTS "password_requests_select"             ON public.password_requests;
DROP POLICY IF EXISTS "password_requests_insert"             ON public.password_requests;
DROP POLICY IF EXISTS "password_requests_update"             ON public.password_requests;

ALTER TABLE public.password_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "password_requests_select" ON public.password_requests
  FOR SELECT USING (
    -- El propio operador ve su solicitud
    user_id = auth.uid()
    OR
    -- Admin/Dispatcher de la misma empresa
    (
      public.get_my_role() IN ('admin', 'dispatcher')
      AND company_id = public.get_my_company_id()
    )
  );

CREATE POLICY "password_requests_insert" ON public.password_requests
  FOR INSERT WITH CHECK (true); -- RPC pública lo maneja

CREATE POLICY "password_requests_update" ON public.password_requests
  FOR UPDATE USING (
    public.get_my_role() IN ('admin', 'dispatcher')
    AND company_id = public.get_my_company_id()
  );

-- ─── VERIFICACIÓN FINAL ───────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('services','clients','service_logs','pricing_rules',
                    'tow_trucks','profiles','companies','password_requests')
ORDER BY tablename, policyname;
