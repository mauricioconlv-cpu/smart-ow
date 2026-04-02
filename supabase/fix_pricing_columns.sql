-- Corrección en los nombres de columnas para coincidir con la UI (tipo_X)
ALTER TABLE public.pricing_rules
ADD COLUMN IF NOT EXISTS costo_local_tipo_paso_corriente numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_bande_tipo_paso_corriente numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_km_tipo_paso_corriente numeric DEFAULT 0,

ADD COLUMN IF NOT EXISTS costo_local_tipo_cambio_llanta numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_bande_tipo_cambio_llanta numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_km_tipo_cambio_llanta numeric DEFAULT 0,

ADD COLUMN IF NOT EXISTS costo_local_tipo_gasolina numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_bande_tipo_gasolina numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_km_tipo_gasolina numeric DEFAULT 0;
