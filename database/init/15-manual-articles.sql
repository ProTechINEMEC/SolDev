-- =====================================================
-- Migration 15: Manual Articles Seed (Rewritten)
-- 8 articles with INEMEC red only, detailed HTML mockups
-- =====================================================

DO $$
DECLARE
  v_cat_id INTEGER;
  v_admin_id INTEGER;
  v_art1 INTEGER;
  v_art2 INTEGER;
  v_art3 INTEGER;
  v_art4 INTEGER;
  v_art5 INTEGER;
  v_art6 INTEGER;
  v_art7 INTEGER;
  v_art8 INTEGER;
BEGIN

SELECT id INTO v_cat_id FROM conocimiento_categorias WHERE nombre = 'Manuales';
IF v_cat_id IS NULL THEN
  INSERT INTO conocimiento_categorias (nombre, descripcion, orden)
  VALUES ('Manuales', 'Manuales de usuario y guías del portal', 0)
  RETURNING id INTO v_cat_id;
END IF;

SELECT id INTO v_admin_id FROM usuarios WHERE email = 'admin';
IF v_admin_id IS NULL THEN
  SELECT id INTO v_admin_id FROM usuarios LIMIT 1;
END IF;

DELETE FROM conocimiento_articulos WHERE slug IN (
  'bienvenida-portal', 'manual-nt', 'manual-ti', 'manual-gerencia',
  'manual-coordinador-nt', 'manual-coordinador-ti', 'guia-formularios', 'guia-busqueda'
);

-- =====================================================
-- Article 1: Bienvenida al Portal
-- =====================================================
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, visibilidad)
VALUES (
  'Bienvenido al Portal de Gestión INEMEC',
  'bienvenida-portal',
  'Introducción al Portal de Gestión de Proyectos y Conocimiento Tecnológico de INEMEC S.A.',
  '<div>

<div style="background: linear-gradient(135deg, #D52B1E 0%, #8B1A12 100%); color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
  <h1 style="color: white; margin: 0; font-size: 2em;">Portal de Gestión INEMEC</h1>
  <p style="margin: 8px 0 0; font-size: 1.1em; opacity: 0.9;">Proyectos &bull; Tickets &bull; Conocimiento</p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">¿Qué es este Portal?</h2>
<p>El <strong>Portal de Gestión de Proyectos y Conocimiento Tecnológico</strong> es la herramienta central de INEMEC S.A. para administrar solicitudes de desarrollo, tickets de soporte TI, proyectos tecnológicos y la base de conocimiento de la organización.</p>
<p>A continuación se muestra la pantalla principal del portal, tal como la verá al ingresar:</p>

<!-- Landing Page Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 12px; overflow: hidden; margin: 24px 0;">
  <!-- Hero -->
  <div style="background: #1a1a1a; text-align: center; padding: 40px 20px; color: white;">
    <div style="font-size: 1.8em; font-weight: bold; margin-bottom: 8px;">Portal de Gestión de Tecnologías</div>
    <div style="color: rgba(255,255,255,0.85); font-size: 1.05em;">Plataforma centralizada para solicitudes de desarrollo, soporte técnico y documentación tecnológica</div>
  </div>
  <!-- Service Cards -->
  <div style="display: flex; gap: 16px; padding: 24px; flex-wrap: wrap;">
    <div style="flex: 1; min-width: 200px; border: 1px solid #f0f0f0; border-radius: 8px; padding: 24px; text-align: center;">
      <div style="font-size: 2em; color: #D52B1E; margin-bottom: 8px;">📋</div>
      <div style="font-weight: 600; margin-bottom: 4px;">Proyectos de Nuevas Tecnologías</div>
      <div style="color: #8c8c8c; font-size: 0.9em;">Envíe solicitudes para nuevos proyectos de desarrollo, actualizaciones de sistemas existentes o reportes de fallas técnicas.</div>
      <div style="margin-top: 12px;"><span style="background: #D52B1E; color: white; padding: 4px 16px; border-radius: 6px; font-size: 0.9em;">Nueva Solicitud</span></div>
    </div>
    <div style="flex: 1; min-width: 200px; border: 1px solid #f0f0f0; border-radius: 8px; padding: 24px; text-align: center;">
      <div style="font-size: 2em; color: #52c41a; margin-bottom: 8px;">🔧</div>
      <div style="font-weight: 600; margin-bottom: 4px;">Soporte Técnico General</div>
      <div style="color: #8c8c8c; font-size: 0.9em;">Cree tickets de soporte para problemas de hardware, software, red, accesos o cualquier incidencia técnica.</div>
      <div style="margin-top: 12px;"><span style="background: #D52B1E; color: white; padding: 4px 16px; border-radius: 6px; font-size: 0.9em;">Crear Ticket</span></div>
    </div>
    <div style="flex: 1; min-width: 200px; border: 1px solid #f0f0f0; border-radius: 8px; padding: 24px; text-align: center;">
      <div style="font-size: 2em; color: #722ed1; margin-bottom: 8px;">📖</div>
      <div style="font-weight: 600; margin-bottom: 4px;">Portal de Conocimiento</div>
      <div style="color: #8c8c8c; font-size: 0.9em;">Acceda a guías, manuales, documentación técnica y recursos de capacitación de la organización.</div>
      <div style="margin-top: 12px;"><span style="background: #D52B1E; color: white; padding: 4px 16px; border-radius: 6px; font-size: 0.9em;">Explorar</span></div>
    </div>
  </div>
  <!-- Status Check CTA -->
  <div style="background: #1a1a1a; text-align: center; padding: 24px;">
    <div style="font-weight: 600; color: white; margin-bottom: 4px;">¿Ya tiene una solicitud?</div>
    <div style="color: rgba(255,255,255,0.85); margin-bottom: 12px;">Ingrese el código de su solicitud para consultar el estado actual</div>
    <span style="background: #D52B1E; color: white; padding: 8px 24px; border-radius: 6px; font-size: 1em;">🔍 Consultar Estado de Solicitud</span>
  </div>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Funciones</h2>
<p>Cualquier empleado de INEMEC puede acceder a las siguientes funcionalidades <strong>sin necesidad de iniciar sesión</strong>:</p>

<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <thead>
    <tr style="background: #D52B1E; color: white;">
      <th style="padding: 10px 12px; text-align: left;">Función</th>
      <th style="padding: 10px 12px; text-align: left;">Descripción</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px 12px;"><strong>Crear solicitudes NT</strong></td>
      <td style="padding: 10px 12px;">Formularios para solicitar proyectos nuevos, actualizaciones, reportar fallos o cerrar servicios</td>
    </tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;">
      <td style="padding: 10px 12px;"><strong>Crear tickets TI</strong></td>
      <td style="padding: 10px 12px;">Reportar problemas de hardware, software, red o accesos al equipo de soporte</td>
    </tr>
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px 12px;"><strong>Consultar estado</strong></td>
      <td style="padding: 10px 12px;">Seguimiento por código de solicitud (SOL-), ticket (TKT-) o proyecto (PRY-)</td>
    </tr>
    <tr style="background: #fafafa;">
      <td style="padding: 10px 12px;"><strong>Portal de conocimiento</strong></td>
      <td style="padding: 10px 12px;">Acceso a artículos públicos, guías y manuales de la organización</td>
    </tr>
  </tbody>
</table>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Ciclo de Vida de un Proyecto</h2>
<p>Las solicitudes aprobadas se convierten en proyectos que siguen un ciclo de vida completo, incluyendo una <strong>fase de implementación</strong> posterior al desarrollo:</p>
<div style="background: #fafafa; border-radius: 8px; padding: 16px; margin: 16px 0; overflow-x: auto; font-family: monospace; font-size: 0.85em;">
  planificación → en_desarrollo → en_implementación → solucionado
  <div style="color: #8c8c8c; font-family: sans-serif; margin-top: 4px;">También: pausado, cancelado</div>
</div>
<p>La fase de <strong>Implementación</strong> cuenta con su propio conjunto de tareas (derivadas del Plan de Implementación de la solicitud original), un diagrama Gantt de seguimiento, y avance porcentual. Todas las tareas de implementación deben alcanzar el 100% antes de que el proyecto pueda ser finalizado.</p>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Administración del Portal</h2>
<p>Los usuarios con rol <strong>Administrador</strong> tienen acceso a una sección de <strong>Configuración</strong> donde pueden gestionar las opciones dinámicas utilizadas en los formularios del portal:</p>
<ul>
  <li><strong>Áreas y subáreas</strong> — Opciones de área organizacional para formularios</li>
  <li><strong>Niveles de urgencia</strong> — Opciones de urgencia disponibles en solicitudes</li>
  <li><strong>Tipos de solución</strong> — Categorías de solución para evaluaciones</li>
  <li><strong>Formas de entrega</strong> — Opciones de entrega de proyectos</li>
  <li><strong>Niveles de criticidad</strong> — Opciones de criticidad para reportes de fallo y tickets</li>
</ul>
<p>El administrador puede <strong>agregar, editar, desactivar y restaurar</strong> cada opción. Las opciones desactivadas dejan de aparecer en los formularios pero se conservan en el historial.</p>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
  <strong>Consejo:</strong> Explore los artículos en el Portal de Conocimiento para aprender a usar cada funcionalidad del sistema. La <em>Guía de Formularios</em> y la <em>Guía de Consulta por Código</em> explican paso a paso cada proceso.
</div>

</div>',
  v_cat_id, v_admin_id,
  ARRAY['manual', 'bienvenida', 'inicio', 'guia'],
  true, '["public"]'
) RETURNING id INTO v_art1;

-- =====================================================
-- Article 2: Manual NT
-- =====================================================
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, visibilidad)
VALUES (
  'Manual de Usuario — Nuevas Tecnologías',
  'manual-nt',
  'Guía completa para usuarios del rol Nuevas Tecnologías: solicitudes, evaluaciones, proyectos y cronogramas.',
  '<div>

<div style="background: linear-gradient(135deg, #D52B1E 0%, #8B1A12 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
  <h1 style="color: white; margin: 0;">Manual — Nuevas Tecnologías</h1>
  <p style="margin: 8px 0 0; opacity: 0.9;">Guía completa de funcionalidades para el rol NT</p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">1. Panel de Control (Dashboard)</h2>
<p>Al iniciar sesión, verá un panel con estadísticas rápidas y accesos directos:</p>

<!-- Dashboard Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 12px; font-size: 1.1em;">Dashboard - Nuevas Tecnologías</div>
  <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #faad14; font-size: 1.5em;">⏱</div>
      <div style="font-size: 1.4em; font-weight: bold;">5</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Pendientes Evaluación</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #D52B1E; font-size: 1.5em;">⚠</div>
      <div style="font-size: 1.4em; font-weight: bold;">2</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Esperando Gerencia</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #52c41a; font-size: 1.5em;">📁</div>
      <div style="font-size: 1.4em; font-weight: bold;">8</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Proyectos Activos</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #D52B1E; font-size: 1.5em;">🔧</div>
      <div style="font-size: 1.4em; font-weight: bold;">1</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Tickets Escalados</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #722ed1; font-size: 1.5em;">📄</div>
      <div style="font-size: 1.4em; font-weight: bold;">3</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Nuevas (7 días)</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #52c41a; font-size: 1.5em;">✓</div>
      <div style="font-size: 1.4em; font-weight: bold;">24</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Completadas</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #1890ff; font-size: 1.5em;">📅</div>
      <div style="font-size: 1.4em; font-weight: bold;">4</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Tareas para Hoy</div>
    </div>
  </div>
  <div style="display: flex; gap: 12px; flex-wrap: wrap;">
    <div style="flex: 1.5; min-width: 250px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
      <div style="font-weight: 600; margin-bottom: 8px;">Solicitudes Pendientes de Evaluación</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
        <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px; color: #1890ff;">SOL-2026-0042</td><td>Nuevo sistema de inventario</td><td><span style="background: #fff1f0; color: #D52B1E; padding: 1px 8px; border-radius: 4px; font-size: 0.85em;">Alta</span></td></tr>
        <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px; color: #1890ff;">SOL-2026-0041</td><td>Actualización portal compras</td><td><span style="background: #e6fffb; color: #13c2c2; padding: 1px 8px; border-radius: 4px; font-size: 0.85em;">Media</span></td></tr>
      </table>
    </div>
    <div style="flex: 1; min-width: 200px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
      <div style="font-weight: 600; margin-bottom: 8px;">Proyectos Activos</div>
      <div style="font-size: 0.85em; padding: 4px 0; border-bottom: 1px solid #f0f0f0;"><span style="color: #D52B1E;">PRY-015</span> — Portal RRHH <span style="color: #8c8c8c;">(3/8 tareas)</span></div>
      <div style="font-size: 0.85em; padding: 4px 0;"><span style="color: #D52B1E;">PRY-014</span> — App Mantenimiento <span style="color: #8c8c8c;">(5/12 tareas)</span></div>
    </div>
  </div>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">2. Gestión de Solicitudes</h2>
<p>Las solicitudes llegan del formulario público y se organizan en grupos colapsables por estado:</p>

<!-- Solicitudes Grouped List Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="border-left: 4px solid #D52B1E; padding: 12px 16px; background: white;">
    <strong>Solicitudes - Nuevas Tecnologías</strong>
    <div style="color: #8c8c8c; font-size: 0.85em;">Gestione las solicitudes de desarrollo asignadas a su equipo</div>
  </div>
  <!-- Group: Pendiente -->
  <div style="background: #fafafa; padding: 8px 16px; border-top: 1px solid #f0f0f0; cursor: pointer; font-weight: 500;">▼ Pendiente <span style="background: #D52B1E; color: white; padding: 0 8px; border-radius: 10px; font-size: 0.8em; margin-left: 8px;">5</span></div>
  <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
    <tr style="background: #fafafa; font-weight: 500;"><td style="padding: 6px 16px; width: 130px;">Código</td><td>Título</td><td style="width: 100px;">Tipo</td><td style="width: 80px;">Prioridad</td><td style="width: 100px;">Fecha</td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px 16px; color: #1890ff;">SOL-2026-0042</td><td>Nuevo sistema de inventario</td><td><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 4px;">Proyecto Nuevo</span></td><td><span style="color: #D52B1E;">Alta</span></td><td>05/03/2026</td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px 16px; color: #1890ff;">SOL-2026-0041</td><td>Actualización módulo compras</td><td><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 4px;">Actualización</span></td><td><span style="color: #13c2c2;">Media</span></td><td>04/03/2026</td></tr>
  </table>
  <!-- Group: En Estudio -->
  <div style="background: #fafafa; padding: 8px 16px; border-top: 1px solid #f0f0f0; cursor: pointer; font-weight: 500;">▼ En Estudio <span style="background: #D52B1E; color: white; padding: 0 8px; border-radius: 10px; font-size: 0.8em; margin-left: 8px;">2</span></div>
  <!-- Group: En Gerencia (collapsed) -->
  <div style="background: #fafafa; padding: 8px 16px; border-top: 1px solid #f0f0f0; cursor: pointer; font-weight: 500; color: #8c8c8c;">▶ En Gerencia <span style="background: #8c8c8c; color: white; padding: 0 8px; border-radius: 10px; font-size: 0.8em; margin-left: 8px;">3</span></div>
</div>

<p>Las solicitudes siguen un ciclo de vida de 18 estados:</p>
<div style="background: #fafafa; border-radius: 8px; padding: 16px; margin: 16px 0; overflow-x: auto; font-family: monospace; font-size: 0.85em;">
  pendiente → en_evaluacion → evaluada → aprobada_nt → aprobada → en_desarrollo → completada
  <div style="color: #8c8c8c; font-family: sans-serif; margin-top: 4px;">También: cancelada, transferida_a_ti, pausada, reevaluacion, etc.</div>
</div>

<h3>Acciones disponibles:</h3>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Acción</th><th style="padding: 8px 12px; text-align: left;">Descripción</th><th style="padding: 8px 12px; text-align: left;">Estado requerido</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><strong>Iniciar evaluación</strong></td><td style="padding: 8px 12px;">Tomar la solicitud para evaluarla</td><td style="padding: 8px 12px;">pendiente</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 8px 12px;"><strong>Completar evaluación</strong></td><td style="padding: 8px 12px;">Enviar evaluación técnica al coordinador</td><td style="padding: 8px 12px;">en_evaluacion</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><strong>Transferir a TI</strong></td><td style="padding: 8px 12px;">Redirigir como ticket de soporte</td><td style="padding: 8px 12px;">pendiente, en_evaluacion</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 8px 12px;"><strong>Cancelar</strong></td><td style="padding: 8px 12px;">Cancelar solicitud con justificación</td><td style="padding: 8px 12px;">pendiente, en_evaluacion</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><strong>Solicitar reevaluación</strong></td><td style="padding: 8px 12px;">Pedir revisión de solicitud rechazada</td><td style="padding: 8px 12px;">evaluada (rechazada)</td></tr>
  </tbody>
</table>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">3. Evaluaciones</h2>
<p>Cuando una solicitud pasa a <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">en_evaluacion</code>, debe completar una evaluación técnica que incluye:</p>
<ul>
  <li><strong>Análisis de viabilidad</strong> — Factibilidad técnica del proyecto</li>
  <li><strong>Estimación de recursos</strong> — Tiempo, personal, presupuesto</li>
  <li><strong>Cronograma propuesto</strong> — Fechas, fases y tareas con diagrama Gantt</li>
  <li><strong>Equipo asignado</strong> — Miembros NT responsables del desarrollo</li>
  <li><strong>Riesgos identificados</strong> — Posibles obstáculos y mitigaciones</li>
</ul>

<h3>Integración y Plan de Implementación</h3>
<p>Al revisar una evaluación, se muestra una sección de <strong>"Integración y Plan de Implementación"</strong> que presenta las fases y tareas del plan de implementación definido por el solicitante en el formulario original. Esta información incluye:</p>
<ul>
  <li>Las <strong>fases de implementación</strong> con sus tareas y duraciones estimadas</li>
  <li>Una <strong>vista previa del diagrama Gantt</strong> del plan de implementación</li>
</ul>
<p>Este plan de implementación se activa automáticamente cuando el proyecto completa su fase de desarrollo y entra en la fase de implementación.</p>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
  <strong>Importante:</strong> Una vez enviada la evaluación, no puede ser modificada. Asegúrese de completar todos los campos antes de enviar. La evaluación pasa al Coordinador NT para su revisión.
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">4. Proyectos</h2>
<p>Los proyectos aprobados se muestran organizados en dos columnas:</p>

<!-- Projects Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; display: flex; gap: 16px; flex-wrap: wrap;">
  <div style="flex: 1; min-width: 250px;">
    <div style="font-weight: 600; margin-bottom: 8px;">Proyectos Activos <span style="background: #D52B1E; color: white; padding: 0 8px; border-radius: 10px; font-size: 0.8em;">4</span></div>
    <div style="border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; margin-bottom: 8px; background: white;">
      <div><span style="color: #D52B1E; font-weight: 500;">PRY-015</span> <span style="background: #e6f7ff; color: #1890ff; padding: 1px 8px; border-radius: 4px; font-size: 0.8em;">En Desarrollo</span></div>
      <div style="font-weight: 500; margin: 4px 0;">Portal de Recursos Humanos</div>
      <div style="font-size: 0.85em; color: #8c8c8c;">Líder: Juan Pérez | 01/02 - 30/04</div>
      <div style="margin-top: 8px;">
        <div style="font-size: 0.75em; color: #8c8c8c;">Práctico</div>
        <div style="background: #f0f0f0; border-radius: 4px; height: 8px; margin-top: 2px;"><div style="background: #D52B1E; height: 100%; width: 38%; border-radius: 4px;"></div></div>
        <div style="font-size: 0.75em; color: #8c8c8c; text-align: right;">38%</div>
      </div>
    </div>
  </div>
  <div style="flex: 1; min-width: 250px;">
    <div style="font-weight: 600; margin-bottom: 8px;">Proyectos Programados</div>
    <div style="border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; background: white;">
      <div><span style="color: #D52B1E; font-weight: 500;">PRY-016</span> <span style="background: #f0f0f0; padding: 1px 8px; border-radius: 4px; font-size: 0.8em;">Programado</span></div>
      <div style="font-weight: 500; margin: 4px 0;">App de Mantenimiento Preventivo</div>
      <div style="font-size: 0.85em; color: #1890ff;">Inicio en 12 días</div>
    </div>
  </div>
</div>

<p>Como usuario NT, puede:</p>
<ul>
  <li>Ver la lista de proyectos y su progreso (teórico vs práctico)</li>
  <li>Gestionar tareas dentro de cada proyecto</li>
  <li>Registrar avances y actualizar el cronograma</li>
  <li>Agregar miembros al equipo del proyecto</li>
  <li>Solicitar reprogramaciones cuando sea necesario</li>
</ul>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">5. Fase de Implementación</h2>
<p>Una vez que el desarrollo de un proyecto ha sido completado, el proyecto avanza a la fase de <strong>Implementación</strong>. Esta fase gestiona la puesta en marcha del proyecto usando las tareas del Plan de Implementación definido en la solicitud original.</p>

<h3>Ciclo de vida del proyecto:</h3>
<div style="background: #fafafa; border-radius: 8px; padding: 16px; margin: 16px 0; overflow-x: auto; font-family: monospace; font-size: 0.85em;">
  planificación → en_desarrollo → <strong>en_implementación</strong> → solucionado
  <div style="color: #8c8c8c; font-family: sans-serif; margin-top: 4px;">También: pausado, cancelado</div>
</div>

<h3>Diagrama Gantt de Implementación</h3>
<p>La fase de implementación cuenta con su propio <strong>diagrama Gantt</strong> que muestra las tareas de implementación organizadas por fases. Cada tarea tiene:</p>

<!-- Implementation Gantt Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 12px;">Implementación — PRY-015 Portal de Recursos Humanos</div>
  <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
    <tr style="background: #D52B1E; color: white;"><td style="padding: 6px 12px; width: 200px;">Tarea</td><td style="padding: 6px 12px; width: 80px;">Progreso</td><td style="padding: 6px 12px;">Gantt</td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 6px 12px;"><strong>Fase: Preparación</strong></td><td></td><td></td>
    </tr>
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 6px 12px; padding-left: 24px;">Configurar servidor</td>
      <td style="padding: 6px 12px;"><span style="background: #f6ffed; color: #52c41a; padding: 1px 6px; border-radius: 4px;">100%</span></td>
      <td style="padding: 6px 12px;"><div style="background: #52c41a; height: 12px; width: 60%; border-radius: 3px;"></div></td>
    </tr>
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 6px 12px; padding-left: 24px;">Migrar datos</td>
      <td style="padding: 6px 12px;"><span style="background: #e6f7ff; color: #1890ff; padding: 1px 6px; border-radius: 4px;">60%</span></td>
      <td style="padding: 6px 12px;"><div style="background: #1890ff; height: 12px; width: 40%; border-radius: 3px;"></div></td>
    </tr>
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 6px 12px;"><strong>Fase: Capacitación</strong></td><td></td><td></td>
    </tr>
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 6px 12px; padding-left: 24px;">Capacitar usuarios</td>
      <td style="padding: 6px 12px;"><span style="background: #f0f0f0; color: #8c8c8c; padding: 1px 6px; border-radius: 4px;">0%</span></td>
      <td style="padding: 6px 12px;"><div style="background: #d9d9d9; height: 12px; width: 30%; border-radius: 3px;"></div></td>
    </tr>
  </table>
</div>

<h3>Gestión del progreso</h3>
<ul>
  <li>Cada tarea de implementación tiene un <strong>progreso de 0% a 100%</strong></li>
  <li>Como usuario NT, puede actualizar el progreso de cada tarea</li>
  <li><strong>Todas las tareas deben estar al 100%</strong> antes de poder finalizar el proyecto</li>
</ul>

<h3>Finalizar Implementación</h3>
<p>Cuando todas las tareas de implementación alcanzan el 100%, aparece el botón <strong>"Finalizar Implementación"</strong>:</p>
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
  <div style="font-size: 0.9em; color: #52c41a; margin-bottom: 8px;">Todas las tareas completadas (5/5)</div>
  <span style="background: #52c41a; color: white; padding: 8px 24px; border-radius: 6px; font-weight: 500;">Finalizar Implementación</span>
</div>
<p>Al finalizar, el proyecto cambia a estado <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">solucionado</code> y se considera completado exitosamente.</p>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
  <strong>Importante:</strong> No es posible finalizar la implementación si alguna tarea tiene un progreso inferior al 100%. Complete todas las tareas antes de proceder.
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">6. Base de Conocimiento</h2>
<p>Como usuario NT, puede crear y editar artículos en el portal de conocimiento. Use el editor visual para escribir documentación técnica, guías y tutoriales. También puede controlar la <strong>visibilidad</strong> de cada artículo (público, NT, TI, gerencia) y adjuntar archivos PDF.</p>

</div>',
  v_cat_id, v_admin_id,
  ARRAY['manual', 'nt', 'nuevas-tecnologias', 'solicitudes', 'proyectos'],
  true, '["nt"]'
) RETURNING id INTO v_art2;

-- =====================================================
-- Article 3: Manual TI
-- =====================================================
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, visibilidad)
VALUES (
  'Manual de Usuario — TI',
  'manual-ti',
  'Guía completa para usuarios del rol TI: gestión de tickets, soporte técnico y estadísticas.',
  '<div>

<div style="background: linear-gradient(135deg, #D52B1E 0%, #8B1A12 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
  <h1 style="color: white; margin: 0;">Manual — Tecnologías de la Información</h1>
  <p style="margin: 8px 0 0; opacity: 0.9;">Guía completa de funcionalidades para el rol TI</p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">1. Panel de Control (Dashboard)</h2>
<p>Su panel muestra las métricas clave de soporte:</p>

<!-- TI Dashboard Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 12px; font-size: 1.1em;">Dashboard - TI</div>
  <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #faad14; font-size: 1.5em;">⏱</div>
      <div style="font-size: 1.4em; font-weight: bold;">7</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Abiertos</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #D52B1E; font-size: 1.5em;">🔧</div>
      <div style="font-size: 1.4em; font-weight: bold;">4</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">En Proceso</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #52c41a; font-size: 1.5em;">✓</div>
      <div style="font-size: 1.4em; font-weight: bold;">3</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Resueltos Hoy</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #722ed1; font-size: 1.5em;">⏱</div>
      <div style="font-size: 1.4em; font-weight: bold;">1.3d</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Tiempo Promedio Respuesta</div>
    </div>
  </div>
  <div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
    <div style="font-weight: 600; margin-bottom: 8px;">Tickets Sin Asignar</div>
    <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
      <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px; color: #1890ff;">TKT-2026-0089</td><td>Impresora no funciona piso 3</td><td><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 4px;">Hardware</span></td><td><span style="color: #D52B1E;">Alta</span></td></tr>
      <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px; color: #1890ff;">TKT-2026-0088</td><td>Error al acceder a SharePoint</td><td><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 4px;">Software</span></td><td><span style="color: #13c2c2;">Media</span></td></tr>
    </table>
  </div>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">2. Gestión de Tickets</h2>
<p>Los tickets se organizan en grupos colapsables por estado:</p>

<!-- Tickets Grouped List Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #fafafa; padding: 8px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer; font-weight: 500;">▼ Abierto <span style="background: #D52B1E; color: white; padding: 0 8px; border-radius: 10px; font-size: 0.8em; margin-left: 8px;">7</span></div>
  <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
    <tr style="background: #fafafa; font-weight: 500;"><td style="padding: 6px 16px; width: 130px;">Código</td><td>Título</td><td style="width: 100px;">Categoría</td><td style="width: 80px;">Prioridad</td><td style="width: 130px;">Solicitante</td><td style="width: 100px;">Fecha</td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px 16px; color: #1890ff;">TKT-2026-0089</td><td>Impresora no funciona piso 3</td><td><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 4px;">Hardware</span></td><td><span style="color: #D52B1E;">Alta</span></td><td>María López</td><td>06/03/2026</td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px 16px; color: #1890ff;">TKT-2026-0088</td><td>Error al acceder a SharePoint</td><td><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 4px;">Software</span></td><td><span style="color: #13c2c2;">Media</span></td><td>Carlos Ruiz</td><td>05/03/2026</td></tr>
  </table>
  <div style="background: #fafafa; padding: 8px 16px; border-top: 1px solid #f0f0f0; cursor: pointer; font-weight: 500;">▼ En Proceso <span style="background: #D52B1E; color: white; padding: 0 8px; border-radius: 10px; font-size: 0.8em; margin-left: 8px;">4</span></div>
  <div style="background: #fafafa; padding: 8px 16px; border-top: 1px solid #f0f0f0; cursor: pointer; font-weight: 500; color: #8c8c8c;">▶ Otros <span style="background: #8c8c8c; color: white; padding: 0 8px; border-radius: 10px; font-size: 0.8em; margin-left: 8px;">12</span></div>
</div>

<p>Los tickets siguen un ciclo de vida de 8 estados:</p>
<div style="background: #fafafa; border-radius: 8px; padding: 16px; margin: 16px 0; font-family: monospace; font-size: 0.85em;">
  abierto → en_progreso → resuelto → cerrado
  <div style="color: #8c8c8c; font-family: sans-serif; margin-top: 4px;">También: escalado, transferido_a_nt, cerrado_forzado, reabierto</div>
</div>

<h3>Acciones disponibles:</h3>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Acción</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><strong>Tomar ticket</strong></td><td style="padding: 8px 12px;">Asignarse un ticket abierto y comenzar a trabajar</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 8px 12px;"><strong>Resolver</strong></td><td style="padding: 8px 12px;">Marcar como resuelto con descripción de la solución</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><strong>Escalar</strong></td><td style="padding: 8px 12px;">Escalar a un nivel superior con justificación</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 8px 12px;"><strong>Transferir a NT</strong></td><td style="padding: 8px 12px;">Convertir en solicitud de desarrollo (si requiere desarrollo)</td></tr>
    <tr><td style="padding: 8px 12px;"><strong>Comentar</strong></td><td style="padding: 8px 12px;">Agregar comentarios y archivos adjuntos al ticket</td></tr>
  </tbody>
</table>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">3. Categorías de Tickets</h2>
<p>Los tickets se clasifican por categoría:</p>
<ul>
  <li><strong>Hardware</strong> — Problemas con equipos físicos</li>
  <li><strong>Software</strong> — Problemas con aplicaciones</li>
  <li><strong>Red</strong> — Conectividad y acceso a red</li>
  <li><strong>Acceso</strong> — Problemas de permisos y credenciales</li>
  <li><strong>Soporte General</strong> — Problemas que no encajan en las categorías anteriores</li>
</ul>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">4. Comunicación con el Solicitante</h2>
<p>Use los <strong>comentarios</strong> del ticket para mantener comunicación con el solicitante. Los comentarios pueden incluir archivos adjuntos (imágenes, documentos). El solicitante verá sus comentarios cuando consulte el estado de su ticket por código.</p>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
  <strong>Consejo:</strong> Documente claramente los pasos de resolución en los comentarios. Esto ayuda a futuros tickets similares y construye la base de conocimiento.
</div>

</div>',
  v_cat_id, v_admin_id,
  ARRAY['manual', 'ti', 'tickets', 'soporte'],
  true, '["ti"]'
) RETURNING id INTO v_art3;

-- =====================================================
-- Article 4: Manual Gerencia
-- =====================================================
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, visibilidad)
VALUES (
  'Manual de Usuario — Gerencia',
  'manual-gerencia',
  'Guía para usuarios de Gerencia: aprobaciones, reportes, calendario y visión ejecutiva del portal.',
  '<div>

<div style="background: linear-gradient(135deg, #D52B1E 0%, #8B1A12 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
  <h1 style="color: white; margin: 0;">Manual — Gerencia</h1>
  <p style="margin: 8px 0 0; opacity: 0.9;">Visión ejecutiva y funcionalidades de aprobación</p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">1. Panel de Control</h2>
<p>El dashboard de Gerencia ofrece una visión ejecutiva:</p>

<!-- Gerencia Dashboard Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 12px; font-size: 1.1em;">Dashboard - Gerencia</div>
  <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
    <div style="flex: 1; min-width: 140px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #faad14; font-size: 1.5em;">📄</div>
      <div style="font-size: 1.4em; font-weight: bold;">3</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Pendientes Aprobación</div>
    </div>
    <div style="flex: 1; min-width: 140px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #D52B1E; font-size: 1.5em;">📁</div>
      <div style="font-size: 1.4em; font-weight: bold;">6</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Proyectos Activos</div>
    </div>
    <div style="flex: 1; min-width: 140px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #722ed1; font-size: 1.5em;">📅</div>
      <div style="font-size: 1.4em; font-weight: bold;">3</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Agendados</div>
    </div>
  </div>
  <div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
    <div style="font-weight: 600; margin-bottom: 8px;">Solicitudes Pendientes de Aprobación</div>
    <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
      <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px; color: #1890ff;">SOL-2026-0038</td><td>Sistema de control de acceso</td><td><span style="color: #D52B1E;">Alta</span></td><td>Área de Operaciones</td><td>01/03/2026</td></tr>
      <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px; color: #1890ff;">SOL-2026-0035</td><td>Portal de proveedores v2</td><td><span style="color: #13c2c2;">Media</span></td><td>Compras</td><td>28/02/2026</td></tr>
    </table>
  </div>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">2. Aprobaciones</h2>
<p>Como usuario de Gerencia, usted es el <strong>aprobador final</strong> en el flujo de solicitudes:</p>

<div style="background: #fafafa; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h4 style="color: #D52B1E; margin: 0 0 8px;">Flujo de aprobación:</h4>
  <ol style="margin: 0; padding-left: 20px;">
    <li>NT evalúa la solicitud y envía evaluación</li>
    <li>Coordinador NT revisa y aprueba la evaluación</li>
    <li><strong>Gerencia aprueba o rechaza</strong> la solicitud</li>
    <li>Si se aprueba, la solicitud se convierte en proyecto</li>
  </ol>
</div>

<!-- Approvals Table Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="padding: 12px 16px; font-weight: 600;">Aprobaciones Pendientes <span style="background: #D52B1E; color: white; padding: 2px 10px; border-radius: 10px; font-size: 0.8em; margin-left: 8px;">3</span></div>
  <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
    <tr style="background: #fafafa; font-weight: 500;"><td style="padding: 8px 16px;">Código</td><td>Título</td><td style="width: 80px;">Prioridad</td><td style="width: 80px;">Esperando</td><td style="width: 80px;">Acciones</td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0; background: #fff2f0;"><td style="padding: 8px 16px; color: #1890ff;">SOL-2026-0038</td><td>Sistema de control de acceso <div style="margin-top: 2px;"><span style="background: #f6ffed; color: #52c41a; padding: 1px 6px; border-radius: 4px; font-size: 0.8em;">NT recomienda: Aprobar</span></div></td><td><span style="color: #D52B1E;">Alta</span></td><td><span style="background: #fff1f0; color: #D52B1E; padding: 1px 8px; border-radius: 10px; font-size: 0.8em;">8 días</span></td><td><span style="background: #D52B1E; color: white; padding: 2px 10px; border-radius: 4px; font-size: 0.85em;">Revisar</span></td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 16px; color: #1890ff;">SOL-2026-0035</td><td>Portal de proveedores v2 <div style="margin-top: 2px;"><span style="background: #f6ffed; color: #52c41a; padding: 1px 6px; border-radius: 4px; font-size: 0.8em;">NT recomienda: Aprobar</span></div></td><td><span style="color: #13c2c2;">Media</span></td><td><span style="background: #f0f0f0; padding: 1px 8px; border-radius: 10px; font-size: 0.8em;">3 días</span></td><td><span style="background: #D52B1E; color: white; padding: 2px 10px; border-radius: 4px; font-size: 0.85em;">Revisar</span></td></tr>
  </table>
</div>

<p>Las filas se resaltan en <span style="background: #fff2f0; padding: 1px 6px;">rojo claro</span> cuando llevan más de 7 días esperando, y en <span style="background: #fffbe6; padding: 1px 6px;">amarillo</span> cuando llevan más de 3 días.</p>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">3. Reportes y Estadísticas</h2>
<p>Acceda a reportes a través de 5 pestañas:</p>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Pestaña</th><th style="padding: 8px 12px; text-align: left;">Contenido</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><strong>Resumen Semanal</strong></td><td style="padding: 8px 12px;">Solicitudes nuevas/aprobadas, proyectos activos/completados, tickets resueltos</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 8px 12px;"><strong>Solicitudes NT</strong></td><td style="padding: 8px 12px;">Gráficos por estado y tipo, tabla detallada</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><strong>Proyectos NT</strong></td><td style="padding: 8px 12px;">Indicadores clave, progreso por proyecto, tareas</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 8px 12px;"><strong>Tickets TI</strong></td><td style="padding: 8px 12px;">Estadísticas, gráficos por categoría, tabla detallada</td></tr>
    <tr><td style="padding: 8px 12px;"><strong>Equipo NT</strong></td><td style="padding: 8px 12px;">Carga de trabajo por miembro, proyectos agendados, tareas asignadas</td></tr>
  </tbody>
</table>
<p>Todos los reportes se pueden exportar a <strong>PDF</strong> y <strong>Excel</strong> usando los botones en la esquina superior derecha. También puede filtrar por rango de fechas.</p>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">4. Seguimiento de Implementación</h2>
<p>Los proyectos que completan su fase de desarrollo pasan a la fase de <strong>Implementación</strong>. El indicador <strong>"Agendados"</strong> en el dashboard muestra cuántos proyectos activos se encuentran en fase de implementación, permitiéndole monitorear la puesta en marcha.</p>

<h3>Vista de Implementación de Proyectos</h3>
<p>Al hacer clic en un proyecto en implementación, verá el detalle de progreso:</p>

<!-- Implementation Detail Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 8px;">PRY-015 — Portal de Recursos Humanos <span style="background: #e6f7ff; color: #1890ff; padding: 2px 10px; border-radius: 4px; font-size: 0.8em;">En Implementación</span></div>
  <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 10px; text-align: center;">
      <div style="font-size: 1.2em; font-weight: bold; color: #52c41a;">2/5</div>
      <div style="font-size: 0.75em; color: #8c8c8c;">Tareas Completadas</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 10px; text-align: center;">
      <div style="font-size: 1.2em; font-weight: bold;">45%</div>
      <div style="font-size: 0.75em; color: #8c8c8c;">Progreso General</div>
    </div>
  </div>
  <div style="font-size: 0.85em; color: #8c8c8c;">Diagrama Gantt de implementación con tareas organizadas por fases</div>
  <div style="background: white; border: 1px solid #f0f0f0; border-radius: 4px; padding: 8px; margin-top: 8px;">
    <div style="font-size: 0.8em;">
      <div style="padding: 4px 0; border-bottom: 1px solid #f0f0f0;">Configurar servidor <span style="float: right; color: #52c41a;">100%</span></div>
      <div style="padding: 4px 0; border-bottom: 1px solid #f0f0f0;">Migrar datos <span style="float: right; color: #1890ff;">60%</span></div>
      <div style="padding: 4px 0;">Capacitar usuarios <span style="float: right; color: #8c8c8c;">0%</span></div>
    </div>
  </div>
</div>

<p>La fase de implementación es de <strong>solo lectura</strong> para Gerencia — el avance de tareas es gestionado por el equipo NT. El proyecto se completa automáticamente cuando todas las tareas alcanzan el 100%.</p>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">5. Calendario</h2>
<p>El calendario muestra una vista unificada de todos los proyectos, fechas de entrega, hitos y conflictos de recursos. Use los filtros para ver por equipo, proyecto o período.</p>

</div>',
  v_cat_id, v_admin_id,
  ARRAY['manual', 'gerencia', 'aprobaciones', 'reportes'],
  true, '["gerencia"]'
) RETURNING id INTO v_art4;

-- =====================================================
-- Article 5: Manual Coordinador NT
-- =====================================================
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, visibilidad)
VALUES (
  'Manual de Usuario — Coordinador NT',
  'manual-coordinador-nt',
  'Guía para Coordinadores de Nuevas Tecnologías: revisión de evaluaciones, aprobación y supervisión de equipos NT.',
  '<div>

<div style="background: linear-gradient(135deg, #D52B1E 0%, #8B1A12 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
  <h1 style="color: white; margin: 0;">Manual — Coordinador NT</h1>
  <p style="margin: 8px 0 0; opacity: 0.9;">Supervisión de evaluaciones y equipos de Nuevas Tecnologías</p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">1. Rol del Coordinador NT</h2>
<p>El Coordinador NT actúa como <strong>puerta de revisión</strong> entre el equipo NT y Gerencia. Su responsabilidad principal es revisar las evaluaciones técnicas antes de que lleguen a Gerencia para aprobación final.</p>

<div style="background: #fafafa; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h4 style="color: #D52B1E; margin: 0 0 8px;">Flujo del Coordinador NT:</h4>
  <p style="margin: 0; font-family: monospace; font-size: 0.85em;">
    NT envía evaluación → <strong>Coordinador NT revisa</strong> → Aprueba/Rechaza → Si aprueba → Pasa a Gerencia
  </p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">2. Panel de Control</h2>

<!-- Coord NT Dashboard Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 12px; font-size: 1.1em;">Dashboard - Coordinador NT</div>
  <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #faad14; font-size: 1.5em;">📋</div>
      <div style="font-size: 1.4em; font-weight: bold;">4</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Pendientes Revisión</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #52c41a; font-size: 1.5em;">✓</div>
      <div style="font-size: 1.4em; font-weight: bold;">2</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Aprobados Hoy</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #D52B1E; font-size: 1.5em;">✗</div>
      <div style="font-size: 1.4em; font-weight: bold;">5</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Rechazados Total</div>
    </div>
    <div style="flex: 1; min-width: 120px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; text-align: center;">
      <div style="color: #D52B1E; font-size: 1.5em;">📁</div>
      <div style="font-size: 1.4em; font-weight: bold;">8</div>
      <div style="font-size: 0.8em; color: #8c8c8c;">Proyectos Activos</div>
    </div>
  </div>
  <div style="display: flex; gap: 12px; flex-wrap: wrap;">
    <div style="flex: 2; min-width: 300px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
      <div style="font-weight: 600; margin-bottom: 8px;">Solicitudes Pendientes de Revisión</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
        <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px; color: #1890ff;">SOL-2026-0042</td><td>Nuevo sistema inventario</td><td><span style="color: #D52B1E;">Alta</span></td><td><span style="background: #fff1f0; color: #D52B1E; padding: 1px 6px; border-radius: 10px; font-size: 0.8em;">5 días</span></td></tr>
        <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px; color: #1890ff;">SOL-2026-0040</td><td>App de mantenimiento</td><td><span style="color: #52c41a;">Baja</span></td><td><span style="background: #f0f0f0; padding: 1px 6px; border-radius: 10px; font-size: 0.8em;">1 día</span></td></tr>
      </table>
    </div>
    <div style="flex: 1; min-width: 200px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
      <div style="font-weight: 600; margin-bottom: 8px;">Mis Decisiones Recientes</div>
      <div style="font-size: 0.85em; padding: 4px 0; border-bottom: 1px solid #f0f0f0;"><strong>SOL-2026-0039</strong> <span style="background: #f6ffed; color: #52c41a; padding: 1px 6px; border-radius: 4px; font-size: 0.8em;">Aprobada</span><div style="color: #8c8c8c; font-size: 0.8em;">05/03/2026 14:30</div></div>
      <div style="font-size: 0.85em; padding: 4px 0;"><strong>SOL-2026-0037</strong> <span style="background: #fff1f0; color: #D52B1E; padding: 1px 6px; border-radius: 4px; font-size: 0.8em;">Rechazada</span><div style="color: #8c8c8c; font-size: 0.8em;">04/03/2026 10:15</div></div>
    </div>
  </div>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">3. Revisión de Evaluaciones</h2>
<p>Cuando un usuario NT completa una evaluación técnica, usted recibirá una notificación. Su tarea:</p>
<ol>
  <li>Revisar la evaluación técnica completa (viabilidad, estimación, cronograma, riesgos)</li>
  <li><strong>Aprobar</strong> — La solicitud avanza a Gerencia para aprobación final</li>
  <li><strong>Rechazar</strong> — Devuelve la evaluación al equipo NT con observaciones</li>
</ol>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
  <strong>Importante:</strong> Las filas se resaltan en rojo cuando llevan más de 7 días esperando su revisión. Priorice estas solicitudes.
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">4. Supervisión de Solicitudes</h2>
<p>Como Coordinador NT, tiene visibilidad completa de todas las solicitudes en el sistema. Puede:</p>
<ul>
  <li>Ver solicitudes en cualquier estado</li>
  <li>Filtrar por evaluador, fecha, prioridad</li>
  <li>Agregar comentarios a cualquier solicitud</li>
  <li>Cancelar solicitudes cuando sea necesario</li>
</ul>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">5. Proyectos en Implementación</h2>
<p>El dashboard del Coordinador NT incluye visibilidad de los proyectos que han completado su desarrollo y se encuentran en <strong>fase de implementación</strong>:</p>

<!-- Implementation Projects Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 8px;">Proyectos en Implementación</div>
  <div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="color: #D52B1E; font-weight: 500;">PRY-015</span> Portal de Recursos Humanos
        <div style="font-size: 0.8em; color: #8c8c8c;">2 de 5 tareas completadas</div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: bold;">45%</div>
        <div style="background: #f0f0f0; border-radius: 4px; height: 6px; width: 80px;"><div style="background: #1890ff; height: 100%; width: 45%; border-radius: 4px;"></div></div>
      </div>
    </div>
  </div>
  <div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="color: #D52B1E; font-weight: 500;">PRY-012</span> Sistema de Control de Acceso
        <div style="font-size: 0.8em; color: #8c8c8c;">4 de 4 tareas completadas</div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: bold; color: #52c41a;">100%</div>
        <div style="background: #f0f0f0; border-radius: 4px; height: 6px; width: 80px;"><div style="background: #52c41a; height: 100%; width: 100%; border-radius: 4px;"></div></div>
      </div>
    </div>
  </div>
</div>

<h3>Detalle de Implementación</h3>
<p>Al hacer clic en un proyecto en implementación, puede ver el detalle completo incluyendo:</p>
<ul>
  <li>Diagrama Gantt con las tareas de implementación organizadas por fases</li>
  <li>Progreso individual de cada tarea (0-100%)</li>
  <li>Progreso general del proyecto</li>
</ul>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
  <strong>Nota:</strong> La vista de implementación es de <strong>solo lectura</strong> para el Coordinador NT. El avance de las tareas de implementación es gestionado directamente por los usuarios NT asignados al proyecto.
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">6. Gestión de Artículos</h2>
<p>Como Coordinador NT, también puede crear y editar artículos en la base de conocimiento. Use esta funcionalidad para documentar procedimientos y estándares del equipo NT.</p>

</div>',
  v_cat_id, v_admin_id,
  ARRAY['manual', 'coordinador', 'nt', 'evaluaciones'],
  true, '["nt"]'
) RETURNING id INTO v_art5;

-- =====================================================
-- Article 6: Manual Coordinador TI
-- =====================================================
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, visibilidad)
VALUES (
  'Manual de Usuario — Coordinador TI',
  'manual-coordinador-ti',
  'Guía para Coordinadores TI: supervisión de tickets, reasignación, cierre forzado y gestión del equipo.',
  '<div>

<div style="background: linear-gradient(135deg, #D52B1E 0%, #8B1A12 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
  <h1 style="color: white; margin: 0;">Manual — Coordinador TI</h1>
  <p style="margin: 8px 0 0; opacity: 0.9;">Supervisión y gestión avanzada de tickets de soporte</p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">1. Rol del Coordinador TI</h2>
<p>El Coordinador TI supervisa todo el equipo de soporte y tiene acciones especiales:</p>
<ul>
  <li><strong>Reasignar tickets</strong> — Mover un ticket de un técnico a otro</li>
  <li><strong>Cierre forzado</strong> — Cerrar un ticket sin resolución (con justificación)</li>
  <li><strong>Visión completa</strong> — Ver todos los tickets de todo el equipo TI</li>
  <li><strong>Estadísticas del equipo</strong> — Métricas de rendimiento por trabajador</li>
</ul>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">2. Panel de Estadísticas</h2>

<!-- Coord TI Stats Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 12px; font-size: 1.1em;">Estadísticas - Coordinador TI</div>
  <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
    <div style="flex: 1; min-width: 100px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 10px; text-align: center;">
      <div style="font-size: 1.2em; font-weight: bold;">7</div><div style="font-size: 0.75em; color: #8c8c8c;">Abiertos</div>
    </div>
    <div style="flex: 1; min-width: 100px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 10px; text-align: center;">
      <div style="font-size: 1.2em; font-weight: bold;">4</div><div style="font-size: 0.75em; color: #8c8c8c;">En Proceso</div>
    </div>
    <div style="flex: 1; min-width: 100px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 10px; text-align: center;">
      <div style="font-size: 1.2em; font-weight: bold;">12</div><div style="font-size: 0.75em; color: #8c8c8c;">Resueltos Semana</div>
    </div>
    <div style="flex: 1; min-width: 100px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 10px; text-align: center;">
      <div style="font-size: 1.2em; font-weight: bold;">3</div><div style="font-size: 0.75em; color: #8c8c8c;">Trabajadores TI</div>
    </div>
  </div>
  <div style="background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
    <div style="font-weight: 600; margin-bottom: 8px;">Rendimiento por Trabajador</div>
    <table style="width: 100%; border-collapse: collapse; font-size: 0.85em;">
      <tr style="background: #fafafa;"><td style="padding: 6px; font-weight: 500;">Trabajador</td><td>Asignados</td><td>Resueltos (Mes)</td><td>Tiempo Prom.</td></tr>
      <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px;">👤 Carlos Gómez</td><td><span style="background: #e6f7ff; padding: 1px 8px; border-radius: 4px;">3</span></td><td><span style="background: #f6ffed; padding: 1px 8px; border-radius: 4px;">18</span></td><td>1.2 días</td></tr>
      <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 6px;">👤 Ana Martínez</td><td><span style="background: #e6f7ff; padding: 1px 8px; border-radius: 4px;">2</span></td><td><span style="background: #f6ffed; padding: 1px 8px; border-radius: 4px;">15</span></td><td>1.5 días</td></tr>
    </table>
  </div>
  <div style="display: flex; gap: 12px; flex-wrap: wrap;">
    <div style="flex: 1; min-width: 200px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
      <div style="font-weight: 600; margin-bottom: 6px;">Tickets en Cola</div>
      <div style="font-size: 0.85em; padding: 4px 0; border-bottom: 1px solid #f0f0f0;"><span style="color: #1890ff;">TKT-0089</span> Impresora piso 3 <span style="color: #D52B1E; font-size: 0.8em;">3 días</span></div>
      <div style="font-size: 0.85em; padding: 4px 0;"><span style="color: #1890ff;">TKT-0088</span> SharePoint error <span style="color: #faad14; font-size: 0.8em;">1 día</span></div>
    </div>
    <div style="flex: 1; min-width: 200px; background: white; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px;">
      <div style="font-weight: 600; margin-bottom: 6px;">Tomados sin Resolver</div>
      <div style="font-size: 0.85em; padding: 4px 0;"><span style="color: #1890ff;">TKT-0085</span> VPN no conecta <span style="color: #8c8c8c;">→ Carlos G.</span> <span style="color: #D52B1E; font-size: 0.8em;">5 días</span></div>
    </div>
  </div>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">3. Reasignación de Tickets</h2>
<p>Si un ticket necesita ser atendido por otro técnico:</p>
<ol>
  <li>Abra el ticket que desea reasignar</li>
  <li>Haga clic en <strong>"Reasignar"</strong></li>
  <li>Seleccione el técnico TI destino de la lista</li>
  <li>Agregue un comentario explicando el motivo</li>
  <li>Confirme la reasignación</li>
</ol>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
  <strong>Nota:</strong> La reasignación genera una notificación automática al nuevo técnico y queda registrada en el historial del ticket.
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">4. Cierre Forzado</h2>
<p>El cierre forzado se usa cuando un ticket no puede o no debe ser resuelto (duplicado, fuera de alcance, sin respuesta del solicitante):</p>
<ol>
  <li>Abra el ticket</li>
  <li>Haga clic en <strong>"Cerrar Forzado"</strong></li>
  <li>Escriba una justificación detallada</li>
  <li>Confirme el cierre</li>
</ol>
<p>El solicitante será notificado del cierre con la justificación proporcionada.</p>

</div>',
  v_cat_id, v_admin_id,
  ARRAY['manual', 'coordinador', 'ti', 'tickets'],
  true, '["ti"]'
) RETURNING id INTO v_art6;

-- =====================================================
-- Article 7: Guía de Formularios
-- =====================================================
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, visibilidad)
VALUES (
  'Guía de Formularios — Solicitudes y Tickets',
  'guia-formularios',
  'Guía paso a paso para completar formularios de solicitudes de desarrollo y tickets de soporte correctamente.',
  '<div>

<div style="background: linear-gradient(135deg, #D52B1E 0%, #8B1A12 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
  <h1 style="color: white; margin: 0;">Guía de Formularios</h1>
  <p style="margin: 8px 0 0; opacity: 0.9;">Cómo completar solicitudes y tickets correctamente</p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Proceso General</h2>
<p>Todas las solicitudes y tickets siguen estos pasos iniciales antes de llegar al formulario específico:</p>

<h3>Paso 1: Verificación de Email</h3>
<p>Ingrese su nombre y correo corporativo. Recibirá un código de 6 dígitos para verificar su identidad.</p>

<!-- Email Verification Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; max-width: 450px; margin: 16px auto; padding: 24px; text-align: center;">
  <div style="color: #D52B1E; font-size: 2em; margin-bottom: 8px;">✉</div>
  <div style="font-size: 1.2em; font-weight: 600; margin-bottom: 4px;">Verificación de Email</div>
  <div style="color: #8c8c8c; margin-bottom: 16px;">Primero necesitamos verificar su correo electrónico para continuar.</div>
  <div style="text-align: left; margin-bottom: 8px;">
    <div style="font-size: 0.9em; margin-bottom: 4px;">Nombre Completo <span style="color: #D52B1E;">*</span></div>
    <div style="background: #f5f5f5; border: 1px solid #d9d9d9; border-radius: 6px; padding: 8px 12px; color: #bfbfbf;">Su nombre completo</div>
  </div>
  <div style="text-align: left; margin-bottom: 16px;">
    <div style="font-size: 0.9em; margin-bottom: 4px;">Correo Electrónico Corporativo <span style="color: #D52B1E;">*</span></div>
    <div style="background: #f5f5f5; border: 1px solid #d9d9d9; border-radius: 6px; padding: 8px 12px; color: #bfbfbf;">su.email@empresa.com</div>
  </div>
  <div style="background: #D52B1E; color: white; padding: 8px; border-radius: 6px; font-weight: 500;">Enviar Código de Verificación</div>
</div>

<h3>Paso 2: Selección de Categoría</h3>
<p>Elija entre <strong>Soporte TI</strong> (para tickets de soporte técnico) o <strong>Nuevas Tecnologías</strong> (para solicitudes de desarrollo).</p>

<!-- Category Selection Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; margin: 16px 0; padding: 24px;">
  <div style="text-align: center; margin-bottom: 16px;">
    <div style="font-size: 1.3em; font-weight: 600;">¿Qué tipo de solicitud desea realizar?</div>
    <div style="color: #8c8c8c;">Seleccione la categoría que mejor describe su necesidad</div>
  </div>
  <div style="display: flex; gap: 16px; flex-wrap: wrap;">
    <div style="flex: 1; min-width: 200px; border: 2px solid #f0f0f0; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer;">
      <div style="font-size: 2em; color: #1890ff; margin-bottom: 8px;">🔧</div>
      <div style="font-weight: 600; font-size: 1.1em;">Soporte TI</div>
      <div style="color: #8c8c8c; font-size: 0.9em;">Solicitudes de soporte técnico, problemas con equipos, software o accesos</div>
    </div>
    <div style="flex: 1; min-width: 200px; border: 2px solid #f0f0f0; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer;">
      <div style="font-size: 2em; color: #D52B1E; margin-bottom: 8px;">🚀</div>
      <div style="font-weight: 600; font-size: 1.1em;">Nuevas Tecnologías</div>
      <div style="color: #8c8c8c; font-size: 0.9em;">Proyectos de desarrollo, actualizaciones de sistemas, reportes de fallos en aplicaciones</div>
    </div>
  </div>
</div>

<p>Si selecciona <strong>Soporte TI</strong>, irá directamente al formulario de ticket. Si selecciona <strong>Nuevas Tecnologías</strong>, verá un paso adicional para elegir el tipo de solicitud.</p>

<h3>Paso 3: Tipo de Solicitud NT (solo para Nuevas Tecnologías)</h3>

<!-- NT Type Selection Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; margin: 16px 0; padding: 24px;">
  <div style="text-align: center; margin-bottom: 16px;">
    <div style="font-size: 1.3em; font-weight: 600;">Solicitud para Nuevas Tecnologías</div>
    <div style="color: #8c8c8c;">Seleccione el tipo de solicitud que desea realizar</div>
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    <div style="border: 2px solid #f0f0f0; border-radius: 8px; padding: 16px; display: flex; gap: 12px; align-items: flex-start;">
      <div style="color: #D52B1E; font-size: 1.5em;">⊕</div>
      <div><div style="font-weight: 600;">Proyecto Nuevo</div><div style="color: #8c8c8c; font-size: 0.85em;">Solicitud de desarrollo de una nueva aplicación, sistema o funcionalidad</div></div>
    </div>
    <div style="border: 2px solid #f0f0f0; border-radius: 8px; padding: 16px; display: flex; gap: 12px; align-items: flex-start;">
      <div style="color: #D52B1E; font-size: 1.5em;">🔄</div>
      <div><div style="font-weight: 600;">Actualización</div><div style="color: #8c8c8c; font-size: 0.85em;">Mejoras o modificaciones a un sistema o aplicación existente</div></div>
    </div>
    <div style="border: 2px solid #f0f0f0; border-radius: 8px; padding: 16px; display: flex; gap: 12px; align-items: flex-start;">
      <div style="color: #D52B1E; font-size: 1.5em;">🐛</div>
      <div><div style="font-weight: 600;">Reporte de Fallo</div><div style="color: #8c8c8c; font-size: 0.85em;">Reportar un error, bug o mal funcionamiento en una aplicación</div></div>
    </div>
    <div style="border: 2px solid #f0f0f0; border-radius: 8px; padding: 16px; display: flex; gap: 12px; align-items: flex-start;">
      <div style="color: #D52B1E; font-size: 1.5em;">⊘</div>
      <div><div style="font-weight: 600;">Cierre de Servicio</div><div style="color: #8c8c8c; font-size: 0.85em;">Solicitud para dar de baja o cerrar un sistema o servicio</div></div>
    </div>
  </div>
</div>

<hr style="border: none; border-top: 2px solid #D52B1E; margin: 32px 0;">

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Formulario: Proyecto Nuevo</h2>
<p>El formulario más completo. Consta de hasta 12 pasos según sus respuestas. Cada paso se valida antes de avanzar al siguiente.</p>

<h3>Paso 1 — Identificación</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Nombre Completo</strong></td><td style="padding: 6px 12px;">Texto</td><td style="padding: 6px 12px;">Nombre y apellidos del solicitante</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Cargo</strong></td><td style="padding: 6px 12px;">Texto</td><td style="padding: 6px 12px;">Ej: Ingeniero de Operaciones</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Área / Subárea</strong></td><td style="padding: 6px 12px;">Lista desplegable</td><td style="padding: 6px 12px;">Seleccione su área organizacional (con búsqueda)</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Operación / Contrato</strong></td><td style="padding: 6px 12px;">Lista desplegable</td><td style="padding: 6px 12px;">Seleccione la operación o contrato asociado</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Correo Corporativo</strong></td><td style="padding: 6px 12px;">Email</td><td style="padding: 6px 12px;">correo@inemec.com (validación de formato)</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Teléfono</strong></td><td style="padding: 6px 12px;">Texto</td><td style="padding: 6px 12px;">Número de contacto (opcional)</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Cédula</strong></td><td style="padding: 6px 12px;">Texto</td><td style="padding: 6px 12px;">Número de identificación</td></tr>
    <tr style="background: #fafafa;"><td style="padding: 6px 12px;"><strong>¿Es usted el doliente/sponsor?</strong></td><td style="padding: 6px 12px;">Sí / No</td><td style="padding: 6px 12px;">Si responde No, aparece el paso Sponsor</td></tr>
  </tbody>
</table>

<h3>Paso 2 — Sponsor (condicional)</h3>
<p>Solo aparece si indicó que <strong>no</strong> es el doliente/sponsor. Se piden los mismos datos del sponsor: Nombre, Cargo, Área, Operación/Contrato, Correo, Teléfono (opcional), Cédula.</p>

<h3>Paso 3 — Partes Interesadas (Stakeholders)</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Áreas Interesadas</strong></td><td style="padding: 6px 12px;">Lista dinámica</td><td style="padding: 6px 12px;">Agregar/quitar áreas internas interesadas</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Personas Clave Internas</strong></td><td style="padding: 6px 12px;">Lista dinámica</td><td style="padding: 6px 12px;">Agregar/quitar personas clave dentro de la empresa</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>¿Aplican partes externas?</strong></td><td style="padding: 6px 12px;">Sí / No</td><td style="padding: 6px 12px;">Si es Sí, se muestran campos adicionales</td></tr>
    <tr style="background: #fafafa;"><td style="padding: 6px 12px;"><strong>Sectores / Empresas / Proveedores / Personas Externas</strong></td><td style="padding: 6px 12px;">Listas dinámicas</td><td style="padding: 6px 12px;">Solo si aplican partes externas</td></tr>
  </tbody>
</table>

<h3>Paso 4 — Problemática</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Título del proyecto</strong></td><td style="padding: 6px 12px;">Texto (5-100 chars)</td><td style="padding: 6px 12px;">Nombre breve y descriptivo</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Situación actual</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">Describa la situación/problemática actual</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Origen del problema</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">¿Cuál es el origen del problema?</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Fecha de inicio del problema</strong></td><td style="padding: 6px 12px;">Selector de fecha</td><td style="padding: 6px 12px;">¿Desde cuándo se presenta? (opcional)</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Evidencia</strong></td><td style="padding: 6px 12px;">Archivos (máx 5)</td><td style="padding: 6px 12px;">Capturas, documentos de respaldo (opcional)</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Afectación a la operación</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">¿Cómo afecta a la operación?</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Procesos comprometidos</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">¿Qué procesos se ven comprometidos?</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Nivel de impacto</strong></td><td style="padding: 6px 12px;">Lista desplegable</td><td style="padding: 6px 12px;">Seleccione el nivel de impacto</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Descripción del impacto</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">Detalle del impacto seleccionado</td></tr>
  </tbody>
</table>

<h3>Paso 5 — Urgencia</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Necesidad principal</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">¿Cuál es la necesidad principal del proyecto?</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Nivel de urgencia</strong></td><td style="padding: 6px 12px;">Lista desplegable</td><td style="padding: 6px 12px;">Inmediata, Corto plazo, Mediano plazo, Largo plazo</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Fecha límite</strong></td><td style="padding: 6px 12px;">Selector de fecha</td><td style="padding: 6px 12px;">Fecha deseada (opcional)</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Justificación NT</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">¿Por qué debe ser desarrollado por Nuevas Tecnologías?</td></tr>
  </tbody>
</table>

<h3>Paso 6 — Solución</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Tipo de solución</strong></td><td style="padding: 6px 12px;">Lista desplegable</td><td style="padding: 6px 12px;">Categoría de la solución esperada</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Descripción de solución ideal</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">¿Cómo imagina la solución final?</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Casos de uso</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">Describa 1-3 casos reales de uso</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Usuarios finales</strong></td><td style="padding: 6px 12px;">Lista dinámica</td><td style="padding: 6px 12px;">¿Quiénes usarán la solución?</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Funcionalidades mínimas</strong></td><td style="padding: 6px 12px;">Lista dinámica</td><td style="padding: 6px 12px;">Lo indispensable para la solución</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Funcionalidades deseables</strong></td><td style="padding: 6px 12px;">Lista dinámica</td><td style="padding: 6px 12px;">Nice-to-have (opcional)</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>¿Existen restricciones?</strong></td><td style="padding: 6px 12px;">Sí / No</td><td style="padding: 6px 12px;">Si es Sí, se pide listar las restricciones</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Forma de entrega</strong></td><td style="padding: 6px 12px;">Lista desplegable</td><td style="padding: 6px 12px;">¿Cómo espera que se entregue?</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Referencias y modelos</strong></td><td style="padding: 6px 12px;">Archivos (máx 5)</td><td style="padding: 6px 12px;">Ejemplos o referencias (opcional)</td></tr>
  </tbody>
</table>

<h3>Paso 7 — Beneficios</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Descripción del beneficio</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">Beneficio esperado del proyecto</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Mejora concreta</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">¿Qué mejora concreta se espera obtener?</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Procesos que se optimizan</strong></td><td style="padding: 6px 12px;">Lista dinámica</td><td style="padding: 6px 12px;">Procesos que se benefician</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>¿Reducción de costos?</strong></td><td style="padding: 6px 12px;">Sí / No</td><td style="padding: 6px 12px;">Si es Sí, se muestra tabla de Análisis de Costos (actuales vs esperados con descripción, cantidad y valor COP)</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>¿Beneficio monetario directo?</strong></td><td style="padding: 6px 12px;">Sí / No</td><td style="padding: 6px 12px;">Si es Sí, se muestra tabla de items con descripción, cantidad, valor COP y justificación</td></tr>
  </tbody>
</table>

<h3>Paso 8 — Desempeño (KPIs)</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Indicadores</strong></td><td style="padding: 6px 12px;">Tabla dinámica</td><td style="padding: 6px 12px;">Nombre, Valor Actual, Valor Objetivo, Unidad (agregar/quitar filas)</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>¿Cómo se medirá?</strong></td><td style="padding: 6px 12px;">Área de texto</td><td style="padding: 6px 12px;">Método de medición de los indicadores</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Herramientas</strong></td><td style="padding: 6px 12px;">Texto</td><td style="padding: 6px 12px;">Ej: Excel, Power BI, Sistema interno</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Responsable de datos</strong></td><td style="padding: 6px 12px;">Texto</td><td style="padding: 6px 12px;">¿Quién captura y registra los datos?</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>¿Compromiso del sponsor?</strong></td><td style="padding: 6px 12px;">Sí / No</td><td style="padding: 6px 12px;">¿El sponsor se compromete a medir y reportar KPIs?</td></tr>
  </tbody>
</table>

<h3>Paso 9 — Plan de Implementación</h3>
<p>Este paso define cómo se pondrá en marcha el proyecto una vez completado el desarrollo. Las fases y tareas aquí definidas se usarán después como el cronograma de la fase de implementación del proyecto.</p>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Fases</strong></td><td style="padding: 6px 12px;">Etiquetas</td><td style="padding: 6px 12px;">Agregue fases de implementación por nombre (ej: Preparación, Migración, Capacitación, Lanzamiento)</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Tareas por fase</strong></td><td style="padding: 6px 12px;">Tabla dinámica</td><td style="padding: 6px 12px;">Nombre de tarea + duración en días por cada fase. Se genera automáticamente una vista previa tipo diagrama Gantt</td></tr>
  </tbody>
</table>

<!-- Gantt Preview Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 16px; margin: 16px 0; background: #fafafa;">
  <div style="font-weight: 600; margin-bottom: 8px;">Vista Previa — Diagrama Gantt de Implementación</div>
  <div style="font-size: 0.85em;">
    <div style="display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
      <div style="width: 150px; font-weight: 500;">Preparación</div>
      <div style="flex: 1;"><div style="background: #D52B1E; height: 14px; width: 30%; border-radius: 3px; opacity: 0.7;"></div></div>
    </div>
    <div style="display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
      <div style="width: 150px; padding-left: 12px;">Configurar servidor</div>
      <div style="flex: 1;"><div style="background: #D52B1E; height: 10px; width: 15%; border-radius: 3px;"></div></div>
    </div>
    <div style="display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
      <div style="width: 150px; padding-left: 12px;">Migrar datos</div>
      <div style="flex: 1; padding-left: 15%;"><div style="background: #D52B1E; height: 10px; width: 20%; border-radius: 3px;"></div></div>
    </div>
    <div style="display: flex; align-items: center; padding: 4px 0;">
      <div style="width: 150px; font-weight: 500;">Capacitación</div>
      <div style="flex: 1; padding-left: 35%;"><div style="background: #1890ff; height: 14px; width: 25%; border-radius: 3px; opacity: 0.7;"></div></div>
    </div>
  </div>
  <div style="color: #8c8c8c; font-size: 0.8em; margin-top: 8px;">El diagrama se genera automáticamente a medida que agrega fases y tareas con sus duraciones.</div>
</div>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
  <strong>Nota:</strong> Este plan de implementación será utilizado cuando el proyecto complete su fase de desarrollo y entre en la fase de implementación. Las tareas aquí definidas se convertirán en las tareas de seguimiento con progreso (0-100%) durante la implementación real.
</div>

<h3>Paso 10 — Adjuntos</h3>
<p>Suba hasta <strong>10 archivos</strong> adicionales (máx 10 MB cada uno) como anexos y soportes opcionales.</p>

<h3>Paso 11 — Declaración</h3>
<p>Confirme que la información es correcta y completa. Si usted es el sponsor, acepta participar en el seguimiento del proyecto.</p>

<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Formulario: Actualización</h2>
<p>Idéntico al formulario de Proyecto Nuevo, con una diferencia clave:</p>
<ul>
  <li>Se agrega un paso <strong>"Proyecto a Actualizar"</strong> donde debe seleccionar el proyecto existente que desea actualizar de una lista desplegable (o escribir el nombre si no aparece en la lista)</li>
  <li>Los textos de algunos campos se adaptan al contexto de actualización (ej: "necesidad de la actualización" en lugar de "necesidad del proyecto")</li>
</ul>
<p>Todos los demás pasos (Identificación, Stakeholders, Problemática, Urgencia, Solución, Beneficios, Desempeño, Implementación, Adjuntos, Declaración) son iguales.</p>

<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Formulario: Reporte de Fallo</h2>
<p>Formulario simplificado de <strong>4 pasos</strong> para reportar errores en aplicaciones existentes.</p>

<h3>Paso 1 — Identificación</h3>
<p>Nombre, Cargo, Área, Operación/Contrato, Correo y Cédula. <em>No se pregunta por sponsor.</em></p>

<h3>Paso 2 — Proyecto Referencia</h3>
<p>Seleccione el proyecto o aplicación donde se presenta el fallo (lista desplegable, o escriba el nombre).</p>

<h3>Paso 3 — Reporte</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Título del reporte</strong></td><td style="padding: 6px 12px;">Texto (5-100 chars)</td><td style="padding: 6px 12px;">Ej: Error en sistema de facturación al generar PDF</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Descripción del fallo</strong></td><td style="padding: 6px 12px;">Área de texto (20-2000 chars)</td><td style="padding: 6px 12px;">Descripción detallada del error</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Evidencia</strong></td><td style="padding: 6px 12px;">Archivos (máx 5)</td><td style="padding: 6px 12px;">Capturas de pantalla del error (opcional)</td></tr>
  </tbody>
</table>

<h3>Paso 4 — Criticidad</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Urgencia</strong></td><td style="padding: 6px 12px;">Selección (radio)</td><td style="padding: 6px 12px;">Baja, Media, Alta, Crítica (cada opción con descripción visual)</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Justificación</strong></td><td style="padding: 6px 12px;">Área de texto (10-500 chars)</td><td style="padding: 6px 12px;">Explique por qué seleccionó ese nivel de urgencia</td></tr>
  </tbody>
</table>

<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Formulario: Cierre de Servicio</h2>
<p>Formulario de <strong>5-6 pasos</strong> para solicitar la baja de un sistema o servicio.</p>

<h3>Paso 1 — Identificación</h3>
<p>Igual que Proyecto Nuevo: 7 campos + pregunta de sponsor.</p>

<h3>Paso 2 — Sponsor (condicional)</h3>
<p>Solo si no es el doliente/sponsor. Mismos campos que en Proyecto Nuevo.</p>

<h3>Paso 3 — Servicio a Cerrar</h3>
<p>Seleccione el servicio/proyecto a cerrar de la lista desplegable (o escriba el nombre).</p>

<h3>Paso 4 — Razonamiento</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Título de la solicitud</strong></td><td style="padding: 6px 12px;">Texto (5-100 chars)</td><td style="padding: 6px 12px;">Ej: Cierre de sistema de inventario legacy</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Razón de cierre</strong></td><td style="padding: 6px 12px;">Área de texto (20-2000 chars)</td><td style="padding: 6px 12px;">Descripción detallada de por qué se solicita el cierre</td></tr>
  </tbody>
</table>

<h3>Paso 5 — Responsables y Veedores</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Responsable del cierre</strong></td><td style="padding: 6px 12px;">Texto</td><td style="padding: 6px 12px;">Nombre completo del responsable</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Cargo del responsable</strong></td><td style="padding: 6px 12px;">Texto</td><td style="padding: 6px 12px;">Cargo del responsable del cierre</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Veedores</strong></td><td style="padding: 6px 12px;">Lista dinámica</td><td style="padding: 6px 12px;">Nombre + Cargo de cada veedor (agregar/quitar)</td></tr>
  </tbody>
</table>

<h3>Paso 6 — Confirmación</h3>
<p>Debe marcar la casilla <strong>"Confirmo que deseo solicitar el cierre de este servicio"</strong> para enviar.</p>

<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Formulario: Ticket de Soporte TI</h2>
<p>Formulario simplificado de <strong>3 pasos</strong> para reportar problemas de soporte técnico.</p>

<h3>Paso 1 — Identificación</h3>
<p>Nombre, Cargo, Área, Operación/Contrato, Correo y Cédula. <em>No se pregunta por sponsor.</em></p>

<h3>Paso 2 — Reporte del Problema</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Categoría</strong></td><td style="padding: 6px 12px;">Lista desplegable</td><td style="padding: 6px 12px;">Hardware, Software, Red, Acceso, Soporte General</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 6px 12px;"><strong>Título del ticket</strong></td><td style="padding: 6px 12px;">Texto (5-100 chars)</td><td style="padding: 6px 12px;">Ej: Problema con impresora en oficina 3er piso</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Descripción</strong></td><td style="padding: 6px 12px;">Área de texto (20-2000 chars)</td><td style="padding: 6px 12px;">Descripción detallada de la situación</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Evidencia</strong></td><td style="padding: 6px 12px;">Archivos (máx 5)</td><td style="padding: 6px 12px;">Capturas del error, fotos del problema (opcional)</td></tr>
  </tbody>
</table>

<h3>Paso 3 — Criticidad</h3>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Campo</th><th style="padding: 8px 12px; text-align: left;">Tipo</th><th style="padding: 8px 12px; text-align: left;">Descripción</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 6px 12px;"><strong>Urgencia</strong></td><td style="padding: 6px 12px;">Selección (radio)</td><td style="padding: 6px 12px;">Baja, Media, Alta, Crítica</td></tr>
    <tr><td style="padding: 6px 12px;"><strong>Justificación</strong></td><td style="padding: 6px 12px;">Área de texto (10-500 chars)</td><td style="padding: 6px 12px;">Explique la urgencia seleccionada</td></tr>
  </tbody>
</table>

<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
  <strong>Después de enviar:</strong> Al completar cualquier formulario, recibirá un <strong>código de seguimiento</strong> (ej: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">SOL-2026-0001</code> o <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">TKT-2026-0001</code>). Guárdelo para consultar el estado de su solicitud en cualquier momento.
</div>

</div>',
  v_cat_id, v_admin_id,
  ARRAY['guia', 'formularios', 'solicitudes', 'tickets', 'publico'],
  true, '["public"]'
) RETURNING id INTO v_art7;

-- =====================================================
-- Article 8: Guía de Búsqueda (Consulta por Código)
-- =====================================================
INSERT INTO conocimiento_articulos (titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, visibilidad)
VALUES (
  'Guía de Consulta por Código — Estado de Solicitudes, Tickets y Proyectos',
  'guia-busqueda',
  'Cómo consultar el estado de una solicitud, ticket o proyecto usando su código de seguimiento.',
  '<div>

<div style="background: linear-gradient(135deg, #D52B1E 0%, #8B1A12 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
  <h1 style="color: white; margin: 0;">Consulta por Código</h1>
  <p style="margin: 8px 0 0; opacity: 0.9;">Cómo consultar el estado de solicitudes, tickets y proyectos</p>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">¿Cómo Acceder?</h2>
<p>Desde la página principal del portal, haga clic en el botón <strong>"Consultar Estado de Solicitud"</strong>:</p>

<!-- Landing CTA Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; overflow: hidden; margin: 16px 0;">
  <div style="background: #1a1a1a; text-align: center; padding: 24px;">
    <div style="font-weight: 600; color: white; margin-bottom: 4px;">¿Ya tiene una solicitud?</div>
    <div style="color: rgba(255,255,255,0.85); margin-bottom: 12px;">Ingrese el código de su solicitud para consultar el estado actual</div>
    <span style="background: #D52B1E; color: white; padding: 8px 24px; border-radius: 6px;">🔍 Consultar Estado de Solicitud</span>
  </div>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Códigos de Seguimiento</h2>
<p>Cada solicitud, ticket o proyecto tiene un código único que se le entrega al momento de crearlo:</p>

<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 10px 12px; text-align: left;">Prefijo</th><th style="padding: 10px 12px; text-align: left;">Tipo</th><th style="padding: 10px 12px; text-align: left;">Ejemplo</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 12px;"><strong>SOL-</strong></td><td style="padding: 10px 12px;">Solicitud de desarrollo (NT)</td><td style="padding: 10px 12px;"><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">SOL-2026-0001</code></td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 10px 12px;"><strong>TKT-</strong></td><td style="padding: 10px 12px;">Ticket de soporte TI</td><td style="padding: 10px 12px;"><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">TKT-2026-0001</code></td></tr>
    <tr><td style="padding: 10px 12px;"><strong>PRY-</strong></td><td style="padding: 10px 12px;">Proyecto (derivado de solicitud aprobada)</td><td style="padding: 10px 12px;"><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">PRY-001</code></td></tr>
  </tbody>
</table>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Pantalla de Consulta</h2>
<p>Ingrese su código en la barra de búsqueda y haga clic en <strong>"Buscar"</strong>:</p>

<!-- Search Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 24px; margin: 16px 0; max-width: 600px; margin-left: auto; margin-right: auto;">
  <div style="text-align: center; font-size: 1.3em; font-weight: 600; margin-bottom: 16px;">Consultar Estado</div>
  <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 8px;">
    <div style="background: #f5f5f5; border: 1px solid #d9d9d9; border-radius: 6px; padding: 8px 12px; width: 280px; color: #bfbfbf;">Código (ej: SOL-2026-0001, TKT-...)</div>
    <div style="background: #D52B1E; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 500;">🔍 Buscar</div>
  </div>
  <div style="text-align: center; color: #8c8c8c; font-size: 0.85em;">Ingrese el código de su solicitud, ticket o proyecto</div>
</div>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Resultado: Solicitud (SOL-)</h2>
<p>Al consultar una solicitud, verá:</p>

<!-- Solicitud Result Mockup -->
<div style="border: 1px solid #d9d9d9; border-radius: 8px; padding: 24px; margin: 16px 0;">
  <div style="text-align: center; margin-bottom: 16px;">
    <div style="color: #D52B1E; font-size: 2em; margin-bottom: 8px;">🚀</div>
    <div style="font-size: 1.2em; font-weight: 600;">Nuevo sistema de inventario</div>
    <div style="color: #8c8c8c;">Código: SOL-2026-0042</div>
    <div style="margin-top: 8px;"><span style="background: #e6f7ff; color: #1890ff; padding: 4px 16px; border-radius: 4px; font-size: 1.1em;">En Evaluación</span></div>
  </div>
  <!-- Steps -->
  <div style="display: flex; justify-content: space-between; margin: 16px 0; font-size: 0.8em; text-align: center;">
    <div><div style="width: 24px; height: 24px; border-radius: 50%; background: #52c41a; color: white; margin: 0 auto 4px; line-height: 24px;">✓</div>Recibida</div>
    <div style="flex: 1; border-top: 2px solid #52c41a; margin-top: 12px;"></div>
    <div><div style="width: 24px; height: 24px; border-radius: 50%; background: #1890ff; color: white; margin: 0 auto 4px; line-height: 24px;">2</div>En Evaluación</div>
    <div style="flex: 1; border-top: 2px solid #d9d9d9; margin-top: 12px;"></div>
    <div style="color: #d9d9d9;"><div style="width: 24px; height: 24px; border-radius: 50%; background: #d9d9d9; color: white; margin: 0 auto 4px; line-height: 24px;">3</div>Revisión</div>
    <div style="flex: 1; border-top: 2px solid #d9d9d9; margin-top: 12px;"></div>
    <div style="color: #d9d9d9;"><div style="width: 24px; height: 24px; border-radius: 50%; background: #d9d9d9; color: white; margin: 0 auto 4px; line-height: 24px;">4</div>Aprobación</div>
    <div style="flex: 1; border-top: 2px solid #d9d9d9; margin-top: 12px;"></div>
    <div style="color: #d9d9d9;"><div style="width: 24px; height: 24px; border-radius: 50%; background: #d9d9d9; color: white; margin: 0 auto 4px; line-height: 24px;">5</div>Completada</div>
  </div>
  <!-- Progress Bar -->
  <div style="background: #f0f0f0; border-radius: 4px; height: 8px; margin: 16px 0;"><div style="background: #1890ff; height: 100%; width: 30%; border-radius: 4px;"></div></div>
  <div style="text-align: center; color: #8c8c8c; font-size: 0.85em;">30%</div>
  <!-- Details -->
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #f0f0f0;">
    <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 12px; background: #fafafa; width: 180px; font-weight: 500;">Tipo de Solicitud</td><td style="padding: 8px 12px;"><span style="background: #f0f0f0; padding: 1px 8px; border-radius: 4px;">Proyecto Nuevo</span></td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 12px; background: #fafafa; font-weight: 500;">Prioridad</td><td style="padding: 8px 12px;"><span style="background: #fff1f0; color: #D52B1E; padding: 1px 8px; border-radius: 4px;">ALTA</span></td></tr>
    <tr style="border-bottom: 1px solid #f0f0f0;"><td style="padding: 8px 12px; background: #fafafa; font-weight: 500;">Fecha de Creación</td><td style="padding: 8px 12px;">05/03/2026 14:30</td></tr>
    <tr><td style="padding: 8px 12px; background: #fafafa; font-weight: 500;">Última Actualización</td><td style="padding: 8px 12px;">06/03/2026 09:15</td></tr>
  </table>
</div>

<p>Si la solicitud fue transferida a otro código (ej: de SOL- a TKT-), verá un aviso con el enlace al nuevo código. Si la solicitud fue aprobada y tiene un proyecto en desarrollo, verá un enlace directo al proyecto (PRY-).</p>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Resultado: Ticket (TKT-)</h2>
<p>Al consultar un ticket, verá un formato similar con:</p>
<ul>
  <li>Título, código y estado actual con etiqueta de color</li>
  <li>Hitos de progreso: Recibido → En Proceso → Resuelto → Cerrado</li>
  <li>Barra de progreso</li>
  <li>Detalles: categoría, prioridad, fechas</li>
  <li>Comunicaciones: historial de comentarios entre el equipo TI y el solicitante</li>
</ul>

<h2 style="color: #D52B1E; border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Resultado: Proyecto (PRY-)</h2>
<p>Al consultar un proyecto, verá información detallada de progreso:</p>
<ul>
  <li>Estado del proyecto con etiqueta de color</li>
  <li>Progreso circular con porcentaje y conteo de tareas (ej: 5 de 12 tareas)</li>
  <li>Fecha estimada de finalización (con indicación si va adelantado, como planeado, o con retrasos)</li>
  <li>Fechas de inicio y fin programadas</li>
  <li>Enlace a la solicitud original (SOL-)</li>
  <li>Comunicaciones del equipo de desarrollo</li>
</ul>

<h3>Estados del Proyecto</h3>
<p>Los proyectos siguen una progresión de estados que incluye una fase de implementación posterior al desarrollo:</p>
<div style="background: #fafafa; border-radius: 8px; padding: 16px; margin: 16px 0; overflow-x: auto; font-family: monospace; font-size: 0.85em;">
  planificación → en_desarrollo → <strong>en_implementación</strong> → solucionado
  <div style="color: #8c8c8c; font-family: sans-serif; margin-top: 4px;">También: pausado, cancelado</div>
</div>

<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <thead><tr style="background: #D52B1E; color: white;"><th style="padding: 8px 12px; text-align: left;">Estado</th><th style="padding: 8px 12px; text-align: left;">Significado</th></tr></thead>
  <tbody>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><span style="background: #f0f0f0; padding: 1px 8px; border-radius: 4px;">Planificación</span></td><td style="padding: 8px 12px;">El proyecto ha sido aprobado y se está configurando el cronograma y equipo</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 8px 12px;"><span style="background: #e6f7ff; color: #1890ff; padding: 1px 8px; border-radius: 4px;">En Desarrollo</span></td><td style="padding: 8px 12px;">El equipo NT está trabajando activamente en la construcción del proyecto</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><span style="background: #f9f0ff; color: #722ed1; padding: 1px 8px; border-radius: 4px;">En Implementación</span></td><td style="padding: 8px 12px;">El desarrollo está completo y el proyecto se encuentra en proceso de puesta en marcha (migración, capacitación, despliegue)</td></tr>
    <tr style="border-bottom: 1px solid #eee; background: #fafafa;"><td style="padding: 8px 12px;"><span style="background: #f6ffed; color: #52c41a; padding: 1px 8px; border-radius: 4px;">Solucionado</span></td><td style="padding: 8px 12px;">El proyecto ha sido completado e implementado exitosamente</td></tr>
    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 12px;"><span style="background: #fffbe6; color: #faad14; padding: 1px 8px; border-radius: 4px;">Pausado</span></td><td style="padding: 8px 12px;">El proyecto está temporalmente detenido</td></tr>
    <tr><td style="padding: 8px 12px;"><span style="background: #fff1f0; color: #D52B1E; padding: 1px 8px; border-radius: 4px;">Cancelado</span></td><td style="padding: 8px 12px;">El proyecto ha sido cancelado</td></tr>
  </tbody>
</table>

<p>Cuando un proyecto está en estado <strong>En Implementación</strong>, la consulta mostrará adicionalmente el progreso de las tareas de implementación (ej: 3 de 5 tareas completadas) y el porcentaje de avance de la implementación.</p>

<div style="border-left: 4px solid #D52B1E; background: #fff1f0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
  <strong>Consejo:</strong> Guarde siempre su código de seguimiento al crear una solicitud o ticket. Lo necesitará para consultar el estado en cualquier momento sin necesidad de iniciar sesión.
</div>

</div>',
  v_cat_id, v_admin_id,
  ARRAY['guia', 'consulta', 'codigo', 'estado', 'seguimiento'],
  true, '["public"]'
) RETURNING id INTO v_art8;

-- =====================================================
-- Second pass: Update related articles with actual IDs
-- =====================================================

UPDATE conocimiento_articulos SET articulos_relacionados = ARRAY[v_art2, v_art3, v_art4, v_art5, v_art6, v_art7, v_art8]
WHERE id = v_art1;
UPDATE conocimiento_articulos SET articulos_relacionados = ARRAY[v_art1, v_art5, v_art7, v_art8]
WHERE id = v_art2;
UPDATE conocimiento_articulos SET articulos_relacionados = ARRAY[v_art1, v_art6, v_art7, v_art8]
WHERE id = v_art3;
UPDATE conocimiento_articulos SET articulos_relacionados = ARRAY[v_art1, v_art7, v_art8]
WHERE id = v_art4;
UPDATE conocimiento_articulos SET articulos_relacionados = ARRAY[v_art1, v_art2, v_art7, v_art8]
WHERE id = v_art5;
UPDATE conocimiento_articulos SET articulos_relacionados = ARRAY[v_art1, v_art3, v_art7, v_art8]
WHERE id = v_art6;
UPDATE conocimiento_articulos SET articulos_relacionados = ARRAY[v_art1, v_art2, v_art3, v_art4, v_art8]
WHERE id = v_art7;
UPDATE conocimiento_articulos SET articulos_relacionados = ARRAY[v_art1, v_art2, v_art3, v_art4, v_art7]
WHERE id = v_art8;

END $$;
