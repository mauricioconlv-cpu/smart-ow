-- Script para habilitar folios (secuencias) independientes por Empresa/Tenant

-- 1. Quitar el valor por defecto (la secuencia global) a la columna folio
ALTER TABLE public.services ALTER COLUMN folio DROP DEFAULT;

-- Opcional: Si quieres reiniciar los folios existentes a 1, 2, 3... por empresa 
-- (Si ya hay datos reales, NO uses esta sección comentada)
/*
WITH ranked_services AS (
  SELECT id, row_number() OVER(PARTITION BY company_id ORDER BY created_at ASC) as new_folio
  FROM public.services
)
UPDATE public.services s
SET folio = r.new_folio
FROM ranked_services r
WHERE s.id = r.id;
*/

-- 2. Crear la función del trigger para asignar folios por company_id
CREATE OR REPLACE FUNCTION set_company_folio()
RETURNS trigger AS $$
DECLARE
  next_folio integer;
BEGIN
  -- Bloqueamos (lock) la fila de la empresa en uso para evitar 
  -- que dos servicios creados al mismo segundo tengan el mismo folio (Race condition)
  PERFORM 1 FROM public.companies WHERE id = NEW.company_id FOR UPDATE;

  -- Obtenemos el folio máximo actual de la empresa, y le sumamos 1.
  -- Si es el primer servicio de la empresa, MAX retorna NULL y COALESCE lo convierte a 0,
  -- de modo que el primer folio será 1.
  -- (Si literalmente quieres que el primer folio sea '0', cambia el '0' del COALESCE por '-1')
  SELECT COALESCE(MAX(folio), 0) + 1 INTO next_folio
  FROM public.services
  WHERE company_id = NEW.company_id;
  
  NEW.folio := next_folio;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Asignar el trigger a la tabla de servicios
DROP TRIGGER IF EXISTS trg_set_company_folio ON public.services;
CREATE TRIGGER trg_set_company_folio
BEFORE INSERT ON public.services
FOR EACH ROW
EXECUTE FUNCTION set_company_folio();

-- 4. Opcional pero recomendado: Asegurar que nunca existan dos folios iguales para la misma empresa
ALTER TABLE public.services ADD CONSTRAINT services_company_folio_key UNIQUE (company_id, folio);
