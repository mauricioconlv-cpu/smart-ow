-- ============================================================
-- Migración para Modularización de Servicios (Vial y Médico)
-- Ejecutar en Supabase Studio -> SQL Editor
-- ============================================================

-- 1. Añadir banderas a las solicitudes de registro
ALTER TABLE public.registration_requests 
  ADD COLUMN IF NOT EXISTS wants_tow_module BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS wants_medical_module BOOLEAN DEFAULT false;

-- 2. Añadir banderas a las compañías existentes (por defecto true para no romper accesos de las actuales)
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS has_tow_module BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_medical_module BOOLEAN DEFAULT true;
