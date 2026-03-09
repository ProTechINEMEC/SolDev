-- =============================================================================
-- 09-proyectos-overhaul.sql
-- Proyectos module overhaul: separate concerns from solicitudes, add costs,
-- Gantt support, emergent change auditing.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend proyecto_tareas
-- ---------------------------------------------------------------------------
ALTER TABLE proyecto_tareas
  ADD COLUMN IF NOT EXISTS fase VARCHAR(50),
  ADD COLUMN IF NOT EXISTS duracion_dias INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS es_emergente BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS es_bloqueado BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cronograma_tarea_id INTEGER REFERENCES cronograma_tareas(id),
  ADD COLUMN IF NOT EXISTS dependencias JSONB DEFAULT '[]';

-- ---------------------------------------------------------------------------
-- 2. Extend proyecto_miembros
-- ---------------------------------------------------------------------------
ALTER TABLE proyecto_miembros
  ADD COLUMN IF NOT EXISTS es_original BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS horas_estimadas INTEGER,
  ADD COLUMN IF NOT EXISTS es_lider BOOLEAN DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 3. Extend proyectos
-- ---------------------------------------------------------------------------
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS fecha_inicio_desarrollo TIMESTAMP,
  ADD COLUMN IF NOT EXISTS dias_pausados_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT,
  ADD COLUMN IF NOT EXISTS cancelado_en TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelado_por INTEGER REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS prioridad nivel_prioridad DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS evaluacion_id INTEGER REFERENCES evaluaciones_nt(id);

-- ---------------------------------------------------------------------------
-- 4. Extend proyecto_pausas (add proyecto_id alongside existing solicitud_id)
-- ---------------------------------------------------------------------------
ALTER TABLE proyecto_pausas
  ADD COLUMN IF NOT EXISTS proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. proyecto_costos — actual cost line items with optional PDF attachment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyecto_costos (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  concepto VARCHAR(300) NOT NULL,
  descripcion TEXT,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  iva DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) GENERATED ALWAYS AS (subtotal + iva) STORED,
  archivo_id INTEGER REFERENCES archivos(id),
  creado_por INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 6. proyecto_cambios_emergentes — audit trail for emergent changes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proyecto_cambios_emergentes (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tipo_cambio VARCHAR(50) NOT NULL,
  entidad_tipo VARCHAR(30) NOT NULL,
  entidad_id INTEGER,
  valor_anterior JSONB,
  valor_nuevo JSONB,
  justificacion TEXT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. Progress calculation functions
-- ---------------------------------------------------------------------------

-- Theoretical progress: time-based (days elapsed / planned, excluding pauses)
CREATE OR REPLACE FUNCTION calcular_progreso_proyecto_teorico(p_proyecto_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_fecha_inicio TIMESTAMP;
  v_fecha_fin DATE;
  v_fecha_inicio_est DATE;
  v_dias_pausados INTEGER;
  v_dias_planificados INTEGER;
  v_dias_en_desarrollo INTEGER;
BEGIN
  SELECT fecha_inicio_desarrollo, fecha_fin_estimada, fecha_inicio_estimada,
         COALESCE(dias_pausados_total, 0)
  INTO v_fecha_inicio, v_fecha_fin, v_fecha_inicio_est, v_dias_pausados
  FROM proyectos WHERE id = p_proyecto_id;

  IF v_fecha_inicio IS NULL OR v_fecha_inicio_est IS NULL OR v_fecha_fin IS NULL THEN
    RETURN 0;
  END IF;

  v_dias_planificados := GREATEST(1, v_fecha_fin - v_fecha_inicio_est);
  v_dias_en_desarrollo := GREATEST(0, (CURRENT_DATE - v_fecha_inicio::date) - v_dias_pausados);

  RETURN LEAST(100, ROUND((v_dias_en_desarrollo::numeric / v_dias_planificados) * 100));
END;
$$ LANGUAGE plpgsql STABLE;

-- Practical progress: task-weighted average from proyecto_tareas
CREATE OR REPLACE FUNCTION calcular_progreso_proyecto_practico(p_proyecto_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_total_peso NUMERIC;
  v_total_peso_progreso NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(duracion_dias, 1)), 0),
    COALESCE(SUM(COALESCE(progreso, 0) * COALESCE(duracion_dias, 1)), 0)
  INTO v_total_peso, v_total_peso_progreso
  FROM proyecto_tareas
  WHERE proyecto_id = p_proyecto_id;

  IF v_total_peso = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND(v_total_peso_progreso / v_total_peso);
END;
$$ LANGUAGE plpgsql STABLE;
