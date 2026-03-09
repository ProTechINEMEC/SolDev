const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/dashboard/nt - NT Dashboard
router.get('/nt', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    // Solicitudes stats
    const solicitudesStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'pendiente_evaluacion_nt') as pendientes_evaluacion,
        COUNT(*) FILTER (WHERE estado = 'pendiente_aprobacion_gerencia') as pendientes_gerencia,
        COUNT(*) FILTER (WHERE estado = 'aprobado') as aprobadas,
        COUNT(*) FILTER (WHERE estado = 'en_desarrollo') as en_desarrollo,
        COUNT(*) FILTER (WHERE estado IN ('descartado_nt', 'rechazado_gerencia')) as rechazadas,
        COUNT(*) FILTER (WHERE estado = 'completado') as completadas,
        COUNT(*) FILTER (WHERE creado_en >= NOW() - INTERVAL '7 days') as nuevas_semana,
        COUNT(*) FILTER (WHERE creado_en >= NOW() - INTERVAL '30 days') as nuevas_mes
      FROM solicitudes
    `);

    // Projects stats (NT: only projects where user is responsable or team member)
    const proyectosStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'planificacion') as planificacion,
        COUNT(*) FILTER (WHERE estado = 'en_desarrollo') as en_desarrollo,
        COUNT(*) FILTER (WHERE estado = 'pausado') as pausados,
        COUNT(*) FILTER (WHERE estado = 'completado') as completados,
        COUNT(*) as total
      FROM proyectos p
      WHERE (p.responsable_id = $1 OR EXISTS (
        SELECT 1 FROM proyecto_miembros pm
        WHERE pm.proyecto_id = p.id AND pm.usuario_id = $1
      ))
    `, [req.user.id]);

    // Escalated tickets
    const ticketsEscalados = await pool.query(`
      SELECT COUNT(*) as total FROM tickets WHERE estado = 'escalado_nt'
    `);

    // Tasks due today: project tasks assigned to user + implementation tasks on user's projects
    const tareasHoy = await pool.query(`
      SELECT (
        SELECT COUNT(*) FROM proyecto_tareas pt
        JOIN proyectos p ON pt.proyecto_id = p.id
        WHERE pt.asignado_id = $1
          AND CURRENT_DATE BETWEEN pt.fecha_inicio AND pt.fecha_fin
          AND pt.completada = false
          AND p.estado IN ('planificacion', 'en_desarrollo')
      ) + (
        SELECT COUNT(*) FROM implementacion_tareas it
        JOIN proyectos p ON it.proyecto_id = p.id
        WHERE CURRENT_DATE BETWEEN it.fecha_inicio AND it.fecha_fin
          AND it.completada = false
          AND p.estado = 'en_implementacion'
          AND (p.responsable_id = $1 OR EXISTS (
            SELECT 1 FROM proyecto_miembros pm
            WHERE pm.proyecto_id = p.id AND pm.usuario_id = $1
          ))
      ) as total
    `, [req.user.id]);

    // Recent solicitudes
    const solicitudesRecientes = await pool.query(`
      SELECT s.id, s.codigo, s.titulo, s.tipo, s.estado, s.prioridad, s.creado_en,
        sol.nombre as solicitante_nombre
      FROM solicitudes s
      LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
      WHERE s.estado = 'pendiente_evaluacion_nt'
      ORDER BY
        CASE s.prioridad
          WHEN 'critica' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          ELSE 4
        END,
        s.creado_en DESC
      LIMIT 10
    `);

    // Active projects (NT: only where user is team member)
    const proyectosActivos = await pool.query(`
      SELECT p.id, p.codigo, p.titulo, p.estado, p.creado_en,
        u.nombre as responsable_nombre,
        (SELECT COUNT(*) FROM proyecto_tareas WHERE proyecto_id = p.id) as total_tareas,
        (SELECT COUNT(*) FROM proyecto_tareas WHERE proyecto_id = p.id AND completada = true) as tareas_completadas
      FROM proyectos p
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      WHERE p.estado IN ('planificacion', 'en_desarrollo')
        AND (p.responsable_id = $1 OR EXISTS (
          SELECT 1 FROM proyecto_miembros pm
          WHERE pm.proyecto_id = p.id AND pm.usuario_id = $1
        ))
      ORDER BY p.actualizado_en DESC
      LIMIT 5
    `, [req.user.id]);

    // Solicitudes by type (last 30 days)
    const solicitudesPorTipo = await pool.query(`
      SELECT tipo, COUNT(*) as cantidad
      FROM solicitudes
      WHERE creado_en >= NOW() - INTERVAL '30 days'
      GROUP BY tipo
    `);

    // Implementation projects (NT: only user's projects)
    const proyectosImplementacion = await pool.query(`
      SELECT p.id, p.codigo, p.titulo,
        (SELECT COUNT(*) FROM implementacion_tareas WHERE proyecto_id = p.id) as impl_total,
        (SELECT COUNT(*) FROM implementacion_tareas WHERE proyecto_id = p.id AND completada = true) as impl_completadas
      FROM proyectos p
      WHERE p.estado = 'en_implementacion'
        AND (p.responsable_id = $1 OR EXISTS (
          SELECT 1 FROM proyecto_miembros pm
          WHERE pm.proyecto_id = p.id AND pm.usuario_id = $1
        ))
      ORDER BY p.actualizado_en DESC
      LIMIT 5
    `, [req.user.id]);

    // Notifications
    const notificaciones = await pool.query(`
      SELECT * FROM notificaciones
      WHERE usuario_id = $1 AND leida = false
      ORDER BY creado_en DESC LIMIT 10
    `, [req.user.id]);

    res.json({
      solicitudes: solicitudesStats.rows[0],
      proyectos: proyectosStats.rows[0],
      ticketsEscalados: parseInt(ticketsEscalados.rows[0].total, 10),
      tareasHoy: parseInt(tareasHoy.rows[0].total, 10),
      solicitudesRecientes: solicitudesRecientes.rows,
      proyectosActivos: proyectosActivos.rows,
      proyectosImplementacion: proyectosImplementacion.rows,
      solicitudesPorTipo: solicitudesPorTipo.rows,
      notificaciones: notificaciones.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/ti - TI Dashboard (accessible by TI workers and TI Coordinator)
router.get('/ti', authenticate, authorize('ti', 'coordinador_ti'), async (req, res, next) => {
  try {
    // Contract filter for TI users (coordinador_ti sees all)
    const isTI = req.user.rol === 'ti';
    const contratos = isTI ? (req.user.contratos || []) : [];
    const hasContratos = isTI && contratos.length > 0;
    const contratoFilter = isTI
      ? (hasContratos ? ` AND datos_solicitante->>'operacion_contrato' = ANY($1)` : ` AND false`)
      : '';
    const contratoParams = hasContratos ? [contratos] : [];

    // Abiertos (contract-filtered for TI, global for coordinator)
    const abiertosResult = await pool.query(`
      SELECT COUNT(*) as abiertos FROM tickets WHERE estado = 'abierto'${contratoFilter}
    `, contratoParams);

    // Personal stats for TI user, department-wide for coordinator
    const personalFilter = isTI ? ' AND asignado_id = $1' : '';
    const personalParams = isTI ? [req.user.id] : [];
    const otherStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'en_proceso') as en_proceso,
        COUNT(*) FILTER (WHERE estado IN ('resuelto', 'solucionado', 'cerrado')
          AND DATE(fecha_resolucion) = CURRENT_DATE) as resueltos_hoy,
        AVG(EXTRACT(EPOCH FROM (fecha_resolucion - creado_en))/3600)
          FILTER (WHERE fecha_resolucion IS NOT NULL) as tiempo_promedio_horas
      FROM tickets
      WHERE 1=1${personalFilter}
    `, personalParams);

    const ticketsStats = {
      abiertos: parseInt(abiertosResult.rows[0].abiertos, 10),
      en_proceso: parseInt(otherStats.rows[0].en_proceso, 10),
      resueltos_hoy: parseInt(otherStats.rows[0].resueltos_hoy, 10),
      tiempo_promedio_horas: otherStats.rows[0].tiempo_promedio_horas
        ? parseFloat(otherStats.rows[0].tiempo_promedio_horas)
        : null
    };

    // My tickets (already filtered by asignado_id — keep as-is)
    const misTickets = await pool.query(`
      SELECT * FROM tickets
      WHERE asignado_id = $1 AND estado IN ('en_proceso', 'abierto')
      ORDER BY
        CASE prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
        creado_en
      LIMIT 10
    `, [req.user.id]);

    // Unassigned tickets (TI: only from their contracts)
    const unassignedFilter = isTI
      ? (hasContratos ? ` AND datos_solicitante->>'operacion_contrato' = ANY($1)` : ` AND false`)
      : '';
    const ticketsSinAsignar = await pool.query(`
      SELECT * FROM tickets
      WHERE asignado_id IS NULL AND estado = 'abierto'${unassignedFilter}
      ORDER BY
        CASE prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
        creado_en
      LIMIT 10
    `, contratoParams);

    // Tickets by category (TI: only from their contracts)
    const ticketsPorCategoria = await pool.query(`
      SELECT categoria, COUNT(*) as cantidad
      FROM tickets
      WHERE creado_en >= NOW() - INTERVAL '30 days'${contratoFilter}
      GROUP BY categoria
    `, contratoParams);

    // Notifications
    const notificaciones = await pool.query(`
      SELECT * FROM notificaciones
      WHERE usuario_id = $1 AND leida = false
      ORDER BY creado_en DESC LIMIT 10
    `, [req.user.id]);

    res.json({
      tickets: ticketsStats,
      misTickets: misTickets.rows,
      ticketsSinAsignar: ticketsSinAsignar.rows,
      ticketsPorCategoria: ticketsPorCategoria.rows,
      notificaciones: notificaciones.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/gerencia - Gerencia Dashboard
router.get('/gerencia', authenticate, authorize('gerencia'), async (req, res, next) => {
  try {
    // Pending approvals
    const pendientesAprobacion = await pool.query(`
      SELECT s.*, sol.nombre as solicitante_nombre
      FROM solicitudes s
      LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
      WHERE s.estado = 'pendiente_aprobacion_gerencia'
      ORDER BY
        CASE s.prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
        s.creado_en
    `);

    // Global stats
    const globalStats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM solicitudes WHERE estado = 'pendiente_aprobacion_gerencia') as pendientes_aprobacion,
        (SELECT COUNT(*) FROM proyectos WHERE estado IN ('planificacion', 'en_desarrollo')) as proyectos_activos,
        (SELECT COUNT(*) FROM solicitudes WHERE estado = 'agendado') as agendados,
        (SELECT COUNT(*) FROM tickets WHERE estado IN ('abierto', 'en_proceso')) as tickets_abiertos
    `);

    // Monthly trend (solicitudes)
    const tendenciaMensual = await pool.query(`
      SELECT
        DATE_TRUNC('month', creado_en) as mes,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado IN ('aprobado', 'en_desarrollo', 'completado')) as aprobadas
      FROM solicitudes
      WHERE creado_en >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', creado_en)
      ORDER BY mes
    `);

    // Active projects overview
    const proyectosResumen = await pool.query(`
      SELECT p.id, p.codigo, p.titulo, p.estado, p.creado_en,
        u.nombre as responsable_nombre,
        s.datos_solicitante->>'departamento' as departamento
      FROM proyectos p
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      LEFT JOIN solicitudes s ON p.solicitud_id = s.id
      WHERE p.estado IN ('planificacion', 'en_desarrollo')
      ORDER BY p.creado_en DESC
      LIMIT 10
    `);

    // Latest weekly report
    const ultimoReporte = await pool.query(`
      SELECT * FROM reportes_semanales
      ORDER BY fecha_fin DESC LIMIT 1
    `);

    // Implementation projects (gerencia sees all)
    const proyectosImplementacion = await pool.query(`
      SELECT p.id, p.codigo, p.titulo,
        (SELECT COUNT(*) FROM implementacion_tareas WHERE proyecto_id = p.id) as impl_total,
        (SELECT COUNT(*) FROM implementacion_tareas WHERE proyecto_id = p.id AND completada = true) as impl_completadas
      FROM proyectos p
      WHERE p.estado = 'en_implementacion'
      ORDER BY p.actualizado_en DESC
      LIMIT 5
    `);

    // Notifications
    const notificaciones = await pool.query(`
      SELECT * FROM notificaciones
      WHERE usuario_id = $1 AND leida = false
      ORDER BY creado_en DESC LIMIT 10
    `, [req.user.id]);

    res.json({
      pendientesAprobacion: pendientesAprobacion.rows,
      stats: globalStats.rows[0],
      tendenciaMensual: tendenciaMensual.rows,
      proyectosResumen: proyectosResumen.rows,
      proyectosImplementacion: proyectosImplementacion.rows,
      ultimoReporte: ultimoReporte.rows[0] || null,
      notificaciones: notificaciones.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/coordinador-nt - Coordinator NT Dashboard
router.get('/coordinador-nt', authenticate, authorize('coordinador_nt'), async (req, res, next) => {
  try {
    // Pending reviews (solicitudes waiting for coordinator approval)
    const pendientesRevision = await pool.query(`
      SELECT s.*, sol.nombre as solicitante_nombre,
        e.recomendacion, e.resumen_ejecutivo,
        u.nombre as evaluador_nombre
      FROM solicitudes s
      LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
      LEFT JOIN evaluaciones_nt e ON e.solicitud_id = s.id AND e.estado = 'enviado'
      LEFT JOIN usuarios u ON e.evaluador_id = u.id
      WHERE s.estado = 'pendiente_revision_coordinador_nt'
      ORDER BY
        CASE s.prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
        s.creado_en
    `);

    // Coordinator stats
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM solicitudes WHERE estado = 'pendiente_revision_coordinador_nt') as pendientes_revision,
        (SELECT COUNT(*) FROM decisiones_coordinador WHERE tipo_coordinador = 'coordinador_nt' AND accion = 'aprobar' AND creado_en >= NOW() - INTERVAL '7 days') as aprobados_semana,
        (SELECT COUNT(*) FROM decisiones_coordinador WHERE tipo_coordinador = 'coordinador_nt' AND accion = 'rechazar' AND creado_en >= NOW() - INTERVAL '7 days') as rechazados_semana,
        (SELECT COUNT(*) FROM decisiones_coordinador WHERE tipo_coordinador = 'coordinador_nt' AND accion = 'reevaluar' AND creado_en >= NOW() - INTERVAL '7 days') as reevaluaciones_semana,
        (SELECT COUNT(*) FROM solicitudes WHERE estado = 'pendiente_aprobacion_gerencia') as en_gerencia,
        (SELECT COUNT(*) FROM proyectos WHERE estado IN ('planificacion', 'en_desarrollo')) as proyectos_activos,
        (SELECT COUNT(*) FROM decisiones_coordinador WHERE tipo_coordinador = 'coordinador_nt' AND accion = 'aprobar') as aprobados_total,
        (SELECT COUNT(*) FROM decisiones_coordinador WHERE tipo_coordinador = 'coordinador_nt' AND accion = 'rechazar') as rechazados_total,
        (SELECT COUNT(*) FROM decisiones_coordinador WHERE tipo_coordinador = 'coordinador_nt' AND accion = 'reevaluar') as reevaluaciones_total,
        (SELECT COUNT(*) FROM decisiones_coordinador WHERE tipo_coordinador = 'coordinador_nt' AND accion = 'aprobar' AND DATE(creado_en) = CURRENT_DATE) as aprobados_hoy
    `);

    // Recent decisions by this coordinator
    const misDecisiones = await pool.query(`
      SELECT dc.*, s.titulo as solicitud_titulo, s.codigo as solicitud_codigo
      FROM decisiones_coordinador dc
      LEFT JOIN solicitudes s ON dc.entidad_id = s.id AND dc.entidad_tipo = 'solicitud'
      WHERE dc.coordinador_id = $1
      ORDER BY dc.creado_en DESC
      LIMIT 10
    `, [req.user.id]);

    // Projects in progress (for calendar view context)
    const proyectosActivos = await pool.query(`
      SELECT p.id, p.codigo, p.titulo, p.estado,
        s.fecha_inicio_agendada, s.fecha_fin_estimada
      FROM proyectos p
      LEFT JOIN solicitudes s ON p.solicitud_id = s.id
      WHERE p.estado IN ('planificacion', 'en_desarrollo')
      ORDER BY s.fecha_inicio_agendada ASC
      LIMIT 20
    `);

    // Implementation projects (all, coordinator sees everything)
    const proyectosImplementacion = await pool.query(`
      SELECT p.id, p.codigo, p.titulo,
        (SELECT COUNT(*) FROM implementacion_tareas WHERE proyecto_id = p.id) as impl_total,
        (SELECT COUNT(*) FROM implementacion_tareas WHERE proyecto_id = p.id AND completada = true) as impl_completadas
      FROM proyectos p
      WHERE p.estado = 'en_implementacion'
      ORDER BY p.actualizado_en DESC
      LIMIT 5
    `);

    // Notifications
    const notificaciones = await pool.query(`
      SELECT * FROM notificaciones
      WHERE usuario_id = $1 AND leida = false
      ORDER BY creado_en DESC LIMIT 10
    `, [req.user.id]);

    res.json({
      pendientesRevision: pendientesRevision.rows,
      stats: stats.rows[0],
      misDecisiones: misDecisiones.rows,
      proyectosActivos: proyectosActivos.rows,
      proyectosImplementacion: proyectosImplementacion.rows,
      notificaciones: notificaciones.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/coordinador-ti - Coordinator TI Dashboard
router.get('/coordinador-ti', authenticate, authorize('coordinador_ti'), async (req, res, next) => {
  try {
    // All tickets stats (coordinator sees everything)
    const ticketsStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'abierto') as tickets_abiertos,
        COUNT(*) FILTER (WHERE estado = 'en_proceso') as tickets_en_proceso,
        COUNT(*) FILTER (WHERE estado IN ('resuelto', 'solucionado', 'cerrado')) as resueltos,
        COUNT(*) FILTER (WHERE estado = 'escalado_nt') as escalados,
        COUNT(*) FILTER (WHERE cerrado_forzado = true) as cierres_forzados_total,
        COUNT(*) FILTER (WHERE creado_en >= NOW() - INTERVAL '24 hours') as ultimas_24h,
        COUNT(*) FILTER (WHERE creado_en >= NOW() - INTERVAL '7 days') as ultima_semana,
        COUNT(*) FILTER (WHERE estado IN ('resuelto', 'solucionado', 'cerrado') AND fecha_resolucion >= NOW() - INTERVAL '7 days') as resueltos_semana,
        COUNT(*) FILTER (WHERE estado IN ('resuelto', 'solucionado', 'cerrado') AND DATE(fecha_resolucion) = CURRENT_DATE) as resueltos_hoy,
        COUNT(*) FILTER (WHERE estado IN ('resuelto', 'solucionado', 'cerrado') AND fecha_resolucion >= DATE_TRUNC('month', CURRENT_DATE)) as resueltos_mes,
        (SELECT COUNT(*) FROM decisiones_coordinador WHERE tipo_coordinador = 'coordinador_ti' AND accion = 'reasignar') as reasignaciones_total,
        (SELECT COUNT(*) FROM usuarios WHERE rol = 'ti' AND activo = true) as trabajadores_ti,
        AVG(EXTRACT(EPOCH FROM (fecha_resolucion - creado_en))/3600)
          FILTER (WHERE fecha_resolucion IS NOT NULL) as tiempo_promedio_horas
      FROM tickets
    `);

    // Tickets per TI worker
    const ticketsPorTrabajador = await pool.query(`
      SELECT u.id, u.nombre,
        COUNT(t.id) as tickets_asignados,
        COUNT(t.id) FILTER (WHERE t.estado = 'en_proceso') as en_proceso,
        COUNT(t.id) FILTER (WHERE t.estado IN ('resuelto', 'solucionado', 'cerrado') AND t.fecha_resolucion >= DATE_TRUNC('month', CURRENT_DATE)) as resueltos_mes,
        ROUND(AVG(EXTRACT(EPOCH FROM (t.fecha_resolucion - t.creado_en))/86400) FILTER (WHERE t.fecha_resolucion IS NOT NULL), 1) as tiempo_promedio_dias
      FROM usuarios u
      LEFT JOIN tickets t ON t.asignado_id = u.id
      WHERE u.rol = 'ti' AND u.activo = true
      GROUP BY u.id, u.nombre
      ORDER BY tickets_asignados DESC
    `);

    // Tickets waiting in queue (unassigned)
    const ticketsEnCola = await pool.query(`
      SELECT t.*, sol.nombre as solicitante_nombre,
        EXTRACT(EPOCH FROM (NOW() - t.creado_en))/3600 as horas_en_cola
      FROM tickets t
      LEFT JOIN solicitantes sol ON t.solicitante_id = sol.id
      WHERE t.asignado_id IS NULL AND t.estado = 'abierto'
      ORDER BY
        CASE t.prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
        t.creado_en
      LIMIT 20
    `);

    // Tickets taken but not resolved (long-running)
    const ticketsTomadosSinResolver = await pool.query(`
      SELECT t.*, u.nombre as asignado_nombre, sol.nombre as solicitante_nombre,
        EXTRACT(EPOCH FROM (NOW() - t.actualizado_en))/3600 as horas_tomado,
        t.actualizado_en as fecha_asignacion
      FROM tickets t
      LEFT JOIN usuarios u ON t.asignado_id = u.id
      LEFT JOIN solicitantes sol ON t.solicitante_id = sol.id
      WHERE t.asignado_id IS NOT NULL AND t.estado = 'en_proceso'
      ORDER BY t.actualizado_en ASC
      LIMIT 20
    `);

    // Coordinator decisions (reassignments, force closes)
    const misDecisiones = await pool.query(`
      SELECT dc.*, t.titulo as ticket_titulo, t.codigo as ticket_codigo,
        u_prev.nombre as asignado_anterior_nombre,
        u_new.nombre as asignado_nuevo_nombre
      FROM decisiones_coordinador dc
      LEFT JOIN tickets t ON dc.entidad_id = t.id AND dc.entidad_tipo = 'ticket'
      LEFT JOIN usuarios u_prev ON dc.asignado_anterior_id = u_prev.id
      LEFT JOIN usuarios u_new ON dc.asignado_nuevo_id = u_new.id
      WHERE dc.coordinador_id = $1
      ORDER BY dc.creado_en DESC
      LIMIT 10
    `, [req.user.id]);

    // Notifications
    const notificaciones = await pool.query(`
      SELECT * FROM notificaciones
      WHERE usuario_id = $1 AND leida = false
      ORDER BY creado_en DESC LIMIT 10
    `, [req.user.id]);

    res.json({
      stats: ticketsStats.rows[0],
      ticketsPorTrabajador: ticketsPorTrabajador.rows,
      ticketsEnCola: ticketsEnCola.rows,
      ticketsTomadosSinResolver: ticketsTomadosSinResolver.rows,
      misDecisiones: misDecisiones.rows,
      notificaciones: notificaciones.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/admin - Admin Dashboard
router.get('/admin', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    // User stats (exclude test and admin users)
    const userStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE activo = true) as activos,
        COUNT(*) FILTER (WHERE activo = false) as inactivos,
        COUNT(*) FILTER (WHERE rol = 'nuevas_tecnologias') as nt,
        COUNT(*) FILTER (WHERE rol = 'ti') as ti,
        COUNT(*) FILTER (WHERE rol = 'gerencia') as gerencia,
        COUNT(*) FILTER (WHERE rol = 'coordinador_nt') as coordinador_nt,
        COUNT(*) FILTER (WHERE rol = 'coordinador_ti') as coordinador_ti
      FROM usuarios
      WHERE es_prueba = false AND rol != 'admin'
    `);

    // Recent system activity
    const recentActivity = await pool.query(`
      SELECT h.id, h.entidad_tipo, h.entidad_id, h.accion, h.creado_en,
             u.nombre as usuario_nombre
      FROM historial_cambios h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      ORDER BY h.creado_en DESC
      LIMIT 10
    `);

    // Global counts
    const globalCounts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM solicitudes) as total_solicitudes,
        (SELECT COUNT(*) FROM solicitudes WHERE estado IN ('pendiente_evaluacion_nt', 'pendiente_revision_coordinador_nt', 'pendiente_aprobacion_gerencia')) as solicitudes_pendientes,
        (SELECT COUNT(*) FROM tickets) as total_tickets,
        (SELECT COUNT(*) FROM tickets WHERE estado IN ('abierto', 'en_proceso')) as tickets_abiertos,
        (SELECT COUNT(*) FROM proyectos) as total_proyectos,
        (SELECT COUNT(*) FROM proyectos WHERE estado IN ('planificacion', 'en_desarrollo')) as proyectos_activos
    `);

    // Test users status
    const testUsersStatus = await pool.query(`
      SELECT
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE activo = true) as enabled_count
      FROM usuarios WHERE es_prueba = true
    `);

    const testCount = parseInt(testUsersStatus.rows[0].count, 10);
    const testEnabledCount = parseInt(testUsersStatus.rows[0].enabled_count, 10);

    // Notifications
    const notificaciones = await pool.query(`
      SELECT * FROM notificaciones
      WHERE usuario_id = $1 AND leida = false
      ORDER BY creado_en DESC LIMIT 10
    `, [req.user.id]);

    res.json({
      users: userStats.rows[0],
      recentActivity: recentActivity.rows,
      counts: globalCounts.rows[0],
      testUsers: {
        enabled: testEnabledCount > 0 && testEnabledCount === testCount,
        count: testCount,
        enabledCount: testEnabledCount
      },
      notificaciones: notificaciones.rows
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/dashboard/notificaciones/:id/leer - Mark notification as read
router.put('/notificaciones/:id/leer', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE notificaciones SET leida = true, leida_en = NOW()
       WHERE id = $1 AND usuario_id = $2`,
      [id, req.user.id]
    );

    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/dashboard/notificaciones/leer-todas - Mark all as read
router.put('/notificaciones/leer-todas', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notificaciones SET leida = true, leida_en = NOW()
       WHERE usuario_id = $1 AND leida = false`,
      [req.user.id]
    );

    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
