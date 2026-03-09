-- =====================================================
-- 12. IMPLEMENTACIÓN (Post-Development Implementation)
-- New states: en_implementacion, solucionado
-- Implementation tasks verified by NT, executed by requester
-- =====================================================

-- New project states
ALTER TYPE estado_proyecto ADD VALUE IF NOT EXISTS 'en_implementacion';
ALTER TYPE estado_proyecto ADD VALUE IF NOT EXISTS 'solucionado';

-- New solicitud state
ALTER TYPE estado_solicitud ADD VALUE IF NOT EXISTS 'solucionado';

-- Integration plan field on solicitudes
ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS integracion JSONB DEFAULT '{"fases": [], "tareas": []}';

-- Implementation tasks table
CREATE TABLE IF NOT EXISTS implementacion_tareas (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL,
  fase VARCHAR(50),
  duracion_dias INTEGER DEFAULT 1,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  progreso INTEGER DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  completada BOOLEAN DEFAULT false,
  orden INTEGER DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_implementacion_tareas_proyecto ON implementacion_tareas(proyecto_id);

-- Timestamp for when project was finalized
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_fin_implementacion TIMESTAMP;
