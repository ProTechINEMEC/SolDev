const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { addWorkdays, getWorkdaysBetween, isWorkday, getColombianHolidays, getHolidayList } = require('../utils/workdays');

const router = express.Router();

// GET /api/calendario/festivos - Get Colombian holidays for a year range
router.get('/festivos', authenticate, async (req, res, next) => {
  try {
    const { year_start, year_end } = req.query;
    const startYear = parseInt(year_start) || new Date().getFullYear();
    const endYear = parseInt(year_end) || startYear + 1;

    const holidays = [];
    for (let year = startYear; year <= endYear; year++) {
      const yearHolidays = getHolidayList(year);
      yearHolidays.forEach(h => {
        holidays.push({
          fecha: h.fecha.toISOString().split('T')[0],
          nombre: h.nombre,
          year
        });
      });
    }

    res.json({ festivos: holidays });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendario/proyectos - Get scheduled projects for calendar
router.get('/proyectos', authenticate, authorize('gerencia', 'nuevas_tecnologias', 'coordinador_nt'), async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let query = `
      SELECT
        s.id,
        s.codigo,
        s.titulo,
        s.tipo,
        s.prioridad,
        COALESCE(p.estado::text, s.estado::text) as estado,
        COALESCE(s.fecha_inicio_programada, p.fecha_inicio_estimada) as fecha_inicio_programada,
        COALESCE(s.fecha_fin_programada, p.fecha_fin_estimada) as fecha_fin_programada,
        e.recomendacion,
        est.total as costo_estimado
      FROM solicitudes s
      LEFT JOIN proyectos p ON p.solicitud_id = s.id
      LEFT JOIN evaluaciones_nt e ON e.solicitud_id = s.id AND e.estado = 'enviado'
      LEFT JOIN estimaciones_costo est ON est.evaluacion_id = e.id
      WHERE (
        s.estado IN ('agendado', 'aprobado', 'en_desarrollo', 'pausado')
        OR p.estado IN ('en_desarrollo', 'pausado', 'planificacion')
      )
      AND COALESCE(s.fecha_inicio_programada, p.fecha_inicio_estimada) IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (fecha_inicio) {
      query += ` AND COALESCE(s.fecha_fin_programada, p.fecha_fin_estimada) >= $${paramIndex++}::date`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += ` AND COALESCE(s.fecha_inicio_programada, p.fecha_inicio_estimada) <= $${paramIndex++}::date`;
      params.push(fecha_fin);
    }

    // NT users: only see projects where they are team members or have assigned tasks
    if (req.user.rol === 'nuevas_tecnologias') {
      query += ` AND (
        p.responsable_id = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM proyecto_miembros pm
          WHERE pm.proyecto_id = p.id AND pm.usuario_id = $${paramIndex}
        )
        OR EXISTS (
          SELECT 1 FROM proyecto_tareas pt
          WHERE pt.proyecto_id = p.id AND pt.asignado_id = $${paramIndex}
        )
      )`;
      params.push(req.user.id);
      paramIndex++;
    }

    query += ` ORDER BY COALESCE(s.fecha_inicio_programada, p.fecha_inicio_estimada)`;

    const result = await pool.query(query, params);

    // Transform to calendar events format
    const eventos = result.rows.map(row => ({
      id: row.id,
      title: `${row.codigo}: ${row.titulo}`,
      start: row.fecha_inicio_programada,
      end: row.fecha_fin_programada,
      extendedProps: {
        codigo: row.codigo,
        titulo: row.titulo,
        tipo: row.tipo,
        prioridad: row.prioridad,
        estado: row.estado,
        recomendacion: row.recomendacion,
        costo_estimado: row.costo_estimado
      },
      backgroundColor: getPriorityColor(row.prioridad),
      borderColor: getStatusBorderColor(row.estado)
    }));

    res.json({ eventos });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendario/conflictos - Check for scheduling conflicts
router.get('/conflictos', authenticate, authorize('gerencia'), async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, excluir_id } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      throw new AppError('Se requieren fecha_inicio y fecha_fin', 400);
    }

    let query = `
      SELECT
        s.id,
        s.codigo,
        s.titulo,
        s.prioridad,
        s.fecha_inicio_programada,
        s.fecha_fin_programada
      FROM solicitudes s
      WHERE s.estado IN ('agendado', 'aprobado', 'en_desarrollo')
        AND s.fecha_inicio_programada IS NOT NULL
        AND s.fecha_inicio_programada <= $1::date
        AND s.fecha_fin_programada >= $2::date
    `;
    const params = [fecha_fin, fecha_inicio];

    if (excluir_id) {
      query += ` AND s.id != $3`;
      params.push(excluir_id);
    }

    const result = await pool.query(query, params);

    // Count projects per day in range
    const conflictos = [];
    if (result.rows.length >= 2) {
      conflictos.push({
        tipo: 'multiple_proyectos',
        mensaje: `Hay ${result.rows.length} proyectos programados que se superponen con este rango de fechas`,
        proyectos: result.rows.map(r => ({ id: r.id, codigo: r.codigo, titulo: r.titulo }))
      });
    }

    res.json({
      tiene_conflictos: conflictos.length > 0,
      conflictos,
      proyectos_superpuestos: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendario/estadisticas - Calendar statistics
router.get('/estadisticas', authenticate, authorize('gerencia', 'nuevas_tecnologias', 'coordinador_nt'), async (req, res, next) => {
  try {
    const { mes, anio } = req.query;
    const year = anio || new Date().getFullYear();
    const month = mes || new Date().getMonth() + 1;

    // Projects scheduled this month
    const proyectosResult = await pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN estado = 'agendado' THEN 1 ELSE 0 END) as agendados,
              SUM(CASE WHEN estado = 'en_desarrollo' THEN 1 ELSE 0 END) as en_desarrollo,
              SUM(CASE WHEN estado = 'completado' THEN 1 ELSE 0 END) as completados
       FROM solicitudes
       WHERE EXTRACT(MONTH FROM fecha_inicio_programada) = $1
         AND EXTRACT(YEAR FROM fecha_inicio_programada) = $2
         AND estado IN ('agendado', 'aprobado', 'en_desarrollo', 'completado')`,
      [month, year]
    );

    // Pending approvals
    const pendientesResult = await pool.query(
      `SELECT COUNT(*) as total FROM solicitudes WHERE estado = 'pendiente_aprobacion_gerencia'`
    );

    // Total estimated cost for scheduled projects
    const costoResult = await pool.query(
      `SELECT COALESCE(SUM(est.total), 0) as costo_total
       FROM solicitudes s
       JOIN evaluaciones_nt e ON e.solicitud_id = s.id
       JOIN estimaciones_costo est ON est.evaluacion_id = e.id
       WHERE EXTRACT(MONTH FROM s.fecha_inicio_programada) = $1
         AND EXTRACT(YEAR FROM s.fecha_inicio_programada) = $2
         AND s.estado IN ('agendado', 'aprobado', 'en_desarrollo')`,
      [month, year]
    );

    res.json({
      mes: month,
      anio: year,
      proyectos: proyectosResult.rows[0],
      pendientes_aprobacion: parseInt(pendientesResult.rows[0].total, 10),
      costo_total_mes: parseFloat(costoResult.rows[0].costo_total)
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendario/proyectos-con-tareas - Get projects with their tasks for timeline view
router.get('/proyectos-con-tareas', authenticate, authorize('gerencia', 'nuevas_tecnologias', 'coordinador_nt'), async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    // Get scheduled and active projects
    // Join proyectos to catch en_desarrollo/pausado projects even when solicitudes dates are NULL
    let projectQuery = `
      SELECT
        s.id,
        s.codigo,
        s.titulo,
        s.tipo,
        s.prioridad,
        COALESCE(p.estado::text, s.estado::text) as estado,
        COALESCE(s.fecha_inicio_programada, p.fecha_inicio_estimada) as fecha_inicio_programada,
        COALESCE(s.fecha_fin_programada, p.fecha_fin_estimada) as fecha_fin_programada,
        COALESCE(s.fecha_inicio_desarrollo, p.fecha_inicio_desarrollo) as fecha_inicio_desarrollo,
        e.id as evaluacion_id,
        (SELECT COALESCE(SUM(
          COALESCE(pp.dias_pausados, EXTRACT(DAY FROM COALESCE(pp.fecha_fin, NOW()) - pp.fecha_inicio))
        ), 0) FROM proyecto_pausas pp
        WHERE pp.solicitud_id = s.id) as dias_pausados_total
      FROM solicitudes s
      LEFT JOIN proyectos p ON p.solicitud_id = s.id
      LEFT JOIN evaluaciones_nt e ON e.solicitud_id = s.id AND e.estado = 'enviado'
      WHERE (
        s.estado IN ('agendado', 'aprobado', 'en_desarrollo', 'pausado')
        OR p.estado IN ('en_desarrollo', 'pausado', 'planificacion')
      )
      AND COALESCE(s.fecha_inicio_programada, p.fecha_inicio_estimada) IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (fecha_inicio) {
      projectQuery += ` AND COALESCE(s.fecha_fin_programada, p.fecha_fin_estimada) >= $${paramIndex++}::date`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      projectQuery += ` AND COALESCE(s.fecha_inicio_programada, p.fecha_inicio_estimada) <= $${paramIndex++}::date`;
      params.push(fecha_fin);
    }

    // NT users: only see projects where they are team members or have assigned tasks
    if (req.user.rol === 'nuevas_tecnologias') {
      projectQuery += ` AND (
        p.responsable_id = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM proyecto_miembros pm
          WHERE pm.proyecto_id = p.id AND pm.usuario_id = $${paramIndex}
        )
        OR EXISTS (
          SELECT 1 FROM proyecto_tareas pt
          WHERE pt.proyecto_id = p.id AND pt.asignado_id = $${paramIndex}
        )
      )`;
      params.push(req.user.id);
      paramIndex++;
    }

    projectQuery += ` ORDER BY COALESCE(s.fecha_inicio_programada, p.fecha_inicio_estimada)`;

    const projectResult = await pool.query(projectQuery, params);

    // For each project, get its tasks
    const proyectos = [];
    for (const project of projectResult.rows) {
      let tareas = [];

      // Try proyecto_tareas first (has real progress + emergent tasks)
      const proyectoRow = await pool.query(
        'SELECT id FROM proyectos WHERE solicitud_id = $1',
        [project.id]
      );

      if (proyectoRow.rows.length > 0) {
        const ptResult = await pool.query(
          `SELECT pt.id, pt.titulo as nombre, pt.fase, pt.fecha_inicio, pt.fecha_fin,
                  pt.duracion_dias, pt.asignado_id, pt.progreso, pt.es_emergente,
                  u.nombre as asignado_nombre
           FROM proyecto_tareas pt
           LEFT JOIN usuarios u ON pt.asignado_id = u.id
           WHERE pt.proyecto_id = $1
           ORDER BY pt.fase NULLS LAST, pt.orden, pt.fecha_inicio`,
          [proyectoRow.rows[0].id]
        );
        tareas = ptResult.rows;
      }

      // Fallback to cronograma_tareas (for agendado projects without proyecto)
      if (tareas.length === 0 && project.evaluacion_id) {
        const cronograma = await pool.query(
          'SELECT id FROM cronogramas WHERE evaluacion_id = $1',
          [project.evaluacion_id]
        );

        if (cronograma.rows.length > 0) {
          const tareasResult = await pool.query(
            `SELECT ct.*, u.nombre as asignado_nombre
             FROM cronograma_tareas ct
             LEFT JOIN usuarios u ON ct.asignado_id = u.id
             WHERE ct.cronograma_id = $1
             ORDER BY ct.orden`,
            [cronograma.rows[0].id]
          );
          tareas = tareasResult.rows;
        }
      }

      // Normalize task shape
      const allTareas = tareas.map(t => ({
        id: t.id,
        nombre: t.nombre || t.titulo,
        fase: t.fase,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: t.fecha_fin,
        duracion_dias: t.duracion_dias || t.duracion,
        asignado_id: t.asignado_id,
        asignado_nombre: t.asignado_nombre,
        progreso: t.progreso,
        es_emergente: t.es_emergente || false
      }));

      // For NT users: only show their assigned tasks
      // For gerencia/coordinador: show all tasks
      const filteredTareas = req.user.rol === 'nuevas_tecnologias'
        ? allTareas.filter(t => t.asignado_id === req.user.id)
        : allTareas;

      proyectos.push({
        ...project,
        tareas: filteredTareas
      });
    }

    res.json({ proyectos });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendario/equipo-carga - Get team member workloads
router.get('/equipo-carga', authenticate, authorize('gerencia', 'nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, solicitud_id } = req.query;

    // Get NT users
    const usersResult = await pool.query(
      `SELECT id, nombre, email FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true ORDER BY nombre`
    );

    // Get tasks assigned to each user within the date range
    let taskQuery = `
      SELECT
        ct.asignado_id,
        ct.id as tarea_id,
        ct.nombre as tarea_nombre,
        ct.titulo as tarea_titulo,
        ct.fase,
        ct.fecha_inicio,
        ct.fecha_fin,
        s.id as solicitud_id,
        s.codigo as proyecto_codigo,
        s.titulo as proyecto_titulo
      FROM cronograma_tareas ct
      JOIN cronogramas c ON ct.cronograma_id = c.id
      JOIN evaluaciones_nt e ON c.evaluacion_id = e.id
      JOIN solicitudes s ON e.solicitud_id = s.id
      WHERE ct.asignado_id IS NOT NULL
        AND s.estado IN ('agendado', 'aprobado', 'en_desarrollo')
        AND s.fecha_inicio_programada IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (fecha_inicio) {
      taskQuery += ` AND ct.fecha_fin >= $${paramIndex++}::date`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      taskQuery += ` AND ct.fecha_inicio <= $${paramIndex++}::date`;
      params.push(fecha_fin);
    }

    // Optionally exclude a specific solicitud (for preview purposes)
    if (solicitud_id) {
      taskQuery += ` AND s.id != $${paramIndex++}`;
      params.push(solicitud_id);
    }

    taskQuery += ` ORDER BY ct.fecha_inicio`;

    const tasksResult = await pool.query(taskQuery, params);

    // Group tasks by user
    const equipoCarga = usersResult.rows.map(user => {
      const userTasks = tasksResult.rows.filter(t => t.asignado_id === user.id);
      return {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        tareas: userTasks.map(t => ({
          id: t.tarea_id,
          nombre: t.tarea_nombre || t.tarea_titulo,
          fase: t.fase,
          fecha_inicio: t.fecha_inicio,
          fecha_fin: t.fecha_fin,
          proyecto_codigo: t.proyecto_codigo,
          proyecto_titulo: t.proyecto_titulo,
          solicitud_id: t.solicitud_id
        }))
      };
    });

    res.json({ equipo: equipoCarga });
  } catch (error) {
    next(error);
  }
});

// POST /api/calendario/calcular-fechas - Calculate dates using Colombian workdays
router.post('/calcular-fechas', authenticate, authorize('gerencia', 'nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { fecha_inicio, duracion_dias, evaluacion_id } = req.body;

    if (!fecha_inicio) {
      throw new AppError('Se requiere fecha_inicio', 400);
    }

    let totalDays = duracion_dias;

    // If evaluacion_id is provided, calculate total duration from cronograma
    if (evaluacion_id) {
      const cronograma = await pool.query(
        `SELECT c.id, MIN(ct.fecha_inicio) as min_fecha, MAX(ct.fecha_fin) as max_fecha
         FROM cronogramas c
         JOIN cronograma_tareas ct ON ct.cronograma_id = c.id
         WHERE c.evaluacion_id = $1
         GROUP BY c.id`,
        [evaluacion_id]
      );

      if (cronograma.rows.length > 0) {
        const { min_fecha, max_fecha } = cronograma.rows[0];
        totalDays = getWorkdaysBetween(new Date(min_fecha), new Date(max_fecha));
      }
    }

    if (!totalDays || totalDays < 1) {
      throw new AppError('No se pudo determinar la duración del proyecto', 400);
    }

    const startDate = new Date(fecha_inicio);
    const endDate = addWorkdays(startDate, totalDays - 1);

    res.json({
      fecha_inicio: startDate.toISOString().split('T')[0],
      fecha_fin: endDate.toISOString().split('T')[0],
      duracion_dias_habiles: totalDays,
      duracion_dias_calendario: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/calendario/preview - Preview how a project would look when scheduled
router.post('/preview', authenticate, authorize('gerencia'), async (req, res, next) => {
  try {
    const { solicitud_id, fecha_inicio } = req.body;

    if (!solicitud_id || !fecha_inicio) {
      throw new AppError('Se requieren solicitud_id y fecha_inicio', 400);
    }

    // Get the evaluation and its cronograma
    const evalResult = await pool.query(
      `SELECT e.id as evaluacion_id, s.codigo, s.titulo
       FROM evaluaciones_nt e
       JOIN solicitudes s ON e.solicitud_id = s.id
       WHERE s.id = $1 AND e.estado = 'enviado'`,
      [solicitud_id]
    );

    if (evalResult.rows.length === 0) {
      throw new AppError('No se encontró evaluación para esta solicitud', 404);
    }

    const { evaluacion_id, codigo, titulo } = evalResult.rows[0];

    // Get cronograma and tasks
    const cronograma = await pool.query(
      'SELECT id FROM cronogramas WHERE evaluacion_id = $1',
      [evaluacion_id]
    );

    if (cronograma.rows.length === 0) {
      throw new AppError('No hay cronograma para esta evaluación', 404);
    }

    const tareasResult = await pool.query(
      `SELECT ct.*, u.nombre as asignado_nombre, u.id as asignado_id
       FROM cronograma_tareas ct
       LEFT JOIN usuarios u ON ct.asignado_id = u.id
       WHERE ct.cronograma_id = $1
       ORDER BY ct.orden`,
      [cronograma.rows[0].id]
    );

    if (tareasResult.rows.length === 0) {
      throw new AppError('El cronograma no tiene tareas', 400);
    }

    // Tasks are sequential and stored with duration only (no dates)
    // Calculate dates based on duration and task order
    const tareas = tareasResult.rows;

    // Ensure we start on a workday (skip weekends and holidays)
    let newStart = new Date(fecha_inicio);
    const startYear = newStart.getFullYear();
    const allHolidays = [
      ...getColombianHolidays(startYear),
      ...getColombianHolidays(startYear + 1)
    ];

    // Move to next workday if start date is not a workday
    while (!isWorkday(newStart, allHolidays)) {
      newStart.setDate(newStart.getDate() + 1);
    }

    // Calculate sequential task dates based on task order and duration
    // Tasks run in sequence - each starts after the previous one finishes
    let currentDay = 0;
    const proyectedTasks = tareas.map(tarea => {
      const taskDuration = tarea.duracion_dias || tarea.duracion || 1;
      const taskStartDay = currentDay;
      const taskEndDay = currentDay + taskDuration - 1;

      // Calculate actual dates using workdays
      // For first task (taskStartDay=0), use newStart directly
      // For subsequent tasks, add workdays from newStart
      const newTaskStart = taskStartDay === 0 ? new Date(newStart) : addWorkdays(newStart, taskStartDay);
      const newTaskEnd = addWorkdays(newStart, taskEndDay);

      // Move to next task position (sequential)
      currentDay = taskEndDay + 1;

      return {
        id: tarea.id,
        nombre: tarea.nombre || tarea.titulo,
        fase: tarea.fase,
        fecha_inicio: newTaskStart.toISOString().split('T')[0],
        fecha_fin: newTaskEnd.toISOString().split('T')[0],
        duracion_dias: taskDuration,
        asignado_id: tarea.asignado_id,
        asignado_nombre: tarea.asignado_nombre,
        asignados_ids: tarea.asignados_ids || (tarea.asignado_id ? [tarea.asignado_id] : [])
      };
    });

    // Calculate total project duration
    const totalDuration = tareas.reduce((sum, t) => sum + (t.duracion_dias || t.duracion || 1), 0);

    // Calculate new project end date
    const newEnd = new Date(Math.max(...proyectedTasks.map(t => new Date(t.fecha_fin))));

    // Check for triple bookings
    const equipoCarga = await pool.query(
      `SELECT
        ct.asignado_id,
        u.nombre as asignado_nombre,
        ct.fecha_inicio,
        ct.fecha_fin,
        s.codigo as proyecto_codigo
       FROM cronograma_tareas ct
       JOIN cronogramas c ON ct.cronograma_id = c.id
       JOIN evaluaciones_nt e ON c.evaluacion_id = e.id
       JOIN solicitudes s ON e.solicitud_id = s.id
       LEFT JOIN usuarios u ON ct.asignado_id = u.id
       WHERE ct.asignado_id IS NOT NULL
         AND s.estado IN ('agendado', 'aprobado', 'en_desarrollo')
         AND s.id != $1
         AND ct.fecha_inicio <= $2::date
         AND ct.fecha_fin >= $3::date`,
      [solicitud_id, newEnd.toISOString().split('T')[0], newStart.toISOString().split('T')[0]]
    );

    // Find triple bookings
    const warnings = [];
    const assignedUsers = [...new Set(proyectedTasks.filter(t => t.asignado_id).map(t => t.asignado_id))];

    for (const userId of assignedUsers) {
      const userTasks = proyectedTasks.filter(t => t.asignado_id === userId);
      const existingTasks = equipoCarga.rows.filter(t => t.asignado_id === userId);
      const userName = userTasks[0]?.asignado_nombre || existingTasks[0]?.asignado_nombre || 'Usuario';

      // Check each day in the new project range for triple bookings
      const startCheck = newStart;
      const endCheck = newEnd;
      const current = new Date(startCheck);

      while (current <= endCheck) {
        if (isWorkday(current)) {
          const dateStr = current.toISOString().split('T')[0];

          // Count tasks on this day
          let tasksOnDay = 0;

          // Count from new project
          for (const task of userTasks) {
            if (new Date(task.fecha_inicio) <= current && new Date(task.fecha_fin) >= current) {
              tasksOnDay++;
            }
          }

          // Count from existing projects
          for (const task of existingTasks) {
            if (new Date(task.fecha_inicio) <= current && new Date(task.fecha_fin) >= current) {
              tasksOnDay++;
            }
          }

          if (tasksOnDay >= 3) {
            warnings.push({
              tipo: 'triple_booking',
              usuario_id: userId,
              usuario_nombre: userName,
              fecha: dateStr,
              mensaje: `${userName} tiene ${tasksOnDay} tareas asignadas el ${dateStr}`
            });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }

    // Deduplicate warnings by user+date
    const uniqueWarnings = [];
    const warningKeys = new Set();
    for (const w of warnings) {
      const key = `${w.usuario_id}-${w.fecha}`;
      if (!warningKeys.has(key)) {
        warningKeys.add(key);
        uniqueWarnings.push(w);
      }
    }

    res.json({
      proyecto: {
        solicitud_id,
        codigo,
        titulo,
        fecha_inicio: newStart.toISOString().split('T')[0],
        fecha_fin: newEnd.toISOString().split('T')[0],
        duracion_dias_habiles: totalDuration
      },
      tareas: proyectedTasks,
      warnings: uniqueWarnings.slice(0, 10) // Limit to 10 warnings
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/calendario/preview-reprogramacion - Preview how a project would look when rescheduled
router.post('/preview-reprogramacion', authenticate, authorize('nuevas_tecnologias', 'coordinador_nt', 'gerencia'), async (req, res, next) => {
  try {
    const { proyecto_id, fecha_inicio } = req.body;

    if (!proyecto_id || !fecha_inicio) {
      throw new AppError('Se requieren proyecto_id y fecha_inicio', 400);
    }

    // Get project info
    const proyectoResult = await pool.query(
      `SELECT p.id, p.codigo, p.titulo, p.solicitud_id
       FROM proyectos p
       WHERE p.id = $1`,
      [proyecto_id]
    );

    if (proyectoResult.rows.length === 0) {
      throw new AppError('Proyecto no encontrado', 404);
    }

    const { id: projId, codigo, titulo, solicitud_id } = proyectoResult.rows[0];

    // Try proyecto_tareas first, fall back to cronograma_tareas
    let tareasResult = await pool.query(
      `SELECT pt.id, pt.titulo, pt.fase, pt.orden, pt.duracion_dias, pt.asignado_id,
              u.nombre as asignado_nombre
       FROM proyecto_tareas pt
       LEFT JOIN usuarios u ON pt.asignado_id = u.id
       WHERE pt.proyecto_id = $1
       ORDER BY pt.fase NULLS LAST, pt.orden, pt.id`,
      [projId]
    );

    if (tareasResult.rows.length === 0) {
      // Fall back to cronograma_tareas via evaluacion
      const proyFull = await pool.query(
        `SELECT p.evaluacion_id FROM proyectos p WHERE p.id = $1`, [projId]
      );
      const evalId = proyFull.rows[0]?.evaluacion_id;
      if (evalId) {
        const cronRes = await pool.query(
          `SELECT c.id FROM cronogramas c WHERE c.evaluacion_id = $1 LIMIT 1`, [evalId]
        );
        if (cronRes.rows.length > 0) {
          tareasResult = await pool.query(
            `SELECT ct.id, ct.titulo, ct.nombre as titulo_alt, ct.fase, ct.orden,
                    COALESCE(ct.duracion_dias, ct.duracion, 1) as duracion_dias,
                    ct.asignado_id, u.nombre as asignado_nombre
             FROM cronograma_tareas ct
             LEFT JOIN usuarios u ON ct.asignado_id = u.id
             WHERE ct.cronograma_id = $1
             ORDER BY ct.fase NULLS LAST, ct.orden, ct.id`,
            [cronRes.rows[0].id]
          );
        }
      }
      // Also try via solicitud_id if no evaluacion
      if (tareasResult.rows.length === 0 && solicitud_id) {
        const cronRes = await pool.query(
          `SELECT c.id FROM cronogramas c WHERE c.solicitud_id = $1 LIMIT 1`, [solicitud_id]
        );
        if (cronRes.rows.length > 0) {
          tareasResult = await pool.query(
            `SELECT ct.id, ct.titulo, ct.nombre as titulo_alt, ct.fase, ct.orden,
                    COALESCE(ct.duracion_dias, ct.duracion, 1) as duracion_dias,
                    ct.asignado_id, u.nombre as asignado_nombre
             FROM cronograma_tareas ct
             LEFT JOIN usuarios u ON ct.asignado_id = u.id
             WHERE ct.cronograma_id = $1
             ORDER BY ct.fase NULLS LAST, ct.orden, ct.id`,
            [cronRes.rows[0].id]
          );
        }
      }
    }

    if (tareasResult.rows.length === 0) {
      throw new AppError('El proyecto no tiene tareas ni cronograma', 400);
    }

    const tareas = tareasResult.rows;

    // Ensure we start on a workday
    let newStart = new Date(fecha_inicio);
    const startYear = newStart.getFullYear();
    const allHolidays = [
      ...getColombianHolidays(startYear),
      ...getColombianHolidays(startYear + 1)
    ];

    while (!isWorkday(newStart, allHolidays)) {
      newStart.setDate(newStart.getDate() + 1);
    }

    // Calculate sequential task dates based on duration
    let currentDay = 0;
    const proyectedTasks = tareas.map(tarea => {
      const taskDuration = tarea.duracion_dias || 1;
      const taskStartDay = currentDay;
      const taskEndDay = currentDay + taskDuration - 1;

      const newTaskStart = taskStartDay === 0 ? new Date(newStart) : addWorkdays(newStart, taskStartDay);
      const newTaskEnd = addWorkdays(newStart, taskEndDay);

      currentDay = taskEndDay + 1;

      return {
        id: tarea.id,
        nombre: tarea.titulo || tarea.titulo_alt || tarea.nombre,
        fase: tarea.fase,
        fecha_inicio: newTaskStart.toISOString().split('T')[0],
        fecha_fin: newTaskEnd.toISOString().split('T')[0],
        duracion_dias: taskDuration,
        asignado_id: tarea.asignado_id,
        asignado_nombre: tarea.asignado_nombre,
        asignados_ids: tarea.asignado_id ? [tarea.asignado_id] : []
      };
    });

    const totalDuration = tareas.reduce((sum, t) => sum + (t.duracion_dias || 1), 0);
    const newEnd = new Date(Math.max(...proyectedTasks.map(t => new Date(t.fecha_fin))));

    // Check for triple bookings
    const equipoCarga = await pool.query(
      `SELECT
        pt.asignado_id,
        u.nombre as asignado_nombre,
        pt.fecha_inicio,
        pt.fecha_fin,
        p.codigo as proyecto_codigo
       FROM proyecto_tareas pt
       JOIN proyectos p ON pt.proyecto_id = p.id
       LEFT JOIN usuarios u ON pt.asignado_id = u.id
       WHERE pt.asignado_id IS NOT NULL
         AND p.estado IN ('en_desarrollo', 'pausado', 'planificacion')
         AND p.id != $1
         AND pt.fecha_inicio <= $2::date
         AND pt.fecha_fin >= $3::date`,
      [projId, newEnd.toISOString().split('T')[0], newStart.toISOString().split('T')[0]]
    );

    const warnings = [];
    const assignedUsers = [...new Set(proyectedTasks.filter(t => t.asignado_id).map(t => t.asignado_id))];

    for (const userId of assignedUsers) {
      const userTasks = proyectedTasks.filter(t => t.asignado_id === userId);
      const existingTasks = equipoCarga.rows.filter(t => t.asignado_id === userId);
      const userName = userTasks[0]?.asignado_nombre || existingTasks[0]?.asignado_nombre || 'Usuario';

      const current = new Date(newStart);
      while (current <= newEnd) {
        if (isWorkday(current)) {
          const dateStr = current.toISOString().split('T')[0];
          let tasksOnDay = 0;
          for (const task of userTasks) {
            if (new Date(task.fecha_inicio) <= current && new Date(task.fecha_fin) >= current) tasksOnDay++;
          }
          for (const task of existingTasks) {
            if (new Date(task.fecha_inicio) <= current && new Date(task.fecha_fin) >= current) tasksOnDay++;
          }
          if (tasksOnDay >= 3) {
            warnings.push({ tipo: 'triple_booking', usuario_id: userId, usuario_nombre: userName, fecha: dateStr, mensaje: `${userName} tiene ${tasksOnDay} tareas asignadas el ${dateStr}` });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }

    const uniqueWarnings = [];
    const warningKeys = new Set();
    for (const w of warnings) {
      const key = `${w.usuario_id}-${w.fecha}`;
      if (!warningKeys.has(key)) { warningKeys.add(key); uniqueWarnings.push(w); }
    }

    res.json({
      proyecto: {
        proyecto_id: projId,
        codigo,
        titulo,
        fecha_inicio: newStart.toISOString().split('T')[0],
        fecha_fin: newEnd.toISOString().split('T')[0],
        duracion_dias_habiles: totalDuration
      },
      tareas: proyectedTasks,
      warnings: uniqueWarnings.slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function getPriorityColor(prioridad) {
  const colors = {
    critica: '#ff4d4f',
    alta: '#fa8c16',
    media: '#1890ff',
    baja: '#52c41a'
  };
  return colors[prioridad] || '#1890ff';
}

function getStatusBorderColor(estado) {
  const colors = {
    agendado: '#722ed1',
    aprobado: '#52c41a',
    en_desarrollo: '#1890ff',
    pausado: '#faad14'
  };
  return colors[estado] || '#d9d9d9';
}

module.exports = router;
