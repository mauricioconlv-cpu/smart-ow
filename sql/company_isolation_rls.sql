-- Seguridad a nivel de base de datos: cada empresa solo ve sus propios datos
-- Esto es un failsafe adicional al filtro en el código

-- Política para tow_trucks: solo ver grúas de la misma empresa
DO $$
BEGIN
    -- SELECT: solo ver grúas de la misma empresa
    DROP POLICY IF EXISTS "Company isolation for tow_trucks SELECT" ON public.tow_trucks;
    CREATE POLICY "Company isolation for tow_trucks SELECT"
    ON public.tow_trucks FOR SELECT
    TO authenticated
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    );

    -- INSERT: solo insertar grúas en la propia empresa  
    DROP POLICY IF EXISTS "Company isolation for tow_trucks INSERT" ON public.tow_trucks;
    CREATE POLICY "Company isolation for tow_trucks INSERT"
    ON public.tow_trucks FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

    -- UPDATE: solo actualizar grúas de la propia empresa (o GPS de grúa asignada)
    DROP POLICY IF EXISTS "Company isolation for tow_trucks UPDATE" ON public.tow_trucks;
    CREATE POLICY "Company isolation for tow_trucks UPDATE"
    ON public.tow_trucks FOR UPDATE
    TO authenticated
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
    );

    -- DELETE: solo borrar grúas de la propia empresa
    DROP POLICY IF EXISTS "Company isolation for tow_trucks DELETE" ON public.tow_trucks;
    CREATE POLICY "Company isolation for tow_trucks DELETE"
    ON public.tow_trucks FOR DELETE
    TO authenticated
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );
END $$;

-- Igual para clients
DO $$
BEGIN
    DROP POLICY IF EXISTS "Company isolation for clients SELECT" ON public.clients;
    CREATE POLICY "Company isolation for clients SELECT"
    ON public.clients FOR SELECT
    TO authenticated
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    );

    DROP POLICY IF EXISTS "Company isolation for clients INSERT" ON public.clients;
    CREATE POLICY "Company isolation for clients INSERT"
    ON public.clients FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

    DROP POLICY IF EXISTS "Company isolation for clients UPDATE" ON public.clients;
    CREATE POLICY "Company isolation for clients UPDATE"
    ON public.clients FOR UPDATE
    TO authenticated
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

    DROP POLICY IF EXISTS "Company isolation for clients DELETE" ON public.clients;
    CREATE POLICY "Company isolation for clients DELETE"
    ON public.clients FOR DELETE
    TO authenticated
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );
END $$;

-- Igual para services
DO $$
BEGIN
    DROP POLICY IF EXISTS "Company isolation for services SELECT" ON public.services;
    CREATE POLICY "Company isolation for services SELECT"
    ON public.services FOR SELECT
    TO authenticated
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    );

    DROP POLICY IF EXISTS "Company isolation for services INSERT" ON public.services;
    CREATE POLICY "Company isolation for services INSERT"
    ON public.services FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

    DROP POLICY IF EXISTS "Company isolation for services UPDATE" ON public.services;
    CREATE POLICY "Company isolation for services UPDATE"
    ON public.services FOR UPDATE
    TO authenticated
    USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );
END $$;
