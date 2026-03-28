-- =====================================================================
-- Evidencia fotográfica por etapa de servicio
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- 1. Bucket de imágenes de evidencia
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-evidence',
  'service-evidence',
  true,
  1048576,  -- 1 MB máximo (el cliente ya comprime, esto es doble check)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas del bucket
-- Operadores autenticados pueden subir
CREATE POLICY "Operators can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-evidence');

-- Todos pueden leer (para mostrar en web y PDF)
CREATE POLICY "Anyone can view evidence"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'service-evidence');

-- Operadores pueden eliminar sus propias fotos
CREATE POLICY "Operators can delete own evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'service-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Columna para placas del vehículo en servicios
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS vehicle_plates text,
  ADD COLUMN IF NOT EXISTS vehicle_plates_captured_at timestamptz;

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_services_vehicle_plates ON public.services(vehicle_plates);
