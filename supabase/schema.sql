-- Habilitar extensión para UUIDs
create extension if not exists "uuid-ossp";

-- 1. Tabla Perfiles (Extendiendo auth.users)
create type user_role as enum ('admin', 'dispatcher', 'operator');

create table public.profiles (
  id uuid references auth.users not null primary key,
  role user_role default 'operator'::user_role not null,
  full_name text,
  grua_asignada text, -- ej. "Grua 01"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Asegurar que Row Level Security está activado
alter table public.profiles enable row level security;

-- Políticas temporales (se pueden afinar después)
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Trigger automatizado para crear perfil tras SignUp en Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', cast(coalesce(new.raw_user_meta_data->>'role', 'operator') as user_role));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Clientes (Aseguradoras / Particulares)
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null, -- Ej. Seguros AXA
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Reglas de Tarifas (Pricing Rules)
create type rule_type as enum ('local', 'foraneo');

create table public.pricing_rules (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  tipo rule_type not null,
  costo_base numeric not null default 0, -- Ej. 800 para local, o Banderazo para foráneo
  costo_km numeric not null default 0,   -- Ej. 0 para local, 25 para foráneo
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
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
  folio serial not null, -- Folio autoincremental
  status service_status default 'creado'::service_status not null,
  client_id uuid references public.clients(id) not null,
  operator_id uuid references public.profiles(id),
  
  -- Coordenadas origen y destino capturadas por call center
  origen_coords jsonb,  -- { lat: number, lng: number, address: string }
  destino_coords jsonb, -- { lat: number, lng: number, address: string }
  
  -- Campos de costeo
  distancia_km numeric,
  tipo_servicio rule_type,
  costo_calculado numeric,
  
  -- Cierre de servicio
  calidad_estrellas integer, -- 1 al 5
  comentarios_calidad text,
  firma_url text, -- URL en Supabase Storage
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Bitácora del Servicio (Logs y Eventos Inteligentes)
create type log_type as enum ('foto', 'audio_ptt', 'gps_hitch', 'system_note', 'panic_button');

create table public.service_logs (
  id uuid default uuid_generate_v4() primary key,
  service_id uuid references public.services(id) on delete cascade not null,
  created_by uuid references public.profiles(id),
  type log_type not null,
  resource_url text, -- URL si es foto o audio PTT
  note text,         -- Texto si es nota o JSON stringificado (como lat/lng)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
