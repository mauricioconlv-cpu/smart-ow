-- Nuevas columnas para el formulario de cierre mejorado
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS tipo_asistencia       text,   -- grua | corriente | llanta | gasolina
  ADD COLUMN IF NOT EXISTS tiempo_espera         text,   -- 0-45 | 45-60 | mas-60
  ADD COLUMN IF NOT EXISTS calidad_operador      text,   -- excelente | buena | regular | mala
  ADD COLUMN IF NOT EXISTS nombre_cliente_firma  text;   -- nombre escrito del cliente al firmar
