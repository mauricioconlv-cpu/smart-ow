-- ============================================================
-- SQL DE MIGRACIÓN: Soporte Multi-Servicio (Fase 1: Asistencia Vial)
-- Añade tipos de vehículo, categorías de servicio y ajusta reglas básicas.
-- ============================================================

-- 1. Modificar tabla tow_trucks para soportar más tipos de vehículos
-- Agregamos la columna tipo_vehiculo si no existe.
ALTER TABLE public.tow_trucks ADD COLUMN IF NOT EXISTS tipo_vehiculo TEXT DEFAULT 'grua' NOT NULL;
ALTER TABLE public.tow_trucks ADD CONSTRAINT check_tipo_vehiculo CHECK (tipo_vehiculo IN ('grua', 'moto', 'utilitario'));

-- Opcional: renombrar la vista/referencia si es necesario en el futuro, por ahora usar el nombre legacy `tow_trucks`

-- 2. Modificar tabla services para soportar el nuevo concepto
-- Agregamos la categoría de servicio. Las existentes pasan a ser 'arrastre'.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS categoria_servicio TEXT DEFAULT 'arrastre' NOT NULL;
ALTER TABLE public.services ADD CONSTRAINT check_categoria_servicio CHECK (categoria_servicio IN ('arrastre', 'paso_corriente', 'cambio_llanta', 'gasolina'));

-- El destino_coords se asume que puede ser NULL para servicios viales
-- (Ya asumo que no tiene un constraint NOT NULL duro en tu esquema actual, pero lo enfatizamos visualmente en la app)

-- 3. Modificaciones en el tabulador (opcionalmente)
-- Si usamos pricing_rules, quizá haya que añadir categoria_servicio.
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS categoria_servicio TEXT;

-- 4. Actualizar estado y visibilidad de operadores
-- Confirmar que el rol de 'operator' aplica también para las motos. (Ya es un hecho)

-- Validar: Mostrar cómo quedó la tabla
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name IN ('tow_trucks', 'services') AND column_name IN ('tipo_vehiculo', 'categoria_servicio');
