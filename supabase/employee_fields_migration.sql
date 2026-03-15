-- =====================================================================
-- MIGRACIÓN: Nuevos campos de empleados + Login por Teléfono
-- Ejecutar en: Supabase SQL Editor → Project: smart-tow
-- =====================================================================

-- 1. Agregar columnas nuevas a profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone            text,
  ADD COLUMN IF NOT EXISTS nss             text,
  ADD COLUMN IF NOT EXISTS avatar_url      text,
  ADD COLUMN IF NOT EXISTS salario_mensual numeric,
  ADD COLUMN IF NOT EXISTS hora_entrada    time,
  ADD COLUMN IF NOT EXISTS hora_salida     time,
  ADD COLUMN IF NOT EXISTS dias_descanso   text[],
  ADD COLUMN IF NOT EXISTS tipo_jornada    text DEFAULT 'normal';

-- Nota: horas_laboradas se calcula en la app (no como columna generada,
-- para mayor compatibilidad con Supabase versiones antiguas).

-- 2. Índice único en phone (para búsqueda de login)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles(phone)
  WHERE phone IS NOT NULL;

-- =====================================================================
-- 3. Función RPC: get_email_by_phone
--    Permite al frontend buscar el email interno a partir del teléfono
--    sin exponer la tabla auth.users directamente.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_email_by_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT au.email INTO v_email
  FROM   auth.users au
  JOIN   public.profiles p ON p.id = au.id
  WHERE  p.phone = p_phone
  LIMIT  1;
  RETURN v_email;
END;
$$;

-- Permisos: sólo el rol anónimo (pre-login) y autenticado pueden llamarla
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO anon, authenticated;

-- =====================================================================
-- 4. Supabase Storage: Bucket de avatares
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
DO $$
BEGIN
  -- Select público
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_public_select'
  ) THEN
    CREATE POLICY "avatars_public_select"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;

  -- Insert (admins autenticados)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_auth_insert'
  ) THEN
    CREATE POLICY "avatars_auth_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;

  -- Update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_auth_update'
  ) THEN
    CREATE POLICY "avatars_auth_update"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;

  -- Delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_auth_delete'
  ) THEN
    CREATE POLICY "avatars_auth_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- =====================================================================
-- FIN DE MIGRACIÓN
-- Después de ejecutar esto, reinicia el servidor Next.js (npm run dev)
-- =====================================================================
