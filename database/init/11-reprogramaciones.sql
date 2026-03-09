-- =====================================================
-- 11. REPROGRAMACIONES (Project Reschedule Requests)
-- Two-step approval: Coordinador NT → Gerencia
-- =====================================================

CREATE TABLE IF NOT EXISTS reprogramaciones (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  proyecto_codigo VARCHAR(20) NOT NULL,
  solicitante_id INTEGER NOT NULL REFERENCES usuarios(id),
  motivo TEXT NOT NULL,
  fecha_inicio_propuesta DATE NOT NULL,
  fecha_fin_propuesta DATE NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente_coordinador',
  -- Coordinador NT decision
  coordinador_id INTEGER REFERENCES usuarios(id),
  fecha_decision_coordinador TIMESTAMP,
  comentario_coordinador TEXT,
  fecha_inicio_coordinador DATE,
  fecha_fin_coordinador DATE,
  -- Gerencia decision
  gerencia_id INTEGER REFERENCES usuarios(id),
  fecha_decision_gerencia TIMESTAMP,
  comentario_gerencia TEXT,
  fecha_inicio_gerencia DATE,
  fecha_fin_gerencia DATE,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reprogramaciones_proyecto ON reprogramaciones(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_reprogramaciones_estado ON reprogramaciones(estado);
CREATE INDEX IF NOT EXISTS idx_reprogramaciones_solicitante ON reprogramaciones(solicitante_id);
