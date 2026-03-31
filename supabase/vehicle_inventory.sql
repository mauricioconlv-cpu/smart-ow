-- ══════════════════════════════════════════════════════════════
-- INVENTARIO DE VEHÍCULO — "Viaja Bajo Inventario"
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Nuevas columnas en services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS viaja_bajo_inventario  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inventario_antes        JSONB,
  ADD COLUMN IF NOT EXISTS inventario_despues      JSONB,
  ADD COLUMN IF NOT EXISTS inv_antes_fotos         TEXT[],
  ADD COLUMN IF NOT EXISTS inv_despues_fotos       TEXT[],
  ADD COLUMN IF NOT EXISTS inv_antes_firma         TEXT,
  ADD COLUMN IF NOT EXISTS inv_despues_firma       TEXT,
  ADD COLUMN IF NOT EXISTS inv_antes_guardado      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inv_despues_guardado    BOOLEAN DEFAULT FALSE;

-- 2. Tabla de ítems de inventario (configurable por empresa)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  seccion     TEXT NOT NULL CHECK (seccion IN ('exteriores','interiores','accesorios')),
  label       TEXT NOT NULL,
  orden       INTEGER DEFAULT 0,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para inventory_items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_can_read_inventory_items"
  ON public.inventory_items FOR SELECT
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "admin_can_manage_inventory_items"
  ON public.inventory_items FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','superadmin')
  );

-- 3. Storage bucket vehicle-inventory
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-inventory', 'vehicle-inventory', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated_upload_vehicle_inventory"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-inventory' AND auth.role() = 'authenticated');

CREATE POLICY "public_read_vehicle_inventory"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-inventory');

-- 4. Función para poblar ítems por defecto cuando se crea una empresa
-- (También se usa para insertar manualmente si ya tienes empresa)
CREATE OR REPLACE FUNCTION public.seed_inventory_items(p_company_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Solo insertar si no existen
  IF EXISTS (SELECT 1 FROM public.inventory_items WHERE company_id = p_company_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.inventory_items (company_id, seccion, label, orden) VALUES
  -- EXTERIORES
  (p_company_id, 'exteriores', 'Luces principales', 1),
  (p_company_id, 'exteriores', 'Luz media', 2),
  (p_company_id, 'exteriores', 'Luz stop / guiñadores', 3),
  (p_company_id, 'exteriores', 'Antena', 4),
  (p_company_id, 'exteriores', 'Limpia parabrisas (par)', 5),
  (p_company_id, 'exteriores', 'Espejo lateral izquierdo', 6),
  (p_company_id, 'exteriores', 'Espejo lateral derecho', 7),
  (p_company_id, 'exteriores', 'Vidrios laterales', 8),
  (p_company_id, 'exteriores', 'Parabrisas y ventana trasera', 9),
  (p_company_id, 'exteriores', 'Tapones de llanta', 10),
  (p_company_id, 'exteriores', 'Tapón de gasolina', 11),
  (p_company_id, 'exteriores', 'Carrocería sin golpes', 12),
  (p_company_id, 'exteriores', 'Parachoque delantero', 13),
  (p_company_id, 'exteriores', 'Parachoque trasero', 14),
  (p_company_id, 'exteriores', 'Placas delantera y trasera', 15),
  -- INTERIORES
  (p_company_id, 'interiores', 'Calefacción', 1),
  (p_company_id, 'interiores', 'Radio-CD', 2),
  (p_company_id, 'interiores', 'Alarmas', 3),
  (p_company_id, 'interiores', 'Velocímetro', 4),
  (p_company_id, 'interiores', 'Equipo transreceptor', 5),
  (p_company_id, 'interiores', 'Cancionero', 6),
  (p_company_id, 'interiores', 'Cinturones', 7),
  (p_company_id, 'interiores', 'Manijas de vidrios', 8),
  (p_company_id, 'interiores', 'Pisos de goma', 9),
  (p_company_id, 'interiores', 'Tapetes', 10),
  (p_company_id, 'interiores', 'Funda de asientos', 11),
  (p_company_id, 'interiores', 'Interior de puertas', 12),
  (p_company_id, 'interiores', 'Sujetador de manos', 13),
  -- ACCESORIOS
  (p_company_id, 'accesorios', 'Gata', 1),
  (p_company_id, 'accesorios', 'Llave de rueda', 2),
  (p_company_id, 'accesorios', 'Estuche de llaves', 3),
  (p_company_id, 'accesorios', 'Triángulo', 4),
  (p_company_id, 'accesorios', 'Llanta de auxilio', 5),
  (p_company_id, 'accesorios', 'Extintor', 6),
  (p_company_id, 'accesorios', 'Audifás', 7),
  (p_company_id, 'accesorios', 'SOAT', 8),
  (p_company_id, 'accesorios', 'Inspección técnica', 9);
END;
$$;

-- 5. Ejecutar seed para todas las empresas existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_inventory_items(r.id);
  END LOOP;
END;
$$;

-- Verificar
SELECT seccion, COUNT(*) FROM public.inventory_items GROUP BY seccion ORDER BY seccion;
