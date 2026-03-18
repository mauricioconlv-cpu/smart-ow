-- Agrega resource_url a service_logs para guardar URL de audios PTT
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS resource_url TEXT;

-- El bucket 'audios' debe existir en Supabase Storage.
-- Si no existe, crearlo desde: Storage → New Bucket → Name: "audios" → Public: OFF
-- Luego agregar esta política de acceso:

-- Policy: operadores y dispatchers autenticados pueden subir/leer
-- (ejecutar en el SQL editor después de crear el bucket)
/*
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audios');

CREATE POLICY "Authenticated users can read audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audios');
*/
