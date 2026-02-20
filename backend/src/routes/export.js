/**
 * Export Routes
 * PDF and Excel export functionality
 */

const express = require('express');
const ExcelJS = require('exceljs');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const pdfService = require('../services/pdfService');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/export/solicitud/:codigo/pdf
 * Export a solicitud as PDF
 */
router.get('/solicitud/:codigo/pdf', authenticate, async (req, res, next) => {
  try {
    const { codigo } = req.params;

    // Verify access (NT and Gerencia can export)
    if (!['nuevas_tecnologias', 'gerencia'].includes(req.user.rol)) {
      throw new AppError('No autorizado para exportar solicitudes', 403);
    }

    // Get solicitud ID by codigo
    const solicitudResult = await pool.query('SELECT id FROM solicitudes WHERE codigo = $1', [codigo]);
    if (solicitudResult.rows.length === 0) {
      throw new AppError('Solicitud no encontrada', 404);
    }
    const id = solicitudResult.rows[0].id;

    const pdfBuffer = await pdfService.generateSolicitudPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=solicitud-${codigo}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    logger.info(`PDF exported for solicitud ${id} by user ${req.user.id}`);
  } catch (error) {
    if (error.message === 'Solicitud no encontrada') {
      return next(new AppError('Solicitud no encontrada', 404));
    }
    next(error);
  }
});

/**
 * GET /api/export/ticket/:codigo/pdf
 * Export a ticket as PDF
 */
router.get('/ticket/:codigo/pdf', authenticate, authorize('ti', 'nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { codigo } = req.params;

    // Get ticket ID by codigo
    const ticketResult = await pool.query('SELECT id FROM tickets WHERE codigo = $1', [codigo]);
    if (ticketResult.rows.length === 0) {
      throw new AppError('Ticket no encontrado', 404);
    }
    const id = ticketResult.rows[0].id;

    const pdfBuffer = await pdfService.generateTicketPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ticket-${codigo}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    logger.info(`PDF exported for ticket ${id} by user ${req.user.id}`);
  } catch (error) {
    if (error.message === 'Ticket no encontrado') {
      return next(new AppError('Ticket no encontrado', 404));
    }
    next(error);
  }
});

/**
 * GET /api/export/evaluacion/:id/pdf
 * Export an evaluation as PDF (includes cronograma and cost estimation)
 */
router.get('/evaluacion/:id/pdf', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const pdfBuffer = await pdfService.generateEvaluacionPDF(id);

    // Get solicitud code for filename
    const result = await pool.query(
      `SELECT s.codigo FROM evaluaciones_nt e
       JOIN solicitudes s ON e.solicitud_id = s.id
       WHERE e.id = $1`,
      [id]
    );
    const codigo = result.rows[0]?.codigo || id;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=evaluacion-${codigo}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    logger.info(`PDF exported for evaluacion ${id} by user ${req.user.id}`);
  } catch (error) {
    if (error.message === 'Evaluación no encontrada') {
      return next(new AppError('Evaluación no encontrada', 404));
    }
    next(error);
  }
});

/**
 * GET /api/export/proyecto/:id/pdf
 * Export a project as PDF
 */
router.get('/proyecto/:id/pdf', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const pdfBuffer = await pdfService.generateProjectPDF(id);

    // Get project code for filename
    const result = await pool.query('SELECT codigo FROM proyectos WHERE id = $1', [id]);
    const codigo = result.rows[0]?.codigo || id;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=proyecto-${codigo}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    logger.info(`PDF exported for proyecto ${id} by user ${req.user.id}`);
  } catch (error) {
    if (error.message === 'Proyecto no encontrado') {
      return next(new AppError('Proyecto no encontrado', 404));
    }
    next(error);
  }
});

/**
 * GET /api/export/reporte-semanal/pdf
 * Export weekly report as PDF
 */
router.get('/reporte-semanal/pdf', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { fecha } = req.query;

    let query = 'SELECT * FROM reportes_semanales ORDER BY fecha_fin DESC LIMIT 1';
    let params = [];

    if (fecha) {
      query = 'SELECT * FROM reportes_semanales WHERE fecha_inicio <= $1 AND fecha_fin >= $1';
      params = [fecha];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      throw new AppError('Reporte no encontrado', 404);
    }

    const pdfBuffer = await pdfService.generateWeeklyReportPDF(result.rows[0]);

    const fechaStr = new Date(result.rows[0].fecha_fin).toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte-semanal-${fechaStr}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

    logger.info(`Weekly report PDF exported by user ${req.user.id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/export/audit-log
 * Export audit log as Excel
 */
router.get('/audit-log', authenticate, authorize('nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { desde, hasta, entidad_tipo, limit = 10000 } = req.query;

    let query = `
      SELECT h.id, h.entidad_tipo, h.entidad_id, h.accion,
             h.datos_anteriores, h.datos_nuevos,
             h.ip_address, h.creado_en,
             u.nombre as usuario_nombre,
             u.email as usuario_email
      FROM historial_cambios h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (desde) {
      query += ` AND h.creado_en >= $${paramIndex++}`;
      params.push(desde);
    }
    if (hasta) {
      query += ` AND h.creado_en <= $${paramIndex++}`;
      params.push(hasta);
    }
    if (entidad_tipo) {
      query += ` AND h.entidad_tipo = $${paramIndex++}`;
      params.push(entidad_tipo);
    }

    query += ` ORDER BY h.creado_en DESC LIMIT $${paramIndex}`;
    params.push(Math.min(parseInt(limit), 50000));

    const result = await pool.query(query, params);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Portal SolDev INEMEC';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Historial de Cambios');

    // Define columns
    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Fecha', key: 'creado_en', width: 20 },
      { header: 'Entidad', key: 'entidad_tipo', width: 15 },
      { header: 'ID Entidad', key: 'entidad_id', width: 12 },
      { header: 'Accion', key: 'accion', width: 25 },
      { header: 'Usuario', key: 'usuario_nombre', width: 25 },
      { header: 'Email', key: 'usuario_email', width: 30 },
      { header: 'IP', key: 'ip_address', width: 15 },
      { header: 'Datos Anteriores', key: 'datos_anteriores', width: 50 },
      { header: 'Datos Nuevos', key: 'datos_nuevos', width: 50 }
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1890FF' }
    };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    result.rows.forEach(row => {
      sheet.addRow({
        id: row.id,
        creado_en: new Date(row.creado_en).toLocaleString('es-EC'),
        entidad_tipo: row.entidad_tipo,
        entidad_id: row.entidad_id,
        accion: row.accion,
        usuario_nombre: row.usuario_nombre || 'Sistema',
        usuario_email: row.usuario_email || '',
        ip_address: row.ip_address || '',
        datos_anteriores: row.datos_anteriores ? JSON.stringify(row.datos_anteriores, null, 2) : '',
        datos_nuevos: row.datos_nuevos ? JSON.stringify(row.datos_nuevos, null, 2) : ''
      });
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=historial-cambios-${new Date().toISOString().split('T')[0]}.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    logger.info(`Audit log exported (${result.rows.length} records) by user ${req.user.id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/export/solicitudes
 * Export solicitudes list as Excel
 */
router.get('/solicitudes', authenticate, authorize('nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const { desde, hasta, estado, tipo } = req.query;

    let query = `
      SELECT s.id, s.codigo, s.titulo, s.tipo, s.estado, s.prioridad,
             s.creado_en, s.actualizado_en,
             s.datos_solicitante->>'nombre' as solicitante_nombre,
             s.datos_solicitante->>'email' as solicitante_email,
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
    if (estado) {
      query += ` AND s.estado = $${paramIndex++}`;
      params.push(estado);
    }
    if (tipo) {
      query += ` AND s.tipo = $${paramIndex++}`;
      params.push(tipo);
    }

    query += ` ORDER BY s.creado_en DESC LIMIT 10000`;

    const result = await pool.query(query, params);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Solicitudes');

    sheet.columns = [
      { header: 'Codigo', key: 'codigo', width: 15 },
      { header: 'Titulo', key: 'titulo', width: 40 },
      { header: 'Tipo', key: 'tipo', width: 20 },
      { header: 'Estado', key: 'estado', width: 25 },
      { header: 'Prioridad', key: 'prioridad', width: 12 },
      { header: 'Solicitante', key: 'solicitante_nombre', width: 25 },
      { header: 'Departamento', key: 'departamento', width: 20 },
      { header: 'Evaluador', key: 'evaluador_nombre', width: 25 },
      { header: 'Fecha Creacion', key: 'creado_en', width: 18 },
      { header: 'Ultima Actualizacion', key: 'actualizado_en', width: 18 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1890FF' }
    };

    result.rows.forEach(row => {
      sheet.addRow({
        ...row,
        creado_en: new Date(row.creado_en).toLocaleString('es-EC'),
        actualizado_en: new Date(row.actualizado_en).toLocaleString('es-EC')
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=solicitudes-${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

    logger.info(`Solicitudes exported (${result.rows.length} records) by user ${req.user.id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/export/tickets
 * Export tickets list as Excel
 */
router.get('/tickets', authenticate, authorize('ti', 'nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { desde, hasta, estado, categoria } = req.query;

    let query = `
      SELECT t.id, t.codigo, t.titulo, t.categoria, t.estado, t.prioridad,
             t.creado_en, t.fecha_resolucion, t.resolucion,
             t.datos_solicitante->>'nombre' as solicitante_nombre,
             t.datos_solicitante->>'departamento' as departamento,
             u.nombre as asignado_nombre,
             EXTRACT(EPOCH FROM (COALESCE(t.fecha_resolucion, NOW()) - t.creado_en))/3600 as horas
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
    if (estado) {
      query += ` AND t.estado = $${paramIndex++}`;
      params.push(estado);
    }
    if (categoria) {
      query += ` AND t.categoria = $${paramIndex++}`;
      params.push(categoria);
    }

    query += ` ORDER BY t.creado_en DESC LIMIT 10000`;

    const result = await pool.query(query, params);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tickets');

    sheet.columns = [
      { header: 'Codigo', key: 'codigo', width: 15 },
      { header: 'Titulo', key: 'titulo', width: 40 },
      { header: 'Categoria', key: 'categoria', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Prioridad', key: 'prioridad', width: 12 },
      { header: 'Solicitante', key: 'solicitante_nombre', width: 25 },
      { header: 'Departamento', key: 'departamento', width: 20 },
      { header: 'Asignado', key: 'asignado_nombre', width: 25 },
      { header: 'Fecha Creacion', key: 'creado_en', width: 18 },
      { header: 'Fecha Resolucion', key: 'fecha_resolucion', width: 18 },
      { header: 'Horas', key: 'horas', width: 10 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1890FF' }
    };

    result.rows.forEach(row => {
      sheet.addRow({
        ...row,
        creado_en: new Date(row.creado_en).toLocaleString('es-EC'),
        fecha_resolucion: row.fecha_resolucion ? new Date(row.fecha_resolucion).toLocaleString('es-EC') : '',
        horas: row.horas ? Math.round(row.horas) : ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=tickets-${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

    logger.info(`Tickets exported (${result.rows.length} records) by user ${req.user.id}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
