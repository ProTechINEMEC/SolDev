const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/reportes/semanal - Get weekly report
router.get('/semanal', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { fecha } = req.query;

    let query;
    let params = [];

    if (fecha) {
      query = `SELECT * FROM reportes_semanales WHERE fecha_inicio <= $1 AND fecha_fin >= $1`;
      params = [fecha];
    } else {
      query = `SELECT * FROM reportes_semanales ORDER BY fecha_fin DESC LIMIT 1`;
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      // Generate on-the-fly if no saved report
      const reporte = await generateWeeklyReport();
      return res.json({ reporte, generado: true });
    }

    res.json({ reporte: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/reportes/proyectos - Projects report
router.get('/proyectos', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { desde, hasta, estado } = req.query;

    let query = `
      SELECT
        p.id, p.codigo, p.titulo, p.estado, p.creado_en, p.actualizado_en,
        p.fecha_inicio_estimada, p.fecha_fin_estimada,
        u.nombre as responsable_nombre,
        s.tipo as tipo_solicitud,
        s.datos_solicitante->>'departamento' as departamento,
        (SELECT COUNT(*) FROM proyecto_tareas WHERE proyecto_id = p.id) as total_tareas,
        (SELECT COUNT(*) FROM proyecto_tareas WHERE proyecto_id = p.id AND completada = true) as tareas_completadas,
        (SELECT COUNT(*) FROM proyecto_miembros WHERE proyecto_id = p.id) as total_miembros
      FROM proyectos p
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      LEFT JOIN solicitudes s ON p.solicitud_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (desde) {
      query += ` AND p.creado_en >= $${paramIndex++}`;
      params.push(desde);
    }

    if (hasta) {
      query += ` AND p.creado_en <= $${paramIndex++}`;
      params.push(hasta);
    }

    if (estado) {
      const estados = estado.split(',');
      query += ` AND p.estado = ANY($${paramIndex++})`;
      params.push(estados);
    }

    query += ` ORDER BY p.creado_en DESC`;

    const result = await pool.query(query, params);

    // Summary stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'planificacion') as planificacion,
        COUNT(*) FILTER (WHERE estado = 'en_desarrollo') as en_desarrollo,
        COUNT(*) FILTER (WHERE estado = 'pausado') as pausados,
        COUNT(*) FILTER (WHERE estado = 'completado') as completados,
        COUNT(*) FILTER (WHERE estado = 'cancelado') as cancelados
      FROM proyectos
      WHERE 1=1
      ${desde ? `AND creado_en >= '${desde}'` : ''}
      ${hasta ? `AND creado_en <= '${hasta}'` : ''}
    `);

    res.json({
      proyectos: result.rows,
      stats: stats.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reportes/tickets - Tickets report
router.get('/tickets', authenticate, authorize('ti', 'nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { desde, hasta, categoria, estado } = req.query;

    let query = `
      SELECT
        t.id, t.codigo, t.titulo, t.categoria, t.estado, t.prioridad,
        t.creado_en, t.fecha_resolucion,
        t.datos_solicitante->>'nombre' as solicitante_nombre,
        t.datos_solicitante->>'departamento' as departamento,
        u.nombre as asignado_nombre,
        EXTRACT(EPOCH FROM (COALESCE(t.fecha_resolucion, NOW()) - t.creado_en))/3600 as horas_transcurridas
      FROM tickets t
      LEFT JOIN usuarios u ON t.asignado_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (desde) {
      query += ` AND t.creado_en >= $${paramIndex++}`;
      params.push(desde);
    }

    if (hasta) {
      query += ` AND t.creado_en <= $${paramIndex++}`;
      params.push(hasta);
    }

    if (categoria) {
      query += ` AND t.categoria = $${paramIndex++}`;
      params.push(categoria);
    }

    if (estado) {
      const estados = estado.split(',');
      query += ` AND t.estado = ANY($${paramIndex++})`;
      params.push(estados);
    }

    query += ` ORDER BY t.creado_en DESC`;

    const result = await pool.query(query, params);

    // Summary stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado IN ('abierto', 'en_proceso')) as activos,
        COUNT(*) FILTER (WHERE estado IN ('resuelto', 'cerrado')) as resueltos,
        COUNT(*) FILTER (WHERE estado = 'escalado_nt') as escalados,
        AVG(EXTRACT(EPOCH FROM (fecha_resolucion - creado_en))/3600)
          FILTER (WHERE fecha_resolucion IS NOT NULL) as tiempo_promedio_horas,
        COUNT(*) FILTER (WHERE prioridad = 'critica') as criticos,
        COUNT(*) FILTER (WHERE prioridad = 'alta') as alta_prioridad
      FROM tickets
      WHERE 1=1
      ${desde ? `AND creado_en >= '${desde}'` : ''}
      ${hasta ? `AND creado_en <= '${hasta}'` : ''}
    `);

    // By category
    const porCategoria = await pool.query(`
      SELECT categoria, COUNT(*) as cantidad
      FROM tickets
      WHERE 1=1
      ${desde ? `AND creado_en >= '${desde}'` : ''}
      ${hasta ? `AND creado_en <= '${hasta}'` : ''}
      GROUP BY categoria
    `);

    res.json({
      tickets: result.rows,
      stats: stats.rows[0],
      porCategoria: porCategoria.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/reportes/generar - Generate and save weekly report
router.post('/generar', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const reporte = await generateWeeklyReport(true);

    res.json({
      message: 'Reporte generado y guardado',
      reporte
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reportes/solicitudes - Solicitudes report
router.get('/solicitudes', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { desde, hasta, tipo, estado } = req.query;

    let query = `
      SELECT
        s.id, s.codigo, s.titulo, s.tipo, s.estado, s.prioridad,
        s.creado_en, s.actualizado_en,
        s.datos_solicitante->>'nombre' as solicitante_nombre,
        s.datos_solicitante->>'departamento' as departamento,
        u.nombre as evaluador_nombre
      FROM solicitudes s
      LEFT JOIN usuarios u ON s.evaluador_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (desde) {
      query += ` AND s.creado_en >= $${paramIndex++}`;
      params.push(desde);
    }

    if (hasta) {
      query += ` AND s.creado_en <= $${paramIndex++}`;
      params.push(hasta);
    }

    if (tipo) {
      query += ` AND s.tipo = $${paramIndex++}`;
      params.push(tipo);
    }

    if (estado) {
      const estados = estado.split(',');
      query += ` AND s.estado = ANY($${paramIndex++})`;
      params.push(estados);
    }

    query += ` ORDER BY s.creado_en DESC`;

    const result = await pool.query(query, params);

    // Stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'pendiente_evaluacion_nt') as pendientes_nt,
        COUNT(*) FILTER (WHERE estado = 'pendiente_aprobacion_gerencia') as pendientes_gerencia,
        COUNT(*) FILTER (WHERE estado IN ('aprobado', 'en_desarrollo')) as en_progreso,
        COUNT(*) FILTER (WHERE estado = 'completado') as completadas,
        COUNT(*) FILTER (WHERE estado IN ('descartado_nt', 'rechazado_gerencia', 'cancelado')) as rechazadas
      FROM solicitudes
      WHERE 1=1
      ${desde ? `AND creado_en >= '${desde}'` : ''}
      ${hasta ? `AND creado_en <= '${hasta}'` : ''}
    `);

    // By type
    const porTipo = await pool.query(`
      SELECT tipo, COUNT(*) as cantidad
      FROM solicitudes
      WHERE 1=1
      ${desde ? `AND creado_en >= '${desde}'` : ''}
      ${hasta ? `AND creado_en <= '${hasta}'` : ''}
      GROUP BY tipo
    `);

    res.json({
      solicitudes: result.rows,
      stats: stats.rows[0],
      porTipo: porTipo.rows
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to generate weekly report
async function generateWeeklyReport(save = false) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
  endOfWeek.setHours(23, 59, 59, 999);

  // Solicitudes stats
  const solicitudesStats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE creado_en BETWEEN $1 AND $2) as nuevas,
      COUNT(*) FILTER (WHERE estado = 'aprobado' AND actualizado_en BETWEEN $1 AND $2) as aprobadas,
      COUNT(*) FILTER (WHERE estado IN ('descartado_nt', 'rechazado_gerencia') AND actualizado_en BETWEEN $1 AND $2) as rechazadas,
      COUNT(*) FILTER (WHERE estado = 'completado' AND actualizado_en BETWEEN $1 AND $2) as completadas,
      COUNT(*) FILTER (WHERE estado = 'pendiente_evaluacion_nt') as pendientes_evaluacion,
      COUNT(*) FILTER (WHERE estado = 'pendiente_aprobacion_gerencia') as pendientes_aprobacion
    FROM solicitudes
  `, [startOfWeek, endOfWeek]);

  // Projects stats
  const proyectosStats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado IN ('planificacion', 'en_desarrollo')) as activos,
      COUNT(*) FILTER (WHERE estado = 'completado' AND actualizado_en BETWEEN $1 AND $2) as completados_semana,
      COUNT(*) FILTER (WHERE estado = 'pausado') as pausados
    FROM proyectos
  `, [startOfWeek, endOfWeek]);

  // Tickets stats
  const ticketsStats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE creado_en BETWEEN $1 AND $2) as nuevos,
      COUNT(*) FILTER (WHERE estado IN ('resuelto', 'cerrado') AND fecha_resolucion BETWEEN $1 AND $2) as resueltos,
      COUNT(*) FILTER (WHERE estado IN ('abierto', 'en_proceso')) as abiertos,
      COUNT(*) FILTER (WHERE estado = 'escalado_nt') as escalados,
      AVG(EXTRACT(EPOCH FROM (fecha_resolucion - creado_en))/3600)
        FILTER (WHERE fecha_resolucion BETWEEN $1 AND $2) as tiempo_promedio_horas
    FROM tickets
  `, [startOfWeek, endOfWeek]);

  const datos = {
    solicitudes: solicitudesStats.rows[0],
    proyectos: proyectosStats.rows[0],
    tickets: ticketsStats.rows[0],
    generado_en: new Date().toISOString()
  };

  if (save) {
    await pool.query(`
      INSERT INTO reportes_semanales (fecha_inicio, fecha_fin, datos)
      VALUES ($1, $2, $3)
      ON CONFLICT (fecha_inicio) DO UPDATE SET datos = $3
      RETURNING *
    `, [startOfWeek, endOfWeek, JSON.stringify(datos)]);

    logger.info(`Weekly report generated for ${startOfWeek.toISOString()} - ${endOfWeek.toISOString()}`);
  }

  return {
    fecha_inicio: startOfWeek,
    fecha_fin: endOfWeek,
    datos
  };
}

module.exports = router;
