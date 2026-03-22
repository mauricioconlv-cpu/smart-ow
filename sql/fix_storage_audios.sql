-- ============================================================
-- FIX: bucket 'audios' — hacerlo público para reproducción
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Actualizar el bucket 'audios' para que sea público
UPDATE storage.buckets
SET public = true
WHERE id = 'audios';

-- 2. Si el bucket no existe, crearlo público
INSERT INTO storage.buckets (id, name, public)
VALUES ('audios', 'audios', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Permitir que cualquier usuario autenticado subael archivos al bucket
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audios');

-- 4. Permitir que cualquiera pueda leer (para reproducir el audio en el player)
DROP POLICY IF EXISTS "Anyone can read audio" ON storage.objects;
CREATE POLICY "Anyone can read audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'audios');

-- 5. Verificar
SELECT id, name, public FROM storage.buckets WHERE id = 'audios';
