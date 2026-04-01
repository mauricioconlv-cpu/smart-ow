-- Agregar soporte para servicios con cita
ALTER TABLE services 
ADD COLUMN is_scheduled boolean DEFAULT false;

ALTER TABLE services 
ADD COLUMN scheduled_at timestamp with time zone;
