-- =====================================================
-- Migration: Add comment attachment support to archivos table
-- Adds comentario_id, origen, and respuesta_numero columns
-- =====================================================

-- Add comentario_id column to link files to comments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archivos' AND column_name = 'comentario_id') THEN
    ALTER TABLE archivos ADD COLUMN comentario_id INTEGER REFERENCES comentarios(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Add origen column to categorize file uploads by form section
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archivos' AND column_name = 'origen') THEN
    ALTER TABLE archivos ADD COLUMN origen VARCHAR(50) DEFAULT 'creacion';
  END IF;
END$$;

-- Add respuesta_numero for tracking response attachments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archivos' AND column_name = 'respuesta_numero') THEN
    ALTER TABLE archivos ADD COLUMN respuesta_numero INTEGER;
  END IF;
END$$;

-- Index for fast lookup of files by comment
CREATE INDEX IF NOT EXISTS idx_archivos_comentario_id ON archivos(comentario_id) WHERE comentario_id IS NOT NULL;
