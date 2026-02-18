-- =============================================
-- SolDev Database Migrations
-- Additional tables and indexes for new features
-- =============================================

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expira_en TIMESTAMP NOT NULL,
  usado BOOLEAN DEFAULT false,
  usado_en TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_usuario ON password_reset_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expira ON password_reset_tokens(expira_en);

-- Full text search indexes for global search (Spanish configuration)
-- These improve search performance across main entities

-- Solicitudes full text search
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_solicitudes_search') THEN
    CREATE INDEX idx_solicitudes_search ON solicitudes USING gin(
      to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(codigo, ''))
    );
  END IF;
END $$;

-- Proyectos full text search
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_proyectos_search') THEN
    CREATE INDEX idx_proyectos_search ON proyectos USING gin(
      to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(codigo, '') || ' ' || coalesce(descripcion, ''))
    );
  END IF;
END $$;

-- Tickets full text search
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_search') THEN
    CREATE INDEX idx_tickets_search ON tickets USING gin(
      to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(codigo, '') || ' ' || coalesce(descripcion, ''))
    );
  END IF;
END $$;

-- Articulos full text search
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_articulos_search') THEN
    CREATE INDEX idx_articulos_search ON conocimiento_articulos USING gin(
      to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(resumen, '') || ' ' || coalesce(contenido, ''))
    );
  END IF;
END $$;
