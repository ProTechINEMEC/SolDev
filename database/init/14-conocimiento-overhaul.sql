-- =====================================================
-- Migration 14: Knowledge Base Overhaul
-- Adds visibility control, manual related articles, Manuales category
-- =====================================================

-- Add visibilidad column (JSONB array of roles that can see the article)
ALTER TABLE conocimiento_articulos ADD COLUMN IF NOT EXISTS visibilidad JSONB DEFAULT '["public"]';

-- Add articulos_relacionados column (manually selected related article IDs)
ALTER TABLE conocimiento_articulos ADD COLUMN IF NOT EXISTS articulos_relacionados INTEGER[] DEFAULT '{}';

-- Backfill existing articles with default visibility
UPDATE conocimiento_articulos SET visibilidad = '["public"]' WHERE visibilidad IS NULL;

-- Add Manuales category (orden 0 = appears first)
INSERT INTO conocimiento_categorias (nombre, descripcion, orden)
  VALUES ('Manuales', 'Manuales de usuario y guías del portal', 0)
  ON CONFLICT DO NOTHING;

-- Index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_articulos_visibilidad ON conocimiento_articulos USING gin(visibilidad);
