-- Add avatar_url column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url text;
        RAISE NOTICE 'Columna avatar_url agregada exitosamente.';
    ELSE
        RAISE NOTICE 'La columna avatar_url ya existe en la tabla profiles.';
    END IF;
END $$;
