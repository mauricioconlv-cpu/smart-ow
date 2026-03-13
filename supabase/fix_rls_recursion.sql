-- 1. Crear funciones Helper Seguras.
-- Estas funciones evaden RLS de forma controlada ("security definer")
-- evitando el ciclo infinito al consultar la misma tabla en evaluación.

create or replace function public.get_auth_company_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select role = 'superadmin' from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select role = 'admin' from public.profiles where id = auth.uid();
$$;


-- 2. Eliminar las políticas defectuosas (Recursión Infinita)
drop policy if exists "Users can view profiles of their own company" on public.profiles;
drop policy if exists "Admins can insert profiles in their company" on public.profiles;
drop policy if exists "Admins can update profiles in their company" on public.profiles;


-- 3. Crear las nuevas políticas seguras libres de Loops
create policy "Users can view profiles of their own company" on public.profiles
  for select using (
    id = auth.uid() 
    or public.is_superadmin()
    or company_id = public.get_auth_company_id()
  );

create policy "Admins can insert profiles in their company" on public.profiles
  for insert with check (
    public.is_superadmin()
    or 
    (public.is_admin() and company_id = public.get_auth_company_id())
  );

create policy "Admins can update profiles in their company" on public.profiles
  for update using (
    public.is_superadmin()
    or 
    (public.is_admin() and company_id = public.get_auth_company_id())
  );
