-- Form System Migration
-- Adds opciones_formulario table and updates ENUMs

-- ============================================
-- 1. Create opciones_formulario table for dynamic dropdowns
-- ============================================
CREATE TABLE IF NOT EXISTS opciones_formulario (
  id SERIAL PRIMARY KEY,
  categoria VARCHAR(50) NOT NULL,          -- 'area', 'operacion_contrato', 'urgencia', etc.
  valor VARCHAR(100) NOT NULL,             -- Internal value (slug)
  etiqueta VARCHAR(200) NOT NULL,          -- Display label
  padre_id INTEGER REFERENCES opciones_formulario(id) ON DELETE CASCADE,  -- For hierarchical (subáreas)
  orden INTEGER DEFAULT 0,                 -- Sort order
  activo BOOLEAN DEFAULT true,             -- Soft delete
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_opciones_categoria ON opciones_formulario(categoria, activo);
CREATE INDEX IF NOT EXISTS idx_opciones_padre ON opciones_formulario(padre_id);

-- ============================================
-- 2. Add new ticket category for IT support
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'soporte_general' AND enumtypid = 'categoria_ticket'::regtype) THEN
    ALTER TYPE categoria_ticket ADD VALUE 'soporte_general';
  END IF;
END$$;

-- ============================================
-- 3. Migrate existing proyecto_nuevo_externo to proyecto_nuevo_interno
-- ============================================
UPDATE solicitudes
SET tipo = 'proyecto_nuevo_interno'
WHERE tipo = 'proyecto_nuevo_externo';

-- ============================================
-- 4. Seed initial data for Áreas
-- ============================================
INSERT INTO opciones_formulario (categoria, valor, etiqueta, orden) VALUES
  ('area', 'gerencia_general', 'Gerencia General', 1),
  ('area', 'operaciones', 'Operaciones', 2),
  ('area', 'administracion', 'Administración', 3),
  ('area', 'nuevas_tecnologias', 'Nuevas Tecnologías', 4),
  ('area', 'ti', 'Tecnología de la Información', 5),
  ('area', 'rrhh', 'Recursos Humanos', 6),
  ('area', 'hse', 'HSE', 7),
  ('area', 'calidad', 'Calidad', 8),
  ('area', 'compras', 'Compras', 9),
  ('area', 'contabilidad', 'Contabilidad', 10),
  ('area', 'mantenimiento', 'Mantenimiento', 11),
  ('area', 'logistica', 'Logística', 12),
  ('area', 'comercial', 'Comercial', 13),
  ('area', 'juridico', 'Jurídico', 14),
  ('area', 'proyectos', 'Proyectos', 15)
ON CONFLICT DO NOTHING;

-- Sub-áreas for Operaciones
INSERT INTO opciones_formulario (categoria, valor, etiqueta, padre_id, orden)
SELECT 'area', 'operaciones_planta', 'Planta', id, 1
FROM opciones_formulario WHERE valor = 'operaciones' AND categoria = 'area'
ON CONFLICT DO NOTHING;

INSERT INTO opciones_formulario (categoria, valor, etiqueta, padre_id, orden)
SELECT 'area', 'operaciones_campo', 'Campo', id, 2
FROM opciones_formulario WHERE valor = 'operaciones' AND categoria = 'area'
ON CONFLICT DO NOTHING;

INSERT INTO opciones_formulario (categoria, valor, etiqueta, padre_id, orden)
SELECT 'area', 'operaciones_taller', 'Taller', id, 3
FROM opciones_formulario WHERE valor = 'operaciones' AND categoria = 'area'
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. Seed initial data for Operaciones/Contratos
-- ============================================
INSERT INTO opciones_formulario (categoria, valor, etiqueta, orden) VALUES
  ('operacion_contrato', 'oficina_principal', 'Oficina Principal', 1),
  ('operacion_contrato', 'planta_barranca', 'Planta Barrancabermeja', 2),
  ('operacion_contrato', 'planta_cartagena', 'Planta Cartagena', 3),
  ('operacion_contrato', 'contrato_ecopetrol', 'Contrato Ecopetrol', 4),
  ('operacion_contrato', 'contrato_oxy', 'Contrato OXY', 5),
  ('operacion_contrato', 'contrato_gran_tierra', 'Contrato Gran Tierra', 6),
  ('operacion_contrato', 'contrato_parex', 'Contrato Parex', 7),
  ('operacion_contrato', 'contrato_frontera', 'Contrato Frontera Energy', 8),
  ('operacion_contrato', 'otro', 'Otro', 99)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. Seed Niveles de Urgencia
-- ============================================
INSERT INTO opciones_formulario (categoria, valor, etiqueta, orden) VALUES
  ('urgencia', 'inmediata', 'Inmediata (< 1 semana)', 1),
  ('urgencia', 'corto_plazo', 'Corto Plazo (1-4 semanas)', 2),
  ('urgencia', 'mediano_plazo', 'Mediano Plazo (1-3 meses)', 3),
  ('urgencia', 'largo_plazo', 'Largo Plazo (> 3 meses)', 4)
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. Seed Tipos de Solución
-- ============================================
INSERT INTO opciones_formulario (categoria, valor, etiqueta, orden) VALUES
  ('tipo_solucion', 'aplicacion_web', 'Aplicación Web', 1),
  ('tipo_solucion', 'aplicacion_movil', 'Aplicación Móvil', 2),
  ('tipo_solucion', 'automatizacion', 'Automatización de Proceso', 3),
  ('tipo_solucion', 'integracion', 'Integración de Sistemas', 4),
  ('tipo_solucion', 'reporte_dashboard', 'Reporte/Dashboard', 5),
  ('tipo_solucion', 'otro', 'Otro (especificar)', 99)
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. Seed Formas de Entrega
-- ============================================
INSERT INTO opciones_formulario (categoria, valor, etiqueta, orden) VALUES
  ('forma_entrega', 'web', 'Aplicación Web', 1),
  ('forma_entrega', 'movil', 'Aplicación Móvil', 2),
  ('forma_entrega', 'escritorio', 'Aplicación de Escritorio', 3),
  ('forma_entrega', 'reporte', 'Reporte Periódico', 4),
  ('forma_entrega', 'dashboard', 'Dashboard en Tiempo Real', 5),
  ('forma_entrega', 'api', 'API/Servicio', 6)
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. Seed Criticidad Levels
-- ============================================
INSERT INTO opciones_formulario (categoria, valor, etiqueta, orden) VALUES
  ('criticidad', 'baja', 'Baja - Impacto mínimo', 1),
  ('criticidad', 'media', 'Media - Afecta productividad', 2),
  ('criticidad', 'alta', 'Alta - Detiene procesos críticos', 3),
  ('criticidad', 'critica', 'Crítica - Impacto en seguridad/negocio', 4)
ON CONFLICT DO NOTHING;

-- ============================================
-- 10. Create trigger to update actualizado_en
-- ============================================
CREATE OR REPLACE FUNCTION update_opciones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opciones_timestamp ON opciones_formulario;
CREATE TRIGGER opciones_timestamp
  BEFORE UPDATE ON opciones_formulario
  FOR EACH ROW
  EXECUTE FUNCTION update_opciones_timestamp();
