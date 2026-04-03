-- ══════════════════════════════════════════════════════════════════════
-- MÓDULO DE SERVICIOS MÉDICOS — SmartTow
-- Ejecutar en: Supabase SQL Editor
-- Tablas: medical_providers, medical_services, medical_service_tokens
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- TABLA 1: Directorio de Doctores / Proveedores Médicos
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_providers (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    UUID        REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  full_name     TEXT        NOT NULL,
  cedula        TEXT,                         -- Cédula profesional / RFC
  phone         TEXT        NOT NULL,
  specialty     TEXT        DEFAULT 'Medicina General',
  service_types TEXT[]      DEFAULT ARRAY['medico_domicilio'], -- tipos que puede atender
  is_active     BOOLEAN     DEFAULT true,
  notes         TEXT,                         -- notas internas sobre el proveedor
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.medical_providers ENABLE ROW LEVEL SECURITY;

-- Solo miembros de la empresa pueden ver/gestionar su directorio
CREATE POLICY "medical_providers_company_select" ON public.medical_providers
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "medical_providers_company_insert" ON public.medical_providers
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "medical_providers_company_update" ON public.medical_providers
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "medical_providers_company_delete" ON public.medical_providers
  FOR DELETE USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );


-- ──────────────────────────────────────────────────────────────────────
-- TABLA 2: Servicios Médicos
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_services (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Folio y tipo
  folio         INTEGER     NOT NULL,
  folio_prefix  TEXT        NOT NULL CHECK (folio_prefix IN ('MD','RM','TM')),
  company_id    UUID        REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  service_type  TEXT        NOT NULL CHECK (service_type IN ('medico_domicilio','reparto_medicamento','telemedicina')),

  -- Status
  -- MD: cotizacion → programado → rumbo_consulta → en_sitio → contacto_paciente → en_consulta → concluido | cancelado
  -- RM: cotizacion → programado → preparando → en_camino → entregado → concluido | cancelado
  -- TM: cotizacion → programado → en_consulta → concluido | cancelado
  status        TEXT        NOT NULL DEFAULT 'cotizacion',

  -- Datos del paciente
  patient_name  TEXT        NOT NULL,
  patient_phone TEXT,
  patient_address TEXT,
  patient_coords  JSONB,                      -- { lat: ..., lng: ... }
  symptoms      TEXT,                         -- síntomas / motivo de consulta

  -- Doctor asignado (del directorio)
  doctor_provider_id UUID   REFERENCES public.medical_providers(id) ON DELETE SET NULL,
  doctor_lat    NUMERIC,                      -- GPS en tiempo real (browser)
  doctor_lng    NUMERIC,

  -- Programación
  scheduled_at  TIMESTAMPTZ,

  -- Datos administrativos
  aseguradora   TEXT,
  numero_expediente TEXT,

  -- ── COSTOS ───────────────────────────────────────────────────────────
  -- Internos (solo visibles para admin / superadmin / supervisor)
  costo_pago_proveedor NUMERIC DEFAULT 0,     -- Lo que pagamos al doctor/farmacia

  -- Por tipo de servicio
  costo_medicamento NUMERIC DEFAULT 0,        -- Precio farmacia (RM)
  costo_envio   NUMERIC DEFAULT 0,            -- Costo de envío  (RM)
  costo_consulta NUMERIC DEFAULT 0,           -- Consulta / domicilio / teleconsulta (MD, TM)

  -- Lo que cobramos al cliente / aseguradora
  cobro_cliente NUMERIC DEFAULT 0,

  -- ── FORMULARIO MÉDICO (llenado por el doctor durante la visita) ──────
  diagnostico   TEXT,
  tratamiento   TEXT,
  medicamento_recetado TEXT,
  signos_vitales JSONB,                       -- { presion, pulso, temperatura, saturacion }
  notas_medico  TEXT,
  firma_paciente_url TEXT,                    -- firma digital del paciente
  fotos_evidencia TEXT[],                     -- URLs de fotos

  -- ── SEGUIMIENTO ──────────────────────────────────────────────────────
  follow_up_notes TEXT,

  -- Trazabilidad
  created_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,

  UNIQUE (company_id, folio_prefix, folio)
);

ALTER TABLE public.medical_services ENABLE ROW LEVEL SECURITY;

-- RLS multi-tenant: empresa solo ve sus servicios
CREATE POLICY "medical_services_company_select" ON public.medical_services
  FOR SELECT USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "medical_services_company_insert" ON public.medical_services
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "medical_services_company_update" ON public.medical_services
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );


-- ──────────────────────────────────────────────────────────────────────
-- TRIGGER: Folio automático por empresa + prefijo
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_medical_folio()
RETURNS TRIGGER AS $$
DECLARE
  next_folio INTEGER;
BEGIN
  -- Bloquear fila de la empresa para evitar condición de carrera
  PERFORM 1 FROM public.companies WHERE id = NEW.company_id FOR UPDATE;

  -- Folio compartido entre todos los tipos médicos de la empresa
  SELECT COALESCE(MAX(folio), 0) + 1
    INTO next_folio
    FROM public.medical_services
   WHERE company_id = NEW.company_id;

  NEW.folio := next_folio;

  -- Asignar prefijo automáticamente según tipo
  NEW.folio_prefix := CASE NEW.service_type
    WHEN 'medico_domicilio'    THEN 'MD'
    WHEN 'reparto_medicamento' THEN 'RM'
    WHEN 'telemedicina'        THEN 'TM'
    ELSE 'MS'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_medical_folio ON public.medical_services;
CREATE TRIGGER trg_set_medical_folio
  BEFORE INSERT ON public.medical_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_medical_folio();


-- ──────────────────────────────────────────────────────────────────────
-- TRIGGER: Actualizar updated_at automáticamente
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_medical_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  -- Si pasa a concluido o cancelado, registrar closed_at
  IF NEW.status IN ('concluido','cancelado') AND OLD.status NOT IN ('concluido','cancelado') THEN
    NEW.closed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_medical_updated_at ON public.medical_services;
CREATE TRIGGER trg_medical_updated_at
  BEFORE UPDATE ON public.medical_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_medical_updated_at();


-- ──────────────────────────────────────────────────────────────────────
-- TABLA 3: Tokens de Acceso para Doctores (Magic Link + PIN)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medical_service_tokens (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id    UUID        REFERENCES public.medical_services(id) ON DELETE CASCADE NOT NULL,
  token         UUID        DEFAULT gen_random_uuid() NOT NULL UNIQUE, -- El token del link
  pin           TEXT        NOT NULL,             -- PIN de 4 dígitos (plain, el token ya es secreto)
  pin_attempts  INTEGER     DEFAULT 0,            -- Intentos fallidos (bloquear a los 5)
  is_active     BOOLEAN     DEFAULT true,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  accessed_at   TIMESTAMPTZ,                      -- Primera vez que ingresó correctamente
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Sin RLS en esta tabla: el acceso es completamente por token (no por auth.uid())
-- Las APIs de verificación usan service-role key y validan manualmente
ALTER TABLE public.medical_service_tokens ENABLE ROW LEVEL SECURITY;

-- Solo admins autenticados pueden ver/crear tokens (el doctor no pasa por RLS)
CREATE POLICY "tokens_company_access" ON public.medical_service_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.medical_services ms
      JOIN public.profiles p ON p.company_id = ms.company_id
      WHERE ms.id = medical_service_tokens.service_id
        AND p.id = auth.uid()
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );


-- ──────────────────────────────────────────────────────────────────────
-- TRIGGER: Desactivar token cuando el servicio se cierra
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deactivate_token_on_close()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('concluido','cancelado') AND OLD.status NOT IN ('concluido','cancelado') THEN
    UPDATE public.medical_service_tokens
       SET is_active = false
     WHERE service_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deactivate_token ON public.medical_services;
CREATE TRIGGER trg_deactivate_token
  AFTER UPDATE ON public.medical_services
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_token_on_close();


-- ──────────────────────────────────────────────────────────────────────
-- ÍNDICES DE RENDIMIENTO
-- ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medical_services_company    ON public.medical_services(company_id);
CREATE INDEX IF NOT EXISTS idx_medical_services_status     ON public.medical_services(status);
CREATE INDEX IF NOT EXISTS idx_medical_services_doctor     ON public.medical_services(doctor_provider_id);
CREATE INDEX IF NOT EXISTS idx_medical_services_created    ON public.medical_services(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_tokens_token        ON public.medical_service_tokens(token);
CREATE INDEX IF NOT EXISTS idx_medical_providers_company   ON public.medical_providers(company_id);


-- ──────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ──────────────────────────────────────────────────────────────────────
SELECT '=== TABLAS CREADAS ===' AS info;

SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns c 
        WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS columnas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('medical_providers','medical_services','medical_service_tokens')
ORDER BY table_name;

SELECT '=== TRIGGERS ===' AS info;
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%medical%'
ORDER BY event_object_table;
