-- ============================================================
-- RLS para attendance_logs: permitir que el service_role
-- y la propia compañía puedan insertar/actualizar registros.
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Habilitar RLS (por si no estaba)
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- 2. Política SELECT: solo puede leer su propia compañía
DROP POLICY IF EXISTS "al_select" ON public.attendance_logs;
CREATE POLICY "al_select" ON public.attendance_logs
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- 3. Política INSERT: el propio operador O admin de la empresa
DROP POLICY IF EXISTS "al_insert" ON public.attendance_logs;
CREATE POLICY "al_insert" ON public.attendance_logs
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- 4. Política UPDATE: el propio operador O admin de la empresa
DROP POLICY IF EXISTS "al_update" ON public.attendance_logs;
CREATE POLICY "al_update" ON public.attendance_logs
  FOR UPDATE USING (
    profile_id = auth.uid()
    OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- 5. Verificar políticas activas
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'attendance_logs';
