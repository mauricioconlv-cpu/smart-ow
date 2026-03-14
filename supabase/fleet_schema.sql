-- 1. Crear la tabla del Catálogo de Grúas (tow_trucks)
create table if not exists public.tow_trucks (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  brand text not null, -- Marca (Ej. Ford, Hino)
  model text not null, -- Modelo / Año
  serial_number text, -- VIN (opcional)
  economic_number text not null, -- Número económico interno (Ej. ECO-01)
  plates text not null, -- Placas de circulación
  current_lat numeric, -- Última latitud conocida (para el mapa)
  current_lng numeric, -- Última longitud conocida
  is_active boolean default true, -- Si está en servicio o en taller
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilitar y Configurar Row Level Security (RLS) para aislamiento por Empresa (SaaS Tenant)
alter table public.tow_trucks enable row level security;

create policy "Tenancy policy for tow_trucks select" on public.tow_trucks
  for select using (
    company_id = public.get_auth_company_id() or public.is_superadmin()
  );

create policy "Tenancy policy for tow_trucks insert" on public.tow_trucks
  for insert with check (
    company_id = public.get_auth_company_id() or public.is_superadmin()
  );

create policy "Tenancy policy for tow_trucks update" on public.tow_trucks
  for update using (
    company_id = public.get_auth_company_id() or public.is_superadmin()
  );

create policy "Tenancy policy for tow_trucks delete" on public.tow_trucks
  for delete using (
    company_id = public.get_auth_company_id() or public.is_superadmin()
  );

-- 3. Modificamos la tabla de profiles para que 'grua_asignada' apunte físicamente a esta tabla
-- Nota: Como 'grua_asignada' era tipo texto libre, añadiremos una nueva columna formal 'tow_truck_id'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tow_truck_id uuid references public.tow_trucks(id) on delete set null;
