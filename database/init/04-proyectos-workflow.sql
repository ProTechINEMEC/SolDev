-- =============================================
-- PROYECTOS WORKFLOW MIGRATIONS
-- =============================================

-- Add development tracking fields to solicitudes
ALTER TABLE solicitudes
ADD COLUMN IF NOT EXISTS fecha_inicio_desarrollo TIMESTAMP,
ADD COLUMN IF NOT EXISTS dias_pausados_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT,
ADD COLUMN IF NOT EXISTS cancelado_en TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancelado_por INTEGER REFERENCES usuarios(id);

-- Add progress and emergent flag to cronograma_tareas
ALTER TABLE cronograma_tareas
ADD COLUMN IF NOT EXISTS progreso INTEGER DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
ADD COLUMN IF NOT EXISTS es_emergente BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS completado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Create proyecto_pausas table to track all pauses
CREATE TABLE IF NOT EXISTS proyecto_pausas (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    fecha_inicio TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMP,
    motivo TEXT NOT NULL,
    dias_pausados INTEGER,
    creado_por INTEGER NOT NULL REFERENCES usuarios(id),
    creado_en TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_proyecto_pausas_solicitud ON proyecto_pausas(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_pausas_activa ON proyecto_pausas(solicitud_id) WHERE fecha_fin IS NULL;

-- Add lider_id to evaluaciones_nt if not exists
ALTER TABLE evaluaciones_nt
ADD COLUMN IF NOT EXISTS lider_id INTEGER REFERENCES usuarios(id);

-- Add pausado state to solicitud estado enum if not exists
DO $$
BEGIN
    -- Check if 'pausado' value exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'pausado'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'estado_solicitud')
    ) THEN
        ALTER TYPE estado_solicitud ADD VALUE IF NOT EXISTS 'pausado';
    END IF;

    -- Check if 'cancelado' value exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'cancelado'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'estado_solicitud')
    ) THEN
        ALTER TYPE estado_solicitud ADD VALUE IF NOT EXISTS 'cancelado';
    END IF;
END$$;

-- Function to calculate theoretical progress
CREATE OR REPLACE FUNCTION calcular_progreso_teorico(
    p_solicitud_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_fecha_inicio TIMESTAMP;
    v_dias_planificados INTEGER;
    v_dias_pausados INTEGER;
    v_dias_en_desarrollo INTEGER;
    v_progreso INTEGER;
BEGIN
    SELECT
        fecha_inicio_desarrollo,
        COALESCE(dias_pausados_total, 0),
        EXTRACT(DAY FROM (fecha_fin_programada - fecha_inicio_programada))::INTEGER
    INTO v_fecha_inicio, v_dias_pausados, v_dias_planificados
    FROM solicitudes
    WHERE id = p_solicitud_id;

    IF v_fecha_inicio IS NULL OR v_dias_planificados IS NULL OR v_dias_planificados = 0 THEN
        RETURN 0;
    END IF;

    -- Calculate working days in development (excluding paused days)
    v_dias_en_desarrollo := GREATEST(0, EXTRACT(DAY FROM (NOW() - v_fecha_inicio))::INTEGER - v_dias_pausados);

    -- Calculate percentage (max 100)
    v_progreso := LEAST(100, (v_dias_en_desarrollo * 100) / v_dias_planificados);

    RETURN v_progreso;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate practical progress (weighted average)
CREATE OR REPLACE FUNCTION calcular_progreso_practico(
    p_solicitud_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_progreso NUMERIC;
BEGIN
    SELECT
        CASE
            WHEN SUM(ct.duracion_dias) = 0 THEN 0
            ELSE ROUND(SUM(ct.progreso * ct.duracion_dias)::NUMERIC / SUM(ct.duracion_dias)::NUMERIC)
        END
    INTO v_progreso
    FROM cronograma_tareas ct
    JOIN cronogramas c ON c.id = ct.cronograma_id
    WHERE c.solicitud_id = p_solicitud_id;

    RETURN COALESCE(v_progreso, 0)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Function to get current active pause
CREATE OR REPLACE FUNCTION get_pausa_activa(
    p_solicitud_id INTEGER
) RETURNS TABLE (
    id INTEGER,
    fecha_inicio TIMESTAMP,
    motivo TEXT,
    dias_transcurridos INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.id,
        pp.fecha_inicio,
        pp.motivo,
        EXTRACT(DAY FROM (NOW() - pp.fecha_inicio))::INTEGER as dias_transcurridos
    FROM proyecto_pausas pp
    WHERE pp.solicitud_id = p_solicitud_id
    AND pp.fecha_fin IS NULL
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- View for project progress summary
CREATE OR REPLACE VIEW vista_proyectos_progreso AS
SELECT
    s.id,
    s.codigo,
    s.titulo,
    s.estado,
    s.prioridad,
    s.fecha_inicio_programada,
    s.fecha_fin_programada,
    s.fecha_inicio_desarrollo,
    s.dias_pausados_total,
    e.lider_id,
    u.nombre as lider_nombre,
    calcular_progreso_teorico(s.id) as progreso_teorico,
    calcular_progreso_practico(s.id) as progreso_practico,
    (SELECT COUNT(*) FROM cronograma_tareas ct JOIN cronogramas c ON c.id = ct.cronograma_id WHERE c.solicitud_id = s.id) as total_tareas,
    (SELECT COUNT(*) FROM cronograma_tareas ct JOIN cronogramas c ON c.id = ct.cronograma_id WHERE c.solicitud_id = s.id AND ct.completado = true) as tareas_completadas,
    (SELECT COUNT(*) FROM cronograma_tareas ct JOIN cronogramas c ON c.id = ct.cronograma_id WHERE c.solicitud_id = s.id AND ct.es_emergente = true) as tareas_emergentes,
    (SELECT pp.motivo FROM proyecto_pausas pp WHERE pp.solicitud_id = s.id AND pp.fecha_fin IS NULL LIMIT 1) as motivo_pausa_actual,
    (SELECT COUNT(*) FROM proyecto_pausas pp WHERE pp.solicitud_id = s.id) as total_pausas
FROM solicitudes s
LEFT JOIN evaluaciones_nt e ON e.solicitud_id = s.id AND e.estado = 'enviado'
LEFT JOIN usuarios u ON e.lider_id = u.id
WHERE s.tipo IN ('proyecto_nuevo_interno', 'proyecto_nuevo_externo', 'actualizacion')
AND s.estado IN ('agendado', 'en_desarrollo', 'pausado', 'completado', 'cancelado');

COMMENT ON VIEW vista_proyectos_progreso IS 'Vista consolidada de proyectos con progreso teórico y práctico';
