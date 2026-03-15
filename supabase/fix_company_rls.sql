-- =====================================================================
-- FIX: Política RLS para UPDATE en companies (logo + datos de empresa)
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- Asegurar columnas logo
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url  text,
  ADD COLUMN IF NOT EXISTS logo_name text;

-- Crear política UPDATE (primero la eliminamos si ya existe)
DROP POLICY IF EXISTS "Admins can update their own company" ON public.companies;

CREATE POLICY "Admins can update their own company"
  ON public.companies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = companies.id
        AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.company_id = companies.id
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Verificar que el bucket logos existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Verificar políticas de storage para logos
DROP POLICY IF EXISTS "logos_public_select"  ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_insert"    ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_update"    ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_delete"    ON storage.objects;

CREATE POLICY "logos_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

CREATE POLICY "logos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "logos_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "logos_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
