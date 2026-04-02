-- ====== Agregar nuevos campos de costo a la tabla pricing_rules ======

-- Costos para nuevos servicios
ALTER TABLE public.pricing_rules
ADD COLUMN IF NOT EXISTS costo_local_paso_corriente numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_bande_paso_corriente numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_km_paso_corriente numeric DEFAULT 0,

ADD COLUMN IF NOT EXISTS costo_local_cambio_llanta numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_bande_cambio_llanta numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_km_cambio_llanta numeric DEFAULT 0,

ADD COLUMN IF NOT EXISTS costo_local_gasolina numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_bande_gasolina numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_km_gasolina numeric DEFAULT 0,

-- Costos para las nuevas herramientas
ADD COLUMN IF NOT EXISTS costo_pistola_impacto numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_dardos numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_bidon numeric DEFAULT 0;
