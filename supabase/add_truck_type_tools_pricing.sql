-- ============================================================
-- MIGRACIÓN COMPLETA Y AUTOCONTENIDA
-- Crea todas las tablas base si no existen, y agrega las nuevas columnas
-- Seguro de ejecutar varias veces (IF NOT EXISTS en todo)
-- ============================================================

-- 0. Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLAS BASE (se crean solo si no existen)
-- ============================================================

-- Empresas (Tenants)
CREATE TABLE IF NOT EXISTS public.companies (
  id         uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name       text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Perfiles (Usuarios)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'operator',
  full_name   text,
  grua_asignada text,
  created_at  timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles tenancy select" ON public.profiles;
CREATE POLICY "Profiles tenancy select" ON public.profiles
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "Profiles tenancy insert" ON public.profiles;
CREATE POLICY "Profiles tenancy insert" ON public.profiles
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Profiles tenancy update" ON public.profiles;
CREATE POLICY "Profiles tenancy update" ON public.profiles
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR id = auth.uid()
  );

-- Clientes / Aseguradoras
CREATE TABLE IF NOT EXISTS public.clients (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  created_at  timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenancy policy for clients" ON public.clients;
CREATE POLICY "Tenancy policy for clients" ON public.clients
  FOR ALL USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Reglas de Tarifas
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  client_id   uuid REFERENCES public.clients(id)   ON DELETE CASCADE NOT NULL,
  tipo        text NOT NULL,          -- 'local' | 'foraneo'
  costo_base  numeric NOT NULL DEFAULT 0,
  costo_km    numeric NOT NULL DEFAULT 0,
  created_at  timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenancy policy for pricing_rules" ON public.pricing_rules;
CREATE POLICY "Tenancy policy for pricing_rules" ON public.pricing_rules
  FOR ALL USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Servicios
CREATE TABLE IF NOT EXISTS public.services (
  id                  uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  folio               serial NOT NULL,
  company_id          uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  status              text NOT NULL DEFAULT 'creado',
  client_id           uuid REFERENCES public.clients(id) NOT NULL,
  operator_id         uuid REFERENCES public.profiles(id),
  origen_coords       jsonb,
  destino_coords      jsonb,
  distancia_km        numeric,
  tipo_servicio       text,
  costo_calculado     numeric,
  calidad_estrellas   integer,
  comentarios_calidad text,
  firma_url           text,
  created_at          timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at          timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenancy policy for services select" ON public.services;
CREATE POLICY "Tenancy policy for services select" ON public.services
  FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Tenancy policy for services insert" ON public.services;
CREATE POLICY "Tenancy policy for services insert" ON public.services
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Tenancy policy for services update" ON public.services;
CREATE POLICY "Tenancy policy for services update" ON public.services
  FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Grúas (Flotilla)
CREATE TABLE IF NOT EXISTS public.tow_trucks (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id      uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  brand           text NOT NULL,
  model           text NOT NULL,
  serial_number   text,
  economic_number text NOT NULL,
  plates          text NOT NULL,
  current_lat     numeric,
  current_lng     numeric,
  is_active       boolean DEFAULT true,
  created_at      timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tow_trucks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenancy policy for tow_trucks select"  ON public.tow_trucks;
DROP POLICY IF EXISTS "Tenancy policy for tow_trucks insert"  ON public.tow_trucks;
DROP POLICY IF EXISTS "Tenancy policy for tow_trucks update"  ON public.tow_trucks;
DROP POLICY IF EXISTS "Tenancy policy for tow_trucks delete"  ON public.tow_trucks;

CREATE POLICY "Tenancy policy for tow_trucks select" ON public.tow_trucks
  FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Tenancy policy for tow_trucks insert" ON public.tow_trucks
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Tenancy policy for tow_trucks update" ON public.tow_trucks
  FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Tenancy policy for tow_trucks delete" ON public.tow_trucks
  FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ============================================================
-- NUEVAS COLUMNAS (seguras — IF NOT EXISTS no falla si ya existen)
-- ============================================================

-- tow_trucks: tipo de unidad y herramientas
ALTER TABLE public.tow_trucks
  ADD COLUMN IF NOT EXISTS unit_type text CHECK (unit_type IN ('A', 'B', 'C', 'D')),
  ADD COLUMN IF NOT EXISTS tools     text[] DEFAULT '{}';

-- profiles: relación con grúa asignada
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tow_truck_id uuid REFERENCES public.tow_trucks(id) ON DELETE SET NULL;

-- pricing_rules: costos avanzados
ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS costo_tipo_a              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_tipo_b              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_tipo_c              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_tipo_d              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_maniobra            numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_hora_espera         numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_abanderamiento      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_resguardo           numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_dollys              numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_patines             numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_go_jacks            numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_rescate_subterraneo numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_adaptacion          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_1          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_2          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_3          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_4          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_5          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_6          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_blindaje_7          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_kg_carga            numeric DEFAULT 0;

-- services: expediente y extras del servicio
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS numero_expediente        text,
  ADD COLUMN IF NOT EXISTS requiere_maniobra        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requiere_paso_corriente  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS herramientas_usadas      text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS costo_desglose           jsonb   DEFAULT '{}';
