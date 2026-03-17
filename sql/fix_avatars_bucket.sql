-- 1. Crear el bucket 'avatars' si no existe, configurándolo como público
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Eliminar políticas anteriores para evitar duplicados/conflictos
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete an avatar." ON storage.objects;

-- 3. Crear política para que cualquier persona pueda ver las fotos (Select)
CREATE POLICY "Avatar images are publicly accessible."
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 4. Crear política para que los usuarios autenticados puedan subir fotos (Insert)
CREATE POLICY "Anyone can upload an avatar."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- 5. Crear política para que los usuarios autenticados puedan actualizar fotos (Update)
CREATE POLICY "Anyone can update an avatar."
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- 6. Crear política para que los usuarios autenticados puedan borrar fotos (Delete)
CREATE POLICY "Anyone can delete an avatar."
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
