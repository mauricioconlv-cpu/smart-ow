-- Agregar columnas de latitud/longitud individuales a tow_trucks si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'tow_trucks' AND column_name = 'current_lat') THEN
        ALTER TABLE public.tow_trucks ADD COLUMN current_lat double precision;
        RAISE NOTICE 'Columna current_lat agregada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'tow_trucks' AND column_name = 'current_lng') THEN
        ALTER TABLE public.tow_trucks ADD COLUMN current_lng double precision;
        RAISE NOTICE 'Columna current_lng agregada.';
    END IF;
END $$;

-- Notificar a PostgREST para refrescar su cache de esquema
NOTIFY pgrst, 'reload schema';
