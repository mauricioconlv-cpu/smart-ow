-- Agregar logo_url y logo_name a la tabla companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url   text,
  ADD COLUMN IF NOT EXISTS logo_name  text;

-- Políticas de Storage para bucket de logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='logos_public_select'
  ) THEN
    CREATE POLICY "logos_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='logos_auth_insert'
  ) THEN
    CREATE POLICY "logos_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='logos_auth_update'
  ) THEN
    CREATE POLICY "logos_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='logos_auth_delete'
  ) THEN
    CREATE POLICY "logos_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
  END IF;
END $$;
