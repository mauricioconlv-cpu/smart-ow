-- Agrega el nuevo status "contacto_usuario" al enum service_status
-- Se inserta lógicamente entre arribo_origen y contacto
-- PostgreSQL no permite insertar en posición específica; los valores se
-- agregan al final del enum pero el orden lógico lo manejan las apps.

ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'contacto_usuario';
