-- Función especial para crear el Súper Administrador y su Empresa Inicial.
-- Se ejecuta con privilegios de administrador (SECURITY DEFINER) para evadir RLS.
create or replace function public.setup_initial_tenant(new_company_name text, user_full_name text, target_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  is_first boolean;
  new_company_id uuid;
begin
  -- 1. Verificar si ya existe alguna empresa. Si sí, abortar (Seguridad).
  select count(*) = 0 into is_first from public.companies;
  
  if not is_first then
    return '{"error": "El sistema ya ha sido inicializado. Contacte a soporte."}'::jsonb;
  end if;

  if target_user_id is null then
    return '{"error": "Usuario no encontrado."}'::jsonb;
  end if;

  -- 2. Crear la Empresa
  insert into public.companies (name) values (new_company_name) returning id into new_company_id;

  -- 3. Insertar el Perfil Super Admin atado a esa empresa
  insert into public.profiles (id, company_id, role, full_name)
  values (target_user_id, new_company_id, 'superadmin', user_full_name);

  return '{"success": true}'::jsonb;
end;
$$;
