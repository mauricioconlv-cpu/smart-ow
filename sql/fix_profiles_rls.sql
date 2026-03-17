-- Fix profiles RLS to allow Company Admins to update their employees' profiles

DO $$
BEGIN
    -- Eliminar políticas previas para evitar conflictos (ajusta los nombres si son diferentes)
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Admins can update company profiles" ON public.profiles;
    DROP POLICY IF EXISTS "company_admin_all" ON public.profiles;
    DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Política 1: Todos pueden actualizar SU PROPIO perfil
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Política 2: Los administradores pueden actualizar CUALQUIER perfil de su misma empresa
CREATE POLICY "Admins can update company profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin', 'dispatcher')
);
