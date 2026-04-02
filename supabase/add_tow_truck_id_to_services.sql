-- Agregar columna tow_truck_id a la tabla services
-- Permite pre-seleccionar la grúa al crear el servicio, antes de asignar el operador

ALTER TABLE services 
  ADD COLUMN IF NOT EXISTS tow_truck_id UUID REFERENCES tow_trucks(id) ON DELETE SET NULL;

-- Índice para búsquedas de servicios activos por grúa
CREATE INDEX IF NOT EXISTS idx_services_tow_truck_id ON services(tow_truck_id) WHERE tow_truck_id IS NOT NULL;

-- Notificar a PostgREST que recargue el schema cache
NOTIFY pgrst, 'reload schema';
