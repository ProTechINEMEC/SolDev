-- =====================================================
-- SolDev Coordinator Roles Migration
-- Adds Coordinador NT and Coordinador TI roles
-- =====================================================

-- =====================================================
-- 1. ADD COORDINATOR ROLES TO USER ENUM
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'coordinador_nt' AND enumtypid = 'rol_usuario'::regtype) THEN
    ALTER TYPE rol_usuario ADD VALUE 'coordinador_nt';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'coordinador_ti' AND enumtypid = 'rol_usuario'::regtype) THEN
    ALTER TYPE rol_usuario ADD VALUE 'coordinador_ti';
  END IF;
END$$;

-- =====================================================
-- 2. ADD NEW SOLICITUD STATES FOR COORDINATOR WORKFLOW
-- =====================================================

-- State for pending coordinator review (between NT evaluation and Gerencia)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pendiente_revision_coordinador_nt' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'pendiente_revision_coordinador_nt';
  END IF;
END$$;

-- Terminal state for coordinator rejection
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rechazado_coordinador_nt' AND enumtypid = 'estado_solicitud'::regtype) THEN
    ALTER TYPE estado_solicitud ADD VALUE 'rechazado_coordinador_nt';
  END IF;
END$$;

-- =====================================================
-- 3. EXTEND SOLICITUDES TABLE FOR COORDINATOR TRACKING
-- =====================================================

-- Track coordinator's suggested start date
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'fecha_sugerida_coordinador') THEN
    ALTER TABLE solicitudes ADD COLUMN fecha_sugerida_coordinador DATE;
  END IF;
END$$;

-- Track which coordinator reviewed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'coordinador_nt_id') THEN
    ALTER TABLE solicitudes ADD COLUMN coordinador_nt_id INTEGER REFERENCES usuarios(id);
  END IF;
END$$;

-- Track when coordinator reviewed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'fecha_revision_coordinador') THEN
    ALTER TABLE solicitudes ADD COLUMN fecha_revision_coordinador TIMESTAMP;
  END IF;
END$$;

-- Track coordinator's comment on approval/rejection
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes' AND column_name = 'comentario_coordinador') THEN
    ALTER TABLE solicitudes ADD COLUMN comentario_coordinador TEXT;
  END IF;
END$$;

-- =====================================================
-- 4. EXTEND TICKETS TABLE FOR COORDINATOR FEATURES
-- =====================================================

-- Track who reassigned the ticket (only coordinator can reassign)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'reasignado_por') THEN
    ALTER TABLE tickets ADD COLUMN reasignado_por INTEGER REFERENCES usuarios(id);
  END IF;
END$$;

-- Track when ticket was reassigned
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'fecha_reasignacion') THEN
    ALTER TABLE tickets ADD COLUMN fecha_reasignacion TIMESTAMP;
  END IF;
END$$;

-- Track if ticket was force-closed by coordinator
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'cerrado_forzado') THEN
    ALTER TABLE tickets ADD COLUMN cerrado_forzado BOOLEAN DEFAULT false;
  END IF;
END$$;

-- Track who force-closed the ticket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'cerrado_forzado_por') THEN
    ALTER TABLE tickets ADD COLUMN cerrado_forzado_por INTEGER REFERENCES usuarios(id);
  END IF;
END$$;

-- Track reason for force-close
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'motivo_cierre_forzado') THEN
    ALTER TABLE tickets ADD COLUMN motivo_cierre_forzado TEXT;
  END IF;
END$$;

-- Track original assignee before reassignment (for stats)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'asignado_anterior') THEN
    ALTER TABLE tickets ADD COLUMN asignado_anterior INTEGER REFERENCES usuarios(id);
  END IF;
END$$;

-- =====================================================
-- 5. CREATE COORDINATOR DECISION HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS decisiones_coordinador (
  id SERIAL PRIMARY KEY,

  -- Entity reference
  entidad_tipo VARCHAR(20) NOT NULL,  -- 'solicitud' or 'ticket'
  entidad_id INTEGER NOT NULL,
  entidad_codigo VARCHAR(20),

  -- Coordinator info
  coordinador_id INTEGER REFERENCES usuarios(id),
  tipo_coordinador VARCHAR(20) NOT NULL,  -- 'coordinador_nt' or 'coordinador_ti'

  -- Decision details
  accion VARCHAR(50) NOT NULL,  -- 'aprobar', 'rechazar', 'reevaluar', 'reasignar', 'cerrar_forzado'
  fecha_sugerida DATE,  -- For coordinador_nt approvals
  comentario TEXT,

  -- For ticket reassignments
  asignado_anterior_id INTEGER REFERENCES usuarios(id),
  asignado_nuevo_id INTEGER REFERENCES usuarios(id),

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisiones_entidad ON decisiones_coordinador(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_coordinador ON decisiones_coordinador(coordinador_id);
CREATE INDEX IF NOT EXISTS idx_decisiones_fecha ON decisiones_coordinador(creado_en);
CREATE INDEX IF NOT EXISTS idx_decisiones_accion ON decisiones_coordinador(accion);

-- =====================================================
-- 6. ADD INDEXES FOR COORDINATOR QUERIES
-- =====================================================

-- Index for coordinator review pending
CREATE INDEX IF NOT EXISTS idx_solicitudes_pendiente_coord ON solicitudes(estado)
WHERE estado = 'pendiente_revision_coordinador_nt';

-- Index for coordinator stats
CREATE INDEX IF NOT EXISTS idx_solicitudes_coordinador ON solicitudes(coordinador_nt_id);

-- Index for ticket reassignments
CREATE INDEX IF NOT EXISTS idx_tickets_reasignado ON tickets(reasignado_por);

-- Index for force-closed tickets
CREATE INDEX IF NOT EXISTS idx_tickets_cerrado_forzado ON tickets(cerrado_forzado)
WHERE cerrado_forzado = true;

-- =====================================================
-- 7. CREATE TEST COORDINATOR USERS
-- =====================================================

-- Password hash for 'coord123' using bcrypt
-- $2b$10$8K1p/a0dL1LXMw0YeYl6L.FzwLRNS/8KqPsIIZq0w0Ql0Y7WbsXGi

INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES
  ('Coordinador NT', 'coord.nt@inemec.com', '$2b$10$8K1p/a0dL1LXMw0YeYl6L.FzwLRNS/8KqPsIIZq0w0Ql0Y7WbsXGi', 'coordinador_nt', true),
  ('Coordinador TI', 'coord.ti@inemec.com', '$2b$10$8K1p/a0dL1LXMw0YeYl6L.FzwLRNS/8KqPsIIZq0w0Ql0Y7WbsXGi', 'coordinador_ti', true)
ON CONFLICT (email) DO UPDATE SET
  rol = EXCLUDED.rol,
  activo = EXCLUDED.activo;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
