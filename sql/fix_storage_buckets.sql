-- =====================================================================
-- FIX: Crear buckets de Storage faltantes + columnas de cierre
-- Ejecutar en el SQL Editor de Supabase
-- =====================================================================

-- ── 1. BUCKET: firmas (firmas digitales del cliente) ─────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas', 'firmas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "firmas_public_select" ON storage.objects;
DROP POLICY IF EXISTS "firmas_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "firmas_auth_update"   ON storage.objects;
DROP POLICY IF EXISTS "firmas_auth_delete"   ON storage.objects;

CREATE POLICY "firmas_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'firmas');

CREATE POLICY "firmas_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'firmas' AND auth.role() = 'authenticated');

CREATE POLICY "firmas_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'firmas' AND auth.role() = 'authenticated');

CREATE POLICY "firmas_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'firmas' AND auth.role() = 'authenticated');

-- ── 2. BUCKET: audios (mensajes de voz PTT / buzón) ──────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('audios', 'audios', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "audios_public_select" ON storage.objects;
DROP POLICY IF EXISTS "audios_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "audios_auth_update"   ON storage.objects;
DROP POLICY IF EXISTS "audios_auth_delete"   ON storage.objects;

CREATE POLICY "audios_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'audios');

CREATE POLICY "audios_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audios' AND auth.role() = 'authenticated');

CREATE POLICY "audios_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'audios' AND auth.role() = 'authenticated');

CREATE POLICY "audios_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'audios' AND auth.role() = 'authenticated');

-- ── 3. Columnas nuevas del formulario de cierre ───────────────────────
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS tipo_asistencia       text,
  ADD COLUMN IF NOT EXISTS tiempo_espera         text,
  ADD COLUMN IF NOT EXISTS calidad_operador      text,
  ADD COLUMN IF NOT EXISTS nombre_cliente_firma  text;

-- Verificación
SELECT 'firmas' as bucket, EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'firmas') as existe
UNION ALL
SELECT 'audios', EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'audios')
UNION ALL
SELECT 'logos',  EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'logos');
