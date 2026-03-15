-- ============================================================
-- FIX: AGREGAR COLUMNAS FALTANTES PARA REPORTES Y CAPTURA
-- EJECUTAR EN EL EDITOR DE SQL DE SUPABASE
-- ============================================================

ALTER TABLE public.services 
  ADD COLUMN IF NOT EXISTS numero_expediente        text,
  ADD COLUMN IF NOT EXISTS insurance_folio          text,
  ADD COLUMN IF NOT EXISTS requiere_maniobra        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requiere_paso_corriente  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS herramientas_usadas      text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS costo_desglose           jsonb   DEFAULT '{}';

-- Recargar el caché de PostgREST para que los cambios sean visibles inmediatamente
NOTIFY pgrst, 'reload schema';

-- Verificación: Verificar que las columnas fueron creadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'services' 
  AND column_name IN (
    'numero_expediente', 
    'insurance_folio', 
    'requiere_maniobra', 
    'requiere_paso_corriente', 
    'herramientas_usadas', 
    'costo_desglose'
  );
