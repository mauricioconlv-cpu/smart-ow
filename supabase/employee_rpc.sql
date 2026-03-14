-- Habilitar extensión pgcrypto para encriptar contraseñas manualmente si se requiere insertar en auth.users
create extension if not exists "pgcrypto";

-- Función RPC para que un Admin cree cuentas de empleados sin desloguearse.
create or replace function public.create_employee_account(
  n_email text,
  n_password text,
  n_full_name text,
  n_role user_role,
  n_company_id uuid,
  n_grua text default null
)
returns void
language plpgsql
security definer
as $$
declare
  is_admin boolean;
  admin_company_id uuid;
  new_auth_id uuid;
begin
  -- 1. Validar Ejecutor: ¿Tiene el usuario actual (auth.uid()) permisos?
  select (role = 'superadmin' or role = 'admin'), company_id 
  into is_admin, admin_company_id
  from public.profiles 
  where id = auth.uid();
  
  if not is_admin then
    raise exception 'Exclusivo para administradores.';
  end if;

  -- 2. Validar Tenancy: Si no es superadmin, solo puede crear gente para su empresa.
  if (select role from public.profiles where id = auth.uid()) != 'superadmin' then
    if n_company_id != admin_company_id then
      raise exception 'Un administrador no puede crear credenciales fuera de su propia empresa.';
    end if;
  end if;

  -- 3. Crear en auth.users (Emulando el Sign Up pero desde adentro del servidor)
  new_auth_id := gen_random_uuid();
  
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) values (
    new_auth_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    n_email,
    crypt(n_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', n_full_name)
  );

  -- 4. CRÍTICO: Crear registro en auth.identities
  -- Sin esto, signInWithPassword falla silenciosamente aunque el usuario exista en auth.users
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    new_auth_id,
    new_auth_id,
    jsonb_build_object('sub', new_auth_id::text, 'email', n_email),
    'email',
    now(),
    now(),
    now()
  );

  -- 5. Crear el perfil en public.profiles
  insert into public.profiles (id, company_id, role, full_name, grua_asignada, tow_truck_id)
  values (new_auth_id, n_company_id, n_role, n_full_name, n_grua, 
    case when n_grua is not null then n_grua::uuid else null end);
  
end;
$$;

-- ============================================================
-- REPARACIÓN DE CUENTAS EXISTENTES SIN auth.identities
-- Ejecuta esto para arreglar a Dania y cualquier operador ya creado
-- ============================================================
insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select 
  u.id,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(),
  now(),
  now()
from auth.users u
where not exists (
  select 1 from auth.identities i where i.user_id = u.id
)
  and u.email is not null;
