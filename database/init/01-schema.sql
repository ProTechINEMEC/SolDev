-- =====================================================
-- Portal de Gestión de Proyectos y Conocimiento Tecnológico
-- Database Schema - SolDev
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- User roles
CREATE TYPE rol_usuario AS ENUM ('nuevas_tecnologias', 'ti', 'gerencia');

-- Request types
CREATE TYPE tipo_solicitud AS ENUM (
  'proyecto_nuevo_interno',
  'proyecto_nuevo_externo',
  'actualizacion',
  'reporte_fallo',
  'cierre_servicio'
);

-- Request states
CREATE TYPE estado_solicitud AS ENUM (
  'pendiente_evaluacion_nt',
  'descartado_nt',
  'pendiente_aprobacion_gerencia',
  'rechazado_gerencia',
  'aprobado',
  'en_desarrollo',
  'stand_by',
  'completado',
  'cancelado'
);

-- Ticket states
CREATE TYPE estado_ticket AS ENUM (
  'abierto',
  'en_proceso',
  'resuelto',
  'cerrado',
  'escalado_nt'
);

-- Ticket categories
CREATE TYPE categoria_ticket AS ENUM (
  'hardware',
  'software',
  'red',
  'acceso',
  'otro'
);

-- Priority levels
CREATE TYPE nivel_prioridad AS ENUM ('baja', 'media', 'alta', 'critica');

-- Project states
CREATE TYPE estado_proyecto AS ENUM (
  'planificacion',
  'en_desarrollo',
  'pausado',
  'completado',
  'cancelado'
);

-- Approval states
CREATE TYPE estado_aprobacion AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- =====================================================
-- TABLES
-- =====================================================

-- Users (NT, TI, Gerencia staff)
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol rol_usuario NOT NULL,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW(),
  ultimo_acceso TIMESTAMP
);

-- Sessions
CREATE TABLE sesiones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expira_en TIMESTAMP NOT NULL,
  activa BOOLEAN DEFAULT true,
  ip_address INET,
  user_agent TEXT,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- External requesters (verified by email)
CREATE TABLE solicitantes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  verificado BOOLEAN DEFAULT false,
  ultima_verificacion TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Verification codes for email
CREATE TABLE codigos_verificacion (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  codigo VARCHAR(6) NOT NULL,
  usado BOOLEAN DEFAULT false,
  intentos INTEGER DEFAULT 0,
  expira_en TIMESTAMP NOT NULL,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Temporary sessions for verified requesters
CREATE TABLE sesiones_solicitante (
  id SERIAL PRIMARY KEY,
  solicitante_id INTEGER REFERENCES solicitantes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expira_en TIMESTAMP NOT NULL,
  activa BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Solicitudes (all request types)
CREATE TABLE solicitudes (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  tipo tipo_solicitud NOT NULL,
  estado estado_solicitud DEFAULT 'pendiente_evaluacion_nt',
  prioridad nivel_prioridad DEFAULT 'media',
  titulo VARCHAR(200) NOT NULL,

  -- Relations
  solicitante_id INTEGER REFERENCES solicitantes(id),
  usuario_creador_id INTEGER REFERENCES usuarios(id),
  evaluador_id INTEGER REFERENCES usuarios(id),

  -- JSONB form data (10 sections)
  datos_solicitante JSONB DEFAULT '{}',
  datos_patrocinador JSONB DEFAULT '{}',
  datos_stakeholders JSONB DEFAULT '[]',
  descripcion_problema JSONB DEFAULT '{}',
  necesidad_urgencia JSONB DEFAULT '{}',
  solucion_propuesta JSONB DEFAULT '{}',
  beneficios JSONB DEFAULT '{}',
  kpis JSONB DEFAULT '[]',
  declaracion JSONB DEFAULT '{}',

  -- Rejection info
  motivo_rechazo TEXT,

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Projects (created from approved solicitudes)
CREATE TABLE proyectos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  solicitud_id INTEGER REFERENCES solicitudes(id),
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  estado estado_proyecto DEFAULT 'planificacion',

  -- Planning
  fecha_inicio_estimada DATE,
  fecha_fin_estimada DATE,
  fecha_inicio_real DATE,
  fecha_fin_real DATE,
  presupuesto_estimado DECIMAL(12, 2),
  presupuesto_real DECIMAL(12, 2),

  -- Relations
  responsable_id INTEGER REFERENCES usuarios(id),

  -- Extra data
  datos_proyecto JSONB DEFAULT '{}',

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Project tasks (for Gantt chart)
CREATE TABLE proyecto_tareas (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  progreso INTEGER DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  completada BOOLEAN DEFAULT false,
  asignado_id INTEGER REFERENCES usuarios(id),
  color VARCHAR(7) DEFAULT '#1890ff',
  orden INTEGER DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Project team members
CREATE TABLE proyecto_miembros (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_proyecto VARCHAR(50) DEFAULT 'miembro',
  asignado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE(proyecto_id, usuario_id)
);

-- Tickets (TI support)
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT NOT NULL,
  categoria categoria_ticket NOT NULL,
  estado estado_ticket DEFAULT 'abierto',
  prioridad nivel_prioridad DEFAULT 'media',

  -- Relations
  solicitante_id INTEGER REFERENCES solicitantes(id),
  usuario_creador_id INTEGER REFERENCES usuarios(id),
  asignado_id INTEGER REFERENCES usuarios(id),

  -- Solicitante data (for non-verified requesters)
  datos_solicitante JSONB DEFAULT '{}',

  -- Resolution
  resolucion TEXT,
  fecha_resolucion TIMESTAMP,

  -- Timestamps
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Approvals (Gerencia decisions)
CREATE TABLE aprobaciones (
  id SERIAL PRIMARY KEY,
  solicitud_id INTEGER REFERENCES solicitudes(id) ON DELETE CASCADE,
  aprobador_id INTEGER REFERENCES usuarios(id),
  estado estado_aprobacion DEFAULT 'pendiente',
  comentario TEXT,
  fecha_decision TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Comments (for solicitudes and tickets)
CREATE TABLE comentarios (
  id SERIAL PRIMARY KEY,
  entidad_tipo VARCHAR(20) NOT NULL CHECK (entidad_tipo IN ('solicitud', 'proyecto', 'ticket')),
  entidad_id INTEGER NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  contenido TEXT NOT NULL,
  tipo VARCHAR(20) DEFAULT 'comentario',
  interno BOOLEAN DEFAULT false,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- File attachments
CREATE TABLE archivos (
  id SERIAL PRIMARY KEY,
  entidad_tipo VARCHAR(20) NOT NULL CHECK (entidad_tipo IN ('solicitud', 'proyecto', 'ticket', 'articulo')),
  entidad_id INTEGER NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  nombre_almacenado VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  tamano INTEGER,
  ruta TEXT NOT NULL,
  subido_por INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT,
  datos JSONB DEFAULT '{}',
  leida BOOLEAN DEFAULT false,
  leida_en TIMESTAMP,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Change history (audit log)
CREATE TABLE historial_cambios (
  id SERIAL PRIMARY KEY,
  entidad_tipo VARCHAR(20) NOT NULL,
  entidad_id INTEGER NOT NULL,
  accion VARCHAR(50) NOT NULL,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_id INTEGER REFERENCES usuarios(id),
  ip_address INET,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Knowledge portal categories
CREATE TABLE conocimiento_categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  orden INTEGER DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Knowledge portal articles
CREATE TABLE conocimiento_articulos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  resumen TEXT,
  contenido TEXT NOT NULL,
  categoria_id INTEGER REFERENCES conocimiento_categorias(id),
  autor_id INTEGER REFERENCES usuarios(id),
  etiquetas TEXT[] DEFAULT '{}',
  publicado BOOLEAN DEFAULT false,
  vistas INTEGER DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW(),
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Weekly reports (auto-generated)
CREATE TABLE reportes_semanales (
  id SERIAL PRIMARY KEY,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  datos JSONB NOT NULL,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE(fecha_inicio)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Users
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- Sessions
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_token ON sesiones(token);
CREATE INDEX idx_sesiones_activa ON sesiones(activa);
CREATE INDEX idx_sesiones_expira ON sesiones(expira_en);

-- Solicitantes
CREATE INDEX idx_solicitantes_email ON solicitantes(email);

-- Verification codes
CREATE INDEX idx_codigos_email ON codigos_verificacion(email);
CREATE INDEX idx_codigos_expira ON codigos_verificacion(expira_en);

-- Solicitudes
CREATE INDEX idx_solicitudes_codigo ON solicitudes(codigo);
CREATE INDEX idx_solicitudes_tipo ON solicitudes(tipo);
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX idx_solicitudes_prioridad ON solicitudes(prioridad);
CREATE INDEX idx_solicitudes_solicitante ON solicitudes(solicitante_id);
CREATE INDEX idx_solicitudes_evaluador ON solicitudes(evaluador_id);
CREATE INDEX idx_solicitudes_creado ON solicitudes(creado_en);
CREATE INDEX idx_solicitudes_titulo_trgm ON solicitudes USING gin(titulo gin_trgm_ops);

-- Projects
CREATE INDEX idx_proyectos_codigo ON proyectos(codigo);
CREATE INDEX idx_proyectos_estado ON proyectos(estado);
CREATE INDEX idx_proyectos_responsable ON proyectos(responsable_id);
CREATE INDEX idx_proyectos_solicitud ON proyectos(solicitud_id);

-- Project tasks
CREATE INDEX idx_tareas_proyecto ON proyecto_tareas(proyecto_id);
CREATE INDEX idx_tareas_asignado ON proyecto_tareas(asignado_id);
CREATE INDEX idx_tareas_fechas ON proyecto_tareas(fecha_inicio, fecha_fin);

-- Tickets
CREATE INDEX idx_tickets_codigo ON tickets(codigo);
CREATE INDEX idx_tickets_estado ON tickets(estado);
CREATE INDEX idx_tickets_categoria ON tickets(categoria);
CREATE INDEX idx_tickets_asignado ON tickets(asignado_id);
CREATE INDEX idx_tickets_creado ON tickets(creado_en);
CREATE INDEX idx_tickets_prioridad ON tickets(prioridad);

-- Comments
CREATE INDEX idx_comentarios_entidad ON comentarios(entidad_tipo, entidad_id);
CREATE INDEX idx_comentarios_usuario ON comentarios(usuario_id);

-- Files
CREATE INDEX idx_archivos_entidad ON archivos(entidad_tipo, entidad_id);

-- Notifications
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_notificaciones_leida ON notificaciones(leida);

-- History
CREATE INDEX idx_historial_entidad ON historial_cambios(entidad_tipo, entidad_id);
CREATE INDEX idx_historial_usuario ON historial_cambios(usuario_id);
CREATE INDEX idx_historial_creado ON historial_cambios(creado_en);

-- Knowledge articles
CREATE INDEX idx_articulos_slug ON conocimiento_articulos(slug);
CREATE INDEX idx_articulos_categoria ON conocimiento_articulos(categoria_id);
CREATE INDEX idx_articulos_publicado ON conocimiento_articulos(publicado);
CREATE INDEX idx_articulos_titulo_trgm ON conocimiento_articulos USING gin(titulo gin_trgm_ops);
CREATE INDEX idx_articulos_etiquetas ON conocimiento_articulos USING gin(etiquetas);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_timestamp BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_solicitudes_timestamp BEFORE UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_proyectos_timestamp BEFORE UPDATE ON proyectos
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_tareas_timestamp BEFORE UPDATE ON proyecto_tareas
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_tickets_timestamp BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_articulos_timestamp BEFORE UPDATE ON conocimiento_articulos
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- INITIAL SEED DATA
-- =====================================================

-- Default admin user (password: Admin123!)
INSERT INTO usuarios (email, nombre, password_hash, rol) VALUES
  ('admin@inemec.com', 'Administrador NT', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.OPxJCMV.4k0zHy', 'nuevas_tecnologias');

-- Sample users for each role (password: Test123!)
INSERT INTO usuarios (email, nombre, password_hash, rol) VALUES
  ('nt@inemec.com', 'Usuario NT', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'nuevas_tecnologias'),
  ('ti@inemec.com', 'Usuario TI', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ti'),
  ('gerencia@inemec.com', 'Usuario Gerencia', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'gerencia');

-- Knowledge categories
INSERT INTO conocimiento_categorias (nombre, descripcion, orden) VALUES
  ('Guías Técnicas', 'Documentación técnica y guías de implementación', 1),
  ('Procedimientos', 'Procedimientos estándar de operación', 2),
  ('FAQ', 'Preguntas frecuentes', 3),
  ('Tutoriales', 'Tutoriales paso a paso', 4),
  ('Políticas', 'Políticas y normativas', 5);

-- Sample knowledge article
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, publicado, etiquetas)
VALUES (
  'Bienvenido al Portal de Conocimiento',
  'bienvenido-portal-conocimiento',
  'Introducción al Portal de Gestión de Proyectos y Conocimiento Tecnológico de INEMEC',
  '# Bienvenido al Portal de Conocimiento

Este portal centraliza la documentación técnica, guías y recursos de INEMEC S.A.

## Secciones Principales

- **Guías Técnicas**: Documentación técnica detallada
- **Procedimientos**: Procesos estandarizados
- **FAQ**: Respuestas a preguntas comunes
- **Tutoriales**: Guías paso a paso

## Cómo Usar el Portal

Navegue por las categorías o use la búsqueda para encontrar información específica.

Para solicitar nuevos artículos o reportar errores, contacte al equipo de Nuevas Tecnologías.',
  (SELECT id FROM conocimiento_categorias WHERE nombre = 'Guías Técnicas'),
  (SELECT id FROM usuarios WHERE email = 'admin@inemec.com'),
  true,
  ARRAY['introduccion', 'guia', 'inicio']
);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Note: Run these with superuser if needed
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO soldev_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO soldev_user;
