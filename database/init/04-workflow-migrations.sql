-- =====================================================
-- SolDev Workflow System Migration
-- Adds tables and ENUM values for comprehensive workflow
-- =====================================================

-- =====================================================
-- 1. STATE ENUM EXTENSIONS
-- =====================================================

-- Add new solicitud states
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'en_estudio' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'en_estudio';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pendiente_reevaluacion' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'pendiente_reevaluacion';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'agendado' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'agendado';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'transferido_ti' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'transferido_ti';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'resuelto' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'resuelto';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'no_realizado' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'no_realizado';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'en_proceso' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'en_proceso';
  END IF;
END$$;

-- Add new ticket states
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'transferido_nt' AND enumtypid = 'estado_ticket'::regtype) THEN
    ALTER TYPE estado_ticket ADD VALUE 'transferido_nt';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'solucionado' AND enumtypid = 'estado_ticket'::regtype) THEN
    ALTER TYPE estado_ticket ADD VALUE 'solucionado';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'no_realizado' AND enumtypid = 'estado_ticket'::regtype) THEN
    ALTER TYPE estado_ticket ADD VALUE 'no_realizado';
  END IF;
END$$;

-- Add new tipo_solicitud for transfers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'transferido_ti' AND enumtypid = 'tipo_solicitud'::regtype) THEN
    ALTER TYPE tipo_solicitud ADD VALUE 'transferido_ti';
  END IF;
END$$;

-- =====================================================
-- 2. COLOMBIAN HOLIDAYS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS festivos_colombia (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL,  -- 'fijo', 'ley_emiliani', 'variable'
  ano INTEGER NOT NULL,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE(fecha)
);

CREATE INDEX IF NOT EXISTS idx_festivos_fecha ON festivos_colombia(fecha);
CREATE INDEX IF NOT EXISTS idx_festivos_ano ON festivos_colombia(ano);

-- =====================================================
-- 3. NT EVALUATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS evaluaciones_nt (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER REFERENCES solicitudes(id) ON DELETE CASCADE,
  evaluador_id INTEGER REFERENCES usuarios(id),

  -- Evaluation content
  resumen_ejecutivo TEXT,
  recomendacion VARCHAR(20),  -- 'aprobar', 'rechazar', 'aplazar'
  justificacion_recomendacion TEXT,

  -- Additional evaluation data
  datos_adicionales JSONB DEFAULT '{}',

  -- Status tracking
  estado VARCHAR(20) DEFAULT 'borrador',  -- 'borrador', 'enviado', 'aprobado', 'rechazado'
  enviado_en TIMESTAMP,

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_solicitud ON evaluaciones_nt(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_evaluador ON evaluaciones_nt(evaluador_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_estado ON evaluaciones_nt(estado);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS evaluaciones_timestamp ON evaluaciones_nt;
CREATE TRIGGER evaluaciones_timestamp
  BEFORE UPDATE ON evaluaciones_nt
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- 4. CRONOGRAMAS (GANTT CHARTS) TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS cronogramas (
  id SERIAL PRIMARY KEY,
  evaluacion_id INTEGER REFERENCES evaluaciones_nt(id) ON DELETE CASCADE,
  solicitud_id INTEGER REFERENCES solicitudes(id),

  -- Template info
  plantilla_origen VARCHAR(100),  -- 'proyecto_web_pequeno', 'proyecto_movil', etc.

  -- Dates
  fecha_inicio_propuesta DATE,
  fecha_fin_propuesta DATE,
  duracion_dias_habiles INTEGER,

  -- Full cronograma data (for flexibility)
  datos JSONB DEFAULT '{}',

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cronogramas_evaluacion ON cronogramas(evaluacion_id);
CREATE INDEX IF NOT EXISTS idx_cronogramas_solicitud ON cronogramas(solicitud_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS cronogramas_timestamp ON cronogramas;
CREATE TRIGGER cronogramas_timestamp
  BEFORE UPDATE ON cronogramas
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- 5. CRONOGRAMA TASKS (MILESTONES) TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS cronograma_tareas (
  id SERIAL PRIMARY KEY,
  cronograma_id INTEGER REFERENCES cronogramas(id) ON DELETE CASCADE,

  -- Task info
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  fase VARCHAR(50),  -- 'analisis', 'diseno', 'desarrollo', 'pruebas', 'documentacion', 'entrega'

  -- Duration (primary - dates calculated when scheduling)
  duracion_dias INTEGER NOT NULL DEFAULT 1,

  -- Dates (nullable - calculated when project is scheduled by Gerencia)
  fecha_inicio DATE,
  fecha_fin DATE,

  -- Dependencies (array of task string IDs like 'task-0', 'task-1')
  dependencias JSONB DEFAULT '[]',
  dependencia_ids INTEGER[] DEFAULT '{}',  -- Legacy support

  -- Assignment
  asignado_id INTEGER REFERENCES usuarios(id),

  -- Display
  orden INTEGER DEFAULT 0,
  color VARCHAR(7) DEFAULT '#1890ff',
  progreso INTEGER DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cronograma_tareas_cronograma ON cronograma_tareas(cronograma_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_tareas_fechas ON cronograma_tareas(fecha_inicio, fecha_fin);

-- =====================================================
-- 6. COST ESTIMATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS estimaciones_costo (
  id SERIAL PRIMARY KEY,
  evaluacion_id INTEGER REFERENCES evaluaciones_nt(id) ON DELETE CASCADE,

  -- Development costs
  desarrollo_interno_horas DECIMAL(10,2) DEFAULT 0,
  tarifa_hora DECIMAL(12,2) DEFAULT 0,

  -- Other costs
  infraestructura DECIMAL(12,2) DEFAULT 0,
  servicios_externos DECIMAL(12,2) DEFAULT 0,
  contingencia_porcentaje DECIMAL(5,2) DEFAULT 10,

  -- Total (calculated)
  total_estimado DECIMAL(14,2),

  -- Detailed breakdown
  desglose JSONB DEFAULT '{}',
  notas TEXT,

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimaciones_evaluacion ON estimaciones_costo(evaluacion_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS estimaciones_timestamp ON estimaciones_costo;
CREATE TRIGGER estimaciones_timestamp
  BEFORE UPDATE ON estimaciones_costo
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- 7. TEAM ASSIGNMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS evaluacion_asignaciones (
  id SERIAL PRIMARY KEY,
  evaluacion_id INTEGER REFERENCES evaluaciones_nt(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id),

  -- Role info
  rol VARCHAR(50) NOT NULL,  -- 'lider', 'desarrollador', 'analista', 'soporte'
  es_lider BOOLEAN DEFAULT false,
  horas_estimadas INTEGER,

  -- Timestamps
  fecha_asignacion TIMESTAMP DEFAULT NOW(),

  UNIQUE(evaluacion_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_evaluacion ON evaluacion_asignaciones(evaluacion_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario ON evaluacion_asignaciones(usuario_id);

-- =====================================================
-- 8. REEVALUATION COMMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS comentarios_reevaluacion (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER REFERENCES solicitudes(id) ON DELETE CASCADE,
  evaluacion_id INTEGER REFERENCES evaluaciones_nt(id),
  gerente_id INTEGER REFERENCES usuarios(id),

  -- Comment content
  tipo VARCHAR(20) NOT NULL,  -- 'solicitar_reevaluacion', 'comentario', 'aprobacion', 'rechazo'
  contenido TEXT NOT NULL,

  -- Areas to address (for reevaluation requests)
  areas_revisar JSONB DEFAULT '[]',

  -- Read tracking
  leido_por_nt BOOLEAN DEFAULT false,
  leido_en TIMESTAMP,

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reevaluacion_solicitud ON comentarios_reevaluacion(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_reevaluacion_evaluacion ON comentarios_reevaluacion(evaluacion_id);
CREATE INDEX IF NOT EXISTS idx_reevaluacion_gerente ON comentarios_reevaluacion(gerente_id);

-- =====================================================
-- 9. TRANSFERS TABLE (IT <-> NT)
-- =====================================================

CREATE TABLE IF NOT EXISTS transferencias (
  id SERIAL PRIMARY KEY,

  -- Transfer type
  tipo VARCHAR(20) NOT NULL,  -- 'ticket_a_solicitud', 'solicitud_a_ticket'

  -- Origin entity
  origen_tipo VARCHAR(20) NOT NULL,  -- 'ticket', 'solicitud'
  origen_id INTEGER NOT NULL,
  origen_codigo VARCHAR(20) NOT NULL,

  -- Destination entity
  destino_tipo VARCHAR(20) NOT NULL,  -- 'ticket', 'solicitud'
  destino_id INTEGER NOT NULL,
  destino_codigo VARCHAR(20) NOT NULL,

  -- Transfer details
  motivo TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transferencias_origen ON transferencias(origen_tipo, origen_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON transferencias(destino_tipo, destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_codigo_origen ON transferencias(origen_codigo);
CREATE INDEX IF NOT EXISTS idx_transferencias_codigo_destino ON transferencias(destino_codigo);

-- =====================================================
-- 10. ADD SCHEDULING COLUMNS TO SOLICITUDES
-- =====================================================

-- Add columns for scheduled projects
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'fecha_inicio_agendada') THEN
    ALTER TABLE solicitudes ADD COLUMN fecha_inicio_agendada DATE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'fecha_fin_estimada') THEN
    ALTER TABLE solicitudes ADD COLUMN fecha_fin_estimada DATE;
  END IF;
END$$;

-- Add column for reevaluation count
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'reevaluaciones_count') THEN
    ALTER TABLE solicitudes ADD COLUMN reevaluaciones_count INTEGER DEFAULT 0;
  END IF;
END$$;

-- =====================================================
-- 11. ADD TRANSFER REFERENCE TO TICKETS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'transferido_a_solicitud_id') THEN
    ALTER TABLE tickets ADD COLUMN transferido_a_solicitud_id INTEGER REFERENCES solicitudes(id);
  END IF;
END$$;

-- =====================================================
-- 12. ADD TRANSFER REFERENCE TO SOLICITUDES
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'transferido_a_ticket_id') THEN
    ALTER TABLE solicitudes ADD COLUMN transferido_a_ticket_id INTEGER REFERENCES tickets(id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'origen_ticket_id') THEN
    ALTER TABLE solicitudes ADD COLUMN origen_ticket_id INTEGER REFERENCES tickets(id);
  END IF;
END$$;

-- =====================================================
-- 13. ADDITIONAL INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes requested in the plan
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha_creacion ON solicitudes(creado_en);
CREATE INDEX IF NOT EXISTS idx_tickets_fecha_creacion ON tickets(creado_en);
CREATE INDEX IF NOT EXISTS idx_tickets_solicitante ON tickets(solicitante_id);

-- =====================================================
-- 14. SEED INITIAL COLOMBIAN HOLIDAYS FOR 2025 AND 2026
-- =====================================================

-- 2025 Holidays
INSERT INTO festivos_colombia (fecha, nombre, tipo, ano) VALUES
  -- Fixed holidays
  ('2025-01-01', 'Ano Nuevo', 'fijo', 2025),
  ('2025-05-01', 'Dia del Trabajo', 'fijo', 2025),
  ('2025-07-20', 'Dia de la Independencia', 'fijo', 2025),
  ('2025-08-07', 'Batalla de Boyaca', 'fijo', 2025),
  ('2025-12-08', 'Inmaculada Concepcion', 'fijo', 2025),
  ('2025-12-25', 'Navidad', 'fijo', 2025),

  -- Ley Emiliani holidays (moved to Monday)
  ('2025-01-06', 'Dia de los Reyes Magos', 'ley_emiliani', 2025),
  ('2025-03-24', 'San Jose', 'ley_emiliani', 2025),
  ('2025-06-30', 'San Pedro y San Pablo', 'ley_emiliani', 2025),
  ('2025-08-18', 'Asuncion de la Virgen', 'ley_emiliani', 2025),
  ('2025-10-13', 'Dia de la Raza', 'ley_emiliani', 2025),
  ('2025-11-03', 'Todos los Santos', 'ley_emiliani', 2025),
  ('2025-11-17', 'Independencia de Cartagena', 'ley_emiliani', 2025),

  -- Variable holidays (Easter-based) for 2025
  ('2025-04-17', 'Jueves Santo', 'variable', 2025),
  ('2025-04-18', 'Viernes Santo', 'variable', 2025),
  ('2025-06-02', 'Ascension del Senor', 'variable', 2025),
  ('2025-06-23', 'Corpus Christi', 'variable', 2025),
  ('2025-06-30', 'Sagrado Corazon', 'variable', 2025)
ON CONFLICT (fecha) DO NOTHING;

-- 2026 Holidays
INSERT INTO festivos_colombia (fecha, nombre, tipo, ano) VALUES
  -- Fixed holidays
  ('2026-01-01', 'Ano Nuevo', 'fijo', 2026),
  ('2026-05-01', 'Dia del Trabajo', 'fijo', 2026),
  ('2026-07-20', 'Dia de la Independencia', 'fijo', 2026),
  ('2026-08-07', 'Batalla de Boyaca', 'fijo', 2026),
  ('2026-12-08', 'Inmaculada Concepcion', 'fijo', 2026),
  ('2026-12-25', 'Navidad', 'fijo', 2026),

  -- Ley Emiliani holidays (moved to Monday)
  ('2026-01-12', 'Dia de los Reyes Magos', 'ley_emiliani', 2026),
  ('2026-03-23', 'San Jose', 'ley_emiliani', 2026),
  ('2026-06-29', 'San Pedro y San Pablo', 'ley_emiliani', 2026),
  ('2026-08-17', 'Asuncion de la Virgen', 'ley_emiliani', 2026),
  ('2026-10-12', 'Dia de la Raza', 'ley_emiliani', 2026),
  ('2026-11-02', 'Todos los Santos', 'ley_emiliani', 2026),
  ('2026-11-16', 'Independencia de Cartagena', 'ley_emiliani', 2026),

  -- Variable holidays (Easter-based) for 2026
  ('2026-04-02', 'Jueves Santo', 'variable', 2026),
  ('2026-04-03', 'Viernes Santo', 'variable', 2026),
  ('2026-05-18', 'Ascension del Senor', 'variable', 2026),
  ('2026-06-08', 'Corpus Christi', 'variable', 2026),
  ('2026-06-15', 'Sagrado Corazon', 'variable', 2026)
ON CONFLICT (fecha) DO NOTHING;

-- =====================================================
-- 15. ADD NOTIFICATION TYPE COLUMN IF NOT EXISTS
-- =====================================================

-- Notification types enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notificaciones' AND column_name = 'subtipo') THEN
    ALTER TABLE notificaciones ADD COLUMN subtipo VARCHAR(50);
  END IF;
END$$;

-- =====================================================
-- 16. ALTER CRONOGRAMA_TAREAS FOR DURATION-ONLY APPROACH
-- =====================================================

-- Make fecha_inicio and fecha_fin nullable (dates calculated when scheduling)
DO $$
BEGIN
  -- Alter fecha_inicio to be nullable
  ALTER TABLE cronograma_tareas ALTER COLUMN fecha_inicio DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  -- Alter fecha_fin to be nullable
  ALTER TABLE cronograma_tareas ALTER COLUMN fecha_fin DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END$$;

-- Add duracion_dias column if not exists with default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cronograma_tareas' AND column_name = 'duracion_dias') THEN
    ALTER TABLE cronograma_tareas ADD COLUMN duracion_dias INTEGER NOT NULL DEFAULT 1;
  END IF;
END$$;

-- Add fase column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cronograma_tareas' AND column_name = 'fase') THEN
    ALTER TABLE cronograma_tareas ADD COLUMN fase VARCHAR(50);
  END IF;
END$$;

-- Add dependencias JSONB column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cronograma_tareas' AND column_name = 'dependencias') THEN
    ALTER TABLE cronograma_tareas ADD COLUMN dependencias JSONB DEFAULT '[]';
  END IF;
END$$;

-- Add asignado_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cronograma_tareas' AND column_name = 'asignado_id') THEN
    ALTER TABLE cronograma_tareas ADD COLUMN asignado_id INTEGER REFERENCES usuarios(id);
  END IF;
END$$;

-- Make cronogramas dates nullable too (since we only store duration totals)
DO $$
BEGIN
  ALTER TABLE cronogramas ALTER COLUMN fecha_inicio_propuesta DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE cronogramas ALTER COLUMN fecha_fin_propuesta DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END$$;

-- Add nombre column to cronogramas if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cronogramas' AND column_name = 'nombre') THEN
    ALTER TABLE cronogramas ADD COLUMN nombre VARCHAR(200);
  END IF;
END$$;

-- Add fecha_inicio and fecha_fin columns (aliases) if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cronogramas' AND column_name = 'fecha_inicio') THEN
    ALTER TABLE cronogramas ADD COLUMN fecha_inicio DATE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cronogramas' AND column_name = 'fecha_fin') THEN
    ALTER TABLE cronogramas ADD COLUMN fecha_fin DATE;
  END IF;
END$$;

-- =====================================================
-- 17. ADD MISSING EVALUACIONES_NT COLUMNS
-- =====================================================

-- Add riesgos_identificados column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evaluaciones_nt' AND column_name = 'riesgos_identificados') THEN
    ALTER TABLE evaluaciones_nt ADD COLUMN riesgos_identificados JSONB DEFAULT '[]';
  END IF;
END$$;

-- Add notas_adicionales column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evaluaciones_nt' AND column_name = 'notas_adicionales') THEN
    ALTER TABLE evaluaciones_nt ADD COLUMN notas_adicionales TEXT;
  END IF;
END$$;

-- Add fecha_envio column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evaluaciones_nt' AND column_name = 'fecha_envio') THEN
    ALTER TABLE evaluaciones_nt ADD COLUMN fecha_envio TIMESTAMP;
  END IF;
END$$;

-- Add fecha_inicio_posible column if not exists (NT's recommended start date)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evaluaciones_nt' AND column_name = 'fecha_inicio_posible') THEN
    ALTER TABLE evaluaciones_nt ADD COLUMN fecha_inicio_posible DATE;
  END IF;
END$$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
