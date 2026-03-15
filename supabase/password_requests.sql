-- =====================================================================
-- Tabla de Solicitudes de Cambio de Contraseña
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.password_requests (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  status      text NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'denied'
  created_at  timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.password_requests ENABLE ROW LEVEL SECURITY;

-- Empleado puede ver/crear sus propias solicitudes
CREATE POLICY "Users can manage own requests" ON public.password_requests
  FOR ALL USING (user_id = auth.uid());

-- Admin/SuperAdmin puede ver todas las solicitudes de su empresa
CREATE POLICY "Admins can view company requests" ON public.password_requests
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','superadmin')
  );

CREATE POLICY "Admins can update company requests" ON public.password_requests
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','superadmin')
  );
