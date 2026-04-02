-- ======= Campos extra para captura de servicios de Asistencia =======

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS asistencia_birlo_seguridad boolean,
ADD COLUMN IF NOT EXISTS asistencia_llanta_refaccion boolean,
ADD COLUMN IF NOT EXISTS asistencia_observaciones text,

ADD COLUMN IF NOT EXISTS asistencia_tipo_combustible text,
ADD COLUMN IF NOT EXISTS asistencia_litros integer,
ADD COLUMN IF NOT EXISTS asistencia_pago_combustible text;
