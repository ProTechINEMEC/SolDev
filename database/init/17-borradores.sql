-- Borradores de solicitud (draft system)
-- Permite guardar progreso parcial del formulario de solicitudes NT

CREATE TABLE IF NOT EXISTS borradores_solicitud (
  id SERIAL PRIMARY KEY,
  solicitante_id INTEGER NOT NULL REFERENCES solicitantes(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  paso_actual INTEGER DEFAULT 0,
  datos_formulario JSONB NOT NULL DEFAULT '{}',
  titulo_borrador VARCHAR(200),
  expira_en TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_borradores_solicitante ON borradores_solicitud(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_borradores_expira ON borradores_solicitud(expira_en);

-- Auto-update timestamp trigger
CREATE TRIGGER update_borradores_timestamp BEFORE UPDATE ON borradores_solicitud
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
