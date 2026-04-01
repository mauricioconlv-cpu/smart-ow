-- TABLA DE ASISTENCIA Y RENDIMIENTO DIARIO
CREATE TABLE public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clock_out_time TIMESTAMP WITH TIME ZONE,
    
    break_status TEXT DEFAULT 'active', -- 'active', 'on_break', 'completed'
    last_break_start TIMESTAMP WITH TIME ZONE,
    total_break_minutes INT DEFAULT 0,
    
    late_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Faltas, Vacaciones e Incapacidades
CREATE TABLE public.time_off_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id),
    type TEXT NOT NULL, -- 'vacaciones', 'permiso_goce', 'permiso_sin_goce', 'incapacidad'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'approved',
    evidence_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auditoria de cambios en horarios / nomina
CREATE TABLE public.schedule_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id),
    actor_id UUID REFERENCES public.profiles(id),
    target_profile_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL, -- e.g. 'horario_modificado', 'incapacidad_creada'
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Soporte para distinguir despachadores de "Nivel Supervisor"
ALTER TABLE public.profiles ADD COLUMN is_supervisor BOOLEAN DEFAULT false;

-- Creacion del repositorio de archivos (Bucket) para subir hojas membretadas del IMSS y recetas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payroll_evidences', 'payroll_evidences', true) 
ON CONFLICT (id) DO NOTHING;
