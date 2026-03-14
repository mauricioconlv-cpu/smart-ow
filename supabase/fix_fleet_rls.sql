-- ================================================================
-- FIX: Políticas RLS de tow_trucks para operaciones de Update/Delete
-- Problema: is_superadmin() puede devolver NULL en vez de TRUE en casos
--           donde el perfil no se encuentra, bloqueando silenciosamente.
-- Solución: Usar COALESCE y una condición directa sobre el rol.
-- ================================================================

-- 1. Eliminar políticas existentes
DROP POLICY IF EXISTS "Tenancy policy for tow_trucks update" ON public.tow_trucks;
DROP POLICY IF EXISTS "Tenancy policy for tow_trucks delete" ON public.tow_trucks;

-- 2. Re-crear política de UPDATE más robusta
CREATE POLICY "Tenancy policy for tow_trucks update" ON public.tow_trucks
  FOR UPDATE USING (
    company_id = public.get_auth_company_id()
    OR COALESCE(public.is_superadmin(), false) = true
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );

-- 3. Re-crear política de DELETE más robusta
CREATE POLICY "Tenancy policy for tow_trucks delete" ON public.tow_trucks
  FOR DELETE USING (
    company_id = public.get_auth_company_id()
    OR COALESCE(public.is_superadmin(), false) = true
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );
