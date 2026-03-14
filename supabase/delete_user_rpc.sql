-- RPC para borrar usuarios desde el Frontend de manera segura por un Admin/SuperAdmin
-- Evita tener que usar el Service Role Key, que es inseguro en aplicaciones SaaS cliente.

create or replace function public.delete_user(user_id uuid)
returns void
language plpgsql
security definer -- Esto hace que la función corra con privilegios de administrador (postgres)
as $$
declare
  admin_role text;
  admin_company uuid;
  target_company uuid;
begin
  -- 1. Verificar quién está ejecutando la función (El usuario logueado en la web)
  select role, company_id into admin_role, admin_company 
  from public.profiles 
  where id = auth.uid();

  -- 2. Verificar que quien ejecuta sea admin o superadmin
  if admin_role not in ('admin', 'superadmin') then
    raise exception 'No tienes permisos para eliminar usuarios. Se requiere rol Admin o SuperAdmin.';
  end if;

  -- 3. Si el que ejecuta es 'admin', debemos asegurar que el usuario a borrar sea de su MISMA empresa
  if admin_role = 'admin' then
    select company_id into target_company 
    from public.profiles 
    where id = user_id;

    if target_company != admin_company then
      raise exception 'Un administrador solo puede eliminar usuarios de su propia empresa.';
    end if;
  end if;

  -- 4. Impedir que un usuario se borre a sí mismo por error
  if auth.uid() = user_id then
    raise exception 'No puedes eliminar tu propia cuenta mientras estás logueado.';
  end if;

  -- 5. Proceder al borrado:
  -- Eliminar de auth.users (la tabla matriz). 
  -- Dado que tu tabla public.profiles tiene "ON DELETE CASCADE", 
  -- borrar auth.users borrará automáticamente su registro en perfiles.
  delete from auth.users where id = user_id;

end;
$$;
