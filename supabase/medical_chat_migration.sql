-- ============================================================
-- Migración para el Chat Operativo Médico
-- Ejecutar en Supabase Studio -> SQL Editor
-- ============================================================

ALTER TABLE public.medical_services
  ADD COLUMN IF NOT EXISTS chat_messages JSONB DEFAULT '[]'::jsonb;
