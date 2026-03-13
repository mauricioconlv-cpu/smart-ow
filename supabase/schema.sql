-- Habilitar extensión para UUIDs
create extension if not exists "uuid-ossp";

-- 0. Limpieza (Peligro: Borra datos existentes, útil en Setup)
drop table if exists public.service_logs cascade;
drop table if exists public.services cascade;
drop table if exists public.pricing_rules cascade;
drop table if exists public.clients cascade;
drop table if exists public.profiles cascade;
drop table if exists public.companies cascade;
drop type if exists log_type cascade;
drop type if exists service_status cascade;
drop type if exists rule_type cascade;
drop type if exists user_role cascade;

-- 0. Tabla de Empresas (Inquilinos/Tenants)
create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null, -- Ej. Grúas Poncho
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.companies enable row level security;
-- Las empresas solo pueden ser vistas por sus propios usuarios (se define debajo) o creadas por un superadmin.

-- 1. Tabla Perfiles (Extendiendo auth.users)
create type user_role as enum ('superadmin', 'admin', 'dispatcher', 'operator');

create table public.profiles (
  id uuid references auth.users not null primary key,
  company_id uuid references public.companies(id) on delete cascade, -- Puede ser null para superadmin
  role user_role default 'operator'::user_role not null,
  full_name text,
  grua_asignada text, -- ej. "Grua 01"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Asegurar que Row Level Security está activado
alter table public.profiles enable row level security;

-- Política de Empresas: Una empresa puede ser vista si el usuario pertenece a ella o es superadmin.
create policy "Users can view their own company" on public.companies
  for select using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.company_id = companies.id)
    or
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'superadmin')
  );

-- Políticas de Perfiles (Usuarios del tenant)
create policy "Users can view profiles of their own company" on public.profiles
  for select using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or
    role = 'superadmin' -- Un superadmin ve todo
    or
    id = auth.uid() -- Se pueden ver a sí mismos
  );

create policy "Admins can insert profiles in their company" on public.profiles
  for insert with check (
    -- Un superadmin puede insertar perfiles con distintos company_id
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
    or
    -- Un admin de empresa solo puede insertar a su propia empresa
    ( (select role from public.profiles where id = auth.uid()) = 'admin' and company_id = (select company_id from public.profiles where id = auth.uid()) )
  );

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Admins can update profiles in their company" on public.profiles
  for update using (
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
    or
    ( (select role from public.profiles where id = auth.uid()) = 'admin' and company_id = (select company_id from public.profiles where id = auth.uid()) )
  );

-- Eliminar Trigger de validación abierto inicial, esto debe controlarse desde la API del Dashboard
-- El registro será manejado ahora exclusivamente por la vista Admin. (Se elimina el trigger simplón de la Fase 1).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();


-- 2. Clientes (Aseguradoras / Particulares)
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text not null, -- Ej. Seguros AXA
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.clients enable row level security;
create policy "Tenancy policy for clients" on public.clients
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- 3. Reglas de Tarifas (Pricing Rules)
create type rule_type as enum ('local', 'foraneo');

create table public.pricing_rules (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  tipo rule_type not null,
  costo_base numeric not null default 0,
  costo_km numeric not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.pricing_rules enable row level security;
create policy "Tenancy policy for pricing_rules" on public.pricing_rules
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- 4. Servicios Principales
create type service_status as enum (
  'creado',
  'rumbo_contacto',
  'arribo_origen',
  'contacto',
  'inicio_traslado',
  'traslado_concluido',
  'servicio_cerrado'
);

create table public.services (
  id uuid default uuid_generate_v4() primary key,
  folio serial not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  status service_status default 'creado'::service_status not null,
  client_id uuid references public.clients(id) not null,
  operator_id uuid references public.profiles(id),
  
  -- Coordenadas origen y destino capturadas por call center
  origen_coords jsonb,  
  destino_coords jsonb, 
  
  -- Campos de costeo
  distancia_km numeric,
  tipo_servicio rule_type,
  costo_calculado numeric,
  
  -- Cierre de servicio
  calidad_estrellas integer,
  comentarios_calidad text,
  firma_url text, 
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.services enable row level security;
create policy "Tenancy policy for services select" on public.services
  for select using (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );
create policy "Tenancy policy for services insert" on public.services
  for insert with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );
create policy "Tenancy policy for services update" on public.services
  for update using (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- 5. Bitácora del Servicio (Logs y Eventos Inteligentes)
create type log_type as enum ('foto', 'audio_ptt', 'gps_hitch', 'system_note', 'panic_button');

create table public.service_logs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete cascade not null,
  created_by uuid references public.profiles(id),
  type log_type not null,
  resource_url text,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.service_logs enable row level security;
create policy "Tenancy policy for service logs" on public.service_logs
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );
