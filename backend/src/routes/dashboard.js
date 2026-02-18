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

    // Projects stats
    const proyectosStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'planificacion') as planificacion,
        COUNT(*) FILTER (WHERE estado = 'en_desarrollo') as en_desarrollo,
        COUNT(*) FILTER (WHERE estado = 'pausado') as pausados,
        COUNT(*) FILTER (WHERE estado = 'completado') as completados,
        COUNT(*) as total
      FROM proyectos
    `);

    // Escalated tickets
    const ticketsEscalados = await pool.query(`
      SELECT COUNT(*) as total FROM tickets WHERE estado = 'escalado_nt'
    `);

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

    // Active projects
    const proyectosActivos = await pool.query(`
      SELECT p.id, p.codigo, p.titulo, p.estado, p.creado_en,
        u.nombre as responsable_nombre,
        (SELECT COUNT(*) FROM proyecto_tareas WHERE proyecto_id = p.id) as total_tareas,
        (SELECT COUNT(*) FROM proyecto_tareas WHERE proyecto_id = p.id AND completada = true) as tareas_completadas
      FROM proyectos p
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      WHERE p.estado IN ('planificacion', 'en_desarrollo')
      ORDER BY p.actualizado_en DESC
      LIMIT 5
    `);

    // Solicitudes by type (last 30 days)
    const solicitudesPorTipo = await pool.query(`
      SELECT tipo, COUNT(*) as cantidad
      FROM solicitudes
      WHERE creado_en >= NOW() - INTERVAL '30 days'
      GROUP BY tipo
    `);

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
      solicitudesRecientes: solicitudesRecientes.rows,
      proyectosActivos: proyectosActivos.rows,
      solicitudesPorTipo: solicitudesPorTipo.rows,
      notificaciones: notificaciones.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/ti - TI Dashboard
router.get('/ti', authenticate, authorize('ti'), async (req, res, next) => {
  try {
    // Tickets stats
    const ticketsStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'abierto') as abiertos,
        COUNT(*) FILTER (WHERE estado = 'en_proceso') as en_proceso,
        COUNT(*) FILTER (WHERE estado = 'resuelto') as resueltos,
        COUNT(*) FILTER (WHERE estado = 'cerrado') as cerrados,
        COUNT(*) FILTER (WHERE estado = 'escalado_nt') as escalados,
        COUNT(*) FILTER (WHERE creado_en >= NOW() - INTERVAL '24 hours') as ultimas_24h,
        COUNT(*) FILTER (WHERE creado_en >= NOW() - INTERVAL '7 days') as ultima_semana,
        AVG(EXTRACT(EPOCH FROM (fecha_resolucion - creado_en))/3600)
          FILTER (WHERE fecha_resolucion IS NOT NULL) as tiempo_promedio_horas
      FROM tickets
    `);

    // My tickets
    const misTickets = await pool.query(`
      SELECT * FROM tickets
      WHERE asignado_id = $1 AND estado IN ('en_proceso', 'abierto')
      ORDER BY
        CASE prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
        creado_en
      LIMIT 10
    `, [req.user.id]);

    // Unassigned tickets
    const ticketsSinAsignar = await pool.query(`
      SELECT * FROM tickets
      WHERE asignado_id IS NULL AND estado = 'abierto'
      ORDER BY
        CASE prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
        creado_en
      LIMIT 10
    `);

    // Tickets by category
    const ticketsPorCategoria = await pool.query(`
      SELECT categoria, COUNT(*) as cantidad
      FROM tickets
      WHERE creado_en >= NOW() - INTERVAL '30 days'
      GROUP BY categoria
    `);

    // Notifications
    const notificaciones = await pool.query(`
      SELECT * FROM notificaciones
      WHERE usuario_id = $1 AND leida = false
      ORDER BY creado_en DESC LIMIT 10
    `, [req.user.id]);

    res.json({
      tickets: ticketsStats.rows[0],
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
        (SELECT COUNT(*) FROM proyectos WHERE estado = 'completado' AND
          EXTRACT(YEAR FROM actualizado_en) = EXTRACT(YEAR FROM NOW())) as proyectos_completados_ano,
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
      ultimoReporte: ultimoReporte.rows[0] || null,
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
