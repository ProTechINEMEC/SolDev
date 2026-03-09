-- Add contratos column to usuarios (JSONB array of contract strings)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS contratos JSONB DEFAULT '[]';

-- Seed existing TI users with all contracts (backward compat)
UPDATE usuarios SET contratos = (
  SELECT COALESCE(jsonb_agg(valor), '[]')
  FROM opciones_formulario
  WHERE categoria = 'operacion_contrato' AND activo = true
)
WHERE rol IN ('ti', 'coordinador_ti') AND contratos = '[]';
