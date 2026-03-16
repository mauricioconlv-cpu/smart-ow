-- Agrega el campo booleano 'es_particular' a la tabla services
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS es_particular BOOLEAN DEFAULT false;

-- Opcionalmente, agregar un comentario para documentar
COMMENT ON COLUMN public.services.es_particular IS 'Indica si el servicio es para un particular (costo libre) en lugar de una aseguradora tabulada.';
