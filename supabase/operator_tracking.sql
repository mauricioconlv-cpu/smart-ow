-- =====================================================================
-- Columnas necesarias para el sistema de placas y GPS del operador
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- Columna para el timestamp de la última actualización de ubicación
ALTER TABLE public.tow_trucks
  ADD COLUMN IF NOT EXISTS last_location_update timestamptz;

-- Columna grua_asignada en profiles (para el monitor en vivo)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grua_asignada text;

-- Verificar que tow_trucks tiene company_id
ALTER TABLE public.tow_trucks
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Política para que operadores puedan ver su propia grúa
DROP POLICY IF EXISTS "Operators can view their truck" ON public.tow_trucks;
CREATE POLICY "Operators can view their truck" ON public.tow_trucks
  FOR SELECT USING (
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );

-- Política para que el sistema actualice ubicación (usamos service role en el cliente)
-- La actualización de current_location y last_location_update viene del OperatorTracker
-- que usa el cliente Supabase normal con la sesión del operador.
-- Aseguramos que el operador pueda actualizar su propia grúa:
DROP POLICY IF EXISTS "Operators can update their truck location" ON public.tow_trucks;
CREATE POLICY "Operators can update their truck location" ON public.tow_trucks
  FOR UPDATE USING (
    id = (SELECT tow_truck_id FROM public.profiles WHERE id = auth.uid())
  );
