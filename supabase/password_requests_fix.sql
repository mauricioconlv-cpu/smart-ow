-- =====================================================================
-- RPC pública: solicitar_acceso_por_telefono
-- Permite a un operador SIN sesión enviar solicitud de contraseña
-- usando solo su número de teléfono registrado.
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- Índice en profiles.phone para búsquedas rápidas (si no existe ya)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- Función RPC pública (SECURITY DEFINER = se ejecuta como superuser)
CREATE OR REPLACE FUNCTION public.solicitar_acceso_por_telefono(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile  profiles%ROWTYPE;
  v_existing password_requests%ROWTYPE;
BEGIN
  -- 1. Limpiar teléfono (solo dígitos)
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');

  IF length(p_phone) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Número de teléfono inválido.');
  END IF;

  -- 2. Buscar perfil por teléfono
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE phone = p_phone
  LIMIT 1;

  IF NOT FOUND THEN
    -- Respuesta genérica por seguridad (no revelar si el número existe)
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Si ese número está registrado, se notificará a tu administrador.'
    );
  END IF;

  -- 3. Solo operadores y empleados
  IF v_profile.role NOT IN ('operator', 'dispatcher', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este flujo es solo para operadores.');
  END IF;

  -- 4. Verificar solicitud pendiente existente
  SELECT * INTO v_existing
  FROM public.password_requests
  WHERE user_id = v_profile.id
    AND status  = 'pending'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success',   true,
      'message',   'Ya tienes una solicitud pendiente. Tu administrador ya fue notificado, espera su respuesta.',
      'employee',  v_profile.full_name
    );
  END IF;

  -- 5. Crear la solicitud
  INSERT INTO public.password_requests (user_id, company_id)
  VALUES (v_profile.id, v_profile.company_id);

  RETURN jsonb_build_object(
    'success',   true,
    'message',   'Solicitud enviada. Tu administrador recibirá la notificación y te ayudará a restablecer tu contraseña.',
    'employee',  v_profile.full_name
  );
END;
$$;

-- Permitir ejecución anónima (sin sesión)
GRANT EXECUTE ON FUNCTION public.solicitar_acceso_por_telefono(text) TO anon;
GRANT EXECUTE ON FUNCTION public.solicitar_acceso_por_telefono(text) TO authenticated;

-- Vista de solicitudes (útil para el dashboard del admin)
CREATE OR REPLACE VIEW public.password_requests_view AS
  SELECT
    pr.id,
    pr.status,
    pr.created_at,
    pr.resolved_at,
    pr.company_id,
    p.full_name  AS employee_name,
    p.phone      AS employee_phone,
    p.role       AS employee_role,
    rp.full_name AS resolved_by_name
  FROM public.password_requests pr
  LEFT JOIN public.profiles p  ON p.id  = pr.user_id
  LEFT JOIN public.profiles rp ON rp.id = pr.resolved_by;

GRANT SELECT ON public.password_requests_view TO authenticated;
