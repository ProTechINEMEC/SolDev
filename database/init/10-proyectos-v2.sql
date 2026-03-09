-- =============================================================================
-- 10-proyectos-v2.sql
-- Proyectos V2: workday-aware calculations, cancellation states, cost quantity,
-- pause estimated restart, drop SQL progress functions (replaced by JS).
-- =============================================================================

-- 1. New cancellation enum values
ALTER TYPE estado_proyecto ADD VALUE IF NOT EXISTS 'cancelado_coordinador';
ALTER TYPE estado_proyecto ADD VALUE IF NOT EXISTS 'cancelado_gerencia';

-- 2. Add cantidad to proyecto_costos and recreate total as (subtotal + iva) * cantidad
ALTER TABLE proyecto_costos ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1;

-- Drop old generated total column and recreate with quantity
ALTER TABLE proyecto_costos DROP COLUMN IF EXISTS total;
ALTER TABLE proyecto_costos ADD COLUMN total DECIMAL(14,2) GENERATED ALWAYS AS ((subtotal + iva) * cantidad) STORED;

-- 3. Add fecha_estimada_reanudacion to proyecto_pausas
ALTER TABLE proyecto_pausas ADD COLUMN IF NOT EXISTS fecha_estimada_reanudacion DATE;

-- 4. Drop SQL progress functions (replaced by JS workday-aware versions)
DROP FUNCTION IF EXISTS calcular_progreso_proyecto_teorico(INTEGER);
DROP FUNCTION IF EXISTS calcular_progreso_proyecto_practico(INTEGER);
