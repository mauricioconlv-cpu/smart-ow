-- =====================================================================
-- FIX: Política RLS para UPDATE en companies (logo + datos de empresa)
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- Política: Solo admins/superadmins de la empresa pueden actualizarla
CREATE POLICY IF NOT EXISTS "Admins can update their own company"
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

-- Asegurar columnas logo (por si no se corrió add_company_logo.sql antes)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url  text,
  ADD COLUMN IF NOT EXISTS logo_name text;
