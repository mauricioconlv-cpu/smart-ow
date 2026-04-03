-- ============================================================
-- Migración para Privacidad de Datos Médicos (Multi-Tenant Estricto)
-- Ejecutar en Supabase Studio -> SQL Editor
-- ============================================================

-- Remover permisos de superadmin en Proveedores Médicos
DROP POLICY IF EXISTS "medical_providers_company_select" ON public.medical_providers;
DROP POLICY IF EXISTS "medical_providers_company_insert" ON public.medical_providers;
DROP POLICY IF EXISTS "medical_providers_company_update" ON public.medical_providers;
DROP POLICY IF EXISTS "medical_providers_company_delete" ON public.medical_providers;

CREATE POLICY "medical_providers_company_select" ON public.medical_providers
  FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "medical_providers_company_insert" ON public.medical_providers
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "medical_providers_company_update" ON public.medical_providers
  FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "medical_providers_company_delete" ON public.medical_providers
  FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- Remover permisos de superadmin en Servicios Médicos (HISTORIAL Y EXPEDIENTE)
DROP POLICY IF EXISTS "medical_services_company_select" ON public.medical_services;
DROP POLICY IF EXISTS "medical_services_company_insert" ON public.medical_services;
DROP POLICY IF EXISTS "medical_services_company_update" ON public.medical_services;

CREATE POLICY "medical_services_company_select" ON public.medical_services
  FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "medical_services_company_insert" ON public.medical_services
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "medical_services_company_update" ON public.medical_services
  FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- Remover permisos de superadmin en Tokens Médicos
DROP POLICY IF EXISTS "tokens_company_access" ON public.medical_service_tokens;

CREATE POLICY "tokens_company_access" ON public.medical_service_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.medical_services ms
      JOIN public.profiles p ON p.company_id = ms.company_id
      WHERE ms.id = medical_service_tokens.service_id
        AND p.id = auth.uid()
    )
  );
