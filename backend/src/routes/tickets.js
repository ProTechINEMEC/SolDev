const express = require('express');
const Joi = require('joi');
const { pool, withTransaction } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const publicLabels = require('../utils/publicLabels');

const router = express.Router();

// ==============================================
// VALIDATION SCHEMAS
// ==============================================

// Identificación del Solicitante
const identificacionSchema = Joi.object({
  nombre_completo: Joi.string().required(),
  cargo: Joi.string().required(),
  area: Joi.string().required(),
  operacion_contrato: Joi.string().required(),
  correo: Joi.string().email().required(),
  telefono: Joi.string().allow('', null).optional(),
  cedula: Joi.string().required(),
  es_doliente: Joi.boolean().required()
});

// Criticidad section
const criticidadSchema = Joi.object({
  urgencia: Joi.string().valid('baja', 'media', 'alta', 'critica').required(),
  justificacion: Joi.string().required()
});

// New IT Ticket Schema (3 sections)
const createTicketSchema = Joi.object({
  titulo: Joi.string().min(5).max(200).required(),
  descripcion: Joi.string().min(10).max(2000).required(),
  categoria: Joi.string().valid('hardware', 'software', 'red', 'acceso', 'soporte_general', 'otro').default('soporte_general'),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').default('media'),

  // Session token for public submissions
  solicitante_session_token: Joi.string().optional(),

  // New structured form data
  datos_solicitante: identificacionSchema.optional(),
  criticidad: criticidadSchema.optional(),

  // Legacy fields (backwards compatibility)
  solicitante_nombre: Joi.string().min(2).max(100).optional(),
  solicitante_email: Joi.string().email().optional(),
  solicitante_departamento: Joi.string().max(100).optional(),
  solicitante_telefono: Joi.string().max(20).optional()
});

const updateTicketSchema = Joi.object({
  titulo: Joi.string().min(5).max(200).optional(),
  descripcion: Joi.string().min(10).max(2000).optional(),
  categoria: Joi.string().valid('hardware', 'software', 'red', 'acceso', 'otro').optional(),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica').optional(),
  resolucion: Joi.string().max(2000).optional()
});

// POST /api/tickets - Create ticket
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { error, value } = createTicketSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map(d => d.message).join('; ');
      throw new AppError(messages, 400);
    }

    let solicitanteId = null;
    let solicitanteData = {};

    // If public submission with session token
    if (!req.user && value.solicitante_session_token) {
      const sessionResult = await pool.query(
        `SELECT s.id, s.solicitante_id, sol.nombre, sol.email
         FROM sesiones_solicitante s
         JOIN solicitantes sol ON s.solicitante_id = sol.id
         WHERE s.token = $1 AND s.expira_en > NOW() AND s.activa = true`,
        [value.solicitante_session_token]
      );

      if (sessionResult.rows.length === 0) {
        throw new AppError('Sesión de verificación inválida o expirada', 401);
      }

      solicitanteId = sessionResult.rows[0].solicitante_id;

      // Use new structured form data if available
      if (value.datos_solicitante) {
        solicitanteData = {
          nombre_completo: value.datos_solicitante.nombre_completo,
          cargo: value.datos_solicitante.cargo,
          area: value.datos_solicitante.area,
          operacion_contrato: value.datos_solicitante.operacion_contrato,
          correo: value.datos_solicitante.correo,
          telefono: value.datos_solicitante.telefono,
          cedula: value.datos_solicitante.cedula,
          es_doliente: value.datos_solicitante.es_doliente,
          criticidad: value.criticidad
        };
      } else {
        // Legacy format
        solicitanteData = {
          nombre: sessionResult.rows[0].nombre,
          email: sessionResult.rows[0].email,
          departamento: value.solicitante_departamento,
          telefono: value.solicitante_telefono
        };
      }
    } else if (!req.user) {
      // Direct submission without verification (internal use)
      if (value.datos_solicitante) {
        solicitanteData = {
          nombre_completo: value.datos_solicitante.nombre_completo,
          cargo: value.datos_solicitante.cargo,
          area: value.datos_solicitante.area,
          operacion_contrato: value.datos_solicitante.operacion_contrato,
          correo: value.datos_solicitante.correo,
          telefono: value.datos_solicitante.telefono,
          cedula: value.datos_solicitante.cedula,
          es_doliente: value.datos_solicitante.es_doliente,
          criticidad: value.criticidad
        };
      } else if (!value.solicitante_nombre || !value.solicitante_email) {
        throw new AppError('Se requiere información del solicitante', 400);
      } else {
        solicitanteData = {
          nombre: value.solicitante_nombre,
          email: value.solicitante_email,
          departamento: value.solicitante_departamento,
          telefono: value.solicitante_telefono
        };
      }
    } else {
      // Staff creating ticket
      solicitanteData = {
        nombre: req.user.nombre,
        email: req.user.email
      };
    }

    // Generate ticket code: TKT-YYYY-XXXX
    const year = new Date().getFullYear();
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tickets WHERE EXTRACT(YEAR FROM creado_en) = $1`,
      [year]
    );
    const count = parseInt(countResult.rows[0].count, 10) + 1;
    const codigo = `TKT-${year}-${count.toString().padStart(4, '0')}`;

    const result = await pool.query(
      `INSERT INTO tickets (
        codigo, titulo, descripcion, categoria, prioridad, estado,
        solicitante_id, usuario_creador_id, datos_solicitante
      ) VALUES ($1, $2, $3, $4, $5, 'abierto', $6, $7, $8)
      RETURNING *`,
      [
        codigo,
        value.titulo,
        value.descripcion,
        value.categoria,
        value.prioridad,
        solicitanteId,
        req.user?.id || null,
        JSON.stringify(solicitanteData)
      ]
    );

    const ticket = result.rows[0];

    // Notify TI team
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
       SELECT id, 'nuevo_ticket', 'Nuevo ticket de soporte',
         $1, $2
       FROM usuarios WHERE rol = 'ti' AND activo = true`,
      [
        `Nuevo ticket ${codigo}: ${value.titulo}`,
        JSON.stringify({ ticket_id: ticket.id, codigo })
      ]
    );

    logger.info(`New ticket created: ${codigo}`);

    res.status(201).json({
      message: 'Ticket creado exitosamente',
      ticket: {
        id: ticket.id,
        codigo: ticket.codigo,
        titulo: ticket.titulo,
        estado: ticket.estado,
        prioridad: ticket.prioridad,
        creado_en: ticket.creado_en
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tickets - List tickets
router.get('/', authenticate, authorize('ti', 'nuevas_tecnologias', 'gerencia'), async (req, res, next) => {
  try {
    const {
      estado,
      categoria,
      prioridad,
      asignado_id,
      search,
      solicitante,
      fecha_desde,
      fecha_hasta,
      sort_by = 'creado_en',
      sort_order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    let query = `
      SELECT t.*,
        u.nombre as asignado_nombre,
        COALESCE(
          t.datos_solicitante->>'nombre_completo',
          t.datos_solicitante->>'nombre',
          sol.nombre
        ) as solicitante_nombre,
        COALESCE(
          t.datos_solicitante->>'correo',
          t.datos_solicitante->>'email',
          sol.email
        ) as solicitante_email
      FROM tickets t
      LEFT JOIN usuarios u ON t.asignado_id = u.id
      LEFT JOIN solicitantes sol ON t.solicitante_id = sol.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (estado) {
      const estados = estado.split(',');
      query += ` AND t.estado = ANY($${paramIndex++})`;
      params.push(estados);
    }

    if (categoria) {
      query += ` AND t.categoria = $${paramIndex++}`;
      params.push(categoria);
    }

    if (prioridad) {
      const prioridades = prioridad.split(',');
      query += ` AND t.prioridad = ANY($${paramIndex++})`;
      params.push(prioridades);
    }

    if (asignado_id) {
      query += ` AND t.asignado_id = $${paramIndex++}`;
      params.push(asignado_id);
    }

    if (search) {
      query += ` AND (t.titulo ILIKE $${paramIndex} OR t.codigo ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filter by solicitante (searches in JSONB datos_solicitante)
    if (solicitante) {
      query += ` AND (
        t.datos_solicitante->>'nombre_completo' ILIKE $${paramIndex}
        OR t.datos_solicitante->>'nombre' ILIKE $${paramIndex}
        OR t.datos_solicitante->>'correo' ILIKE $${paramIndex}
        OR t.datos_solicitante->>'email' ILIKE $${paramIndex}
        OR t.datos_solicitante->>'cedula' ILIKE $${paramIndex}
      )`;
      params.push(`%${solicitante}%`);
      paramIndex++;
    }

    // Date range filters
    if (fecha_desde) {
      query += ` AND t.creado_en >= $${paramIndex++}::date`;
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      query += ` AND t.creado_en < ($${paramIndex++}::date + interval '1 day')`;
      params.push(fecha_hasta);
    }

    // NT only sees escalated tickets
    if (req.user.rol === 'nuevas_tecnologias') {
      query += ` AND t.estado = 'escalado_nt'`;
    }

    // Count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as subquery`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Sorting - validate sort_by to prevent SQL injection
    const validSortColumns = ['creado_en', 'actualizado_en', 'prioridad', 'estado', 'codigo', 'titulo'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'creado_en';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Special handling for prioridad sorting (custom order)
    if (sortColumn === 'prioridad') {
      query += ` ORDER BY
        CASE t.prioridad
          WHEN 'critica' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          ELSE 4
        END ${sortDirection},
        t.creado_en DESC`;
    } else {
      query += ` ORDER BY t.${sortColumn} ${sortDirection}`;
    }

    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

    const result = await pool.query(query, params);

    res.json({
      tickets: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tickets/:id - Get single ticket
router.get('/:id', authenticate, authorize('ti', 'nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if id is numeric or a code string
    const isNumeric = /^\d+$/.test(id);
    const whereClause = isNumeric ? 't.id = $1' : 't.codigo = $1';

    const result = await pool.query(
      `SELECT t.*,
        u.nombre as asignado_nombre,
        u.email as asignado_email
       FROM tickets t
       LEFT JOIN usuarios u ON t.asignado_id = u.id
       WHERE ${whereClause}`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Ticket no encontrado', 404);
    }

    const ticket = result.rows[0];

    // Get comments
    const comentarios = await pool.query(
      `SELECT c.*, u.nombre as autor_nombre
       FROM comentarios c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.entidad_tipo = 'ticket' AND c.entidad_id = $1
       ORDER BY c.creado_en DESC`,
      [ticket.id]
    );

    // Get files
    const archivos = await pool.query(
      `SELECT * FROM archivos WHERE entidad_tipo = 'ticket' AND entidad_id = $1`,
      [ticket.id]
    );

    res.json({
      ticket,
      comentarios: comentarios.rows,
      archivos: archivos.rows
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tickets/:id - Update ticket
router.put('/:id', authenticate, authorize('ti', 'nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = updateTicketSchema.validate(req.body);

    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        updates.push(`${key} = $${paramIndex++}`);
        params.push(val);
      }
    });

    if (updates.length === 0) {
      throw new AppError('No hay campos para actualizar', 400);
    }

    updates.push(`actualizado_en = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new AppError('Ticket no encontrado', 404);
    }

    res.json({
      message: 'Ticket actualizado',
      ticket: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tickets/:id/estado - Change ticket state
router.put('/:id/estado', authenticate, authorize('ti', 'nuevas_tecnologias'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado, comentario, resolucion } = req.body;

    const validStates = ['abierto', 'en_proceso', 'resuelto', 'cerrado', 'escalado_nt', 'solucionado', 'no_realizado', 'transferido_nt'];
    if (!validStates.includes(estado)) {
      throw new AppError('Estado inválido', 400);
    }

    const existing = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new AppError('Ticket no encontrado', 404);
    }

    const ticket = existing.rows[0];

    // Terminal states cannot be changed
    const terminalStates = ['solucionado', 'no_realizado', 'transferido_nt', 'cerrado'];
    if (terminalStates.includes(ticket.estado)) {
      throw new AppError(`El ticket está en estado terminal '${ticket.estado}' y no puede ser modificado`, 403);
    }

    // Validate transitions
    const validTransitions = {
      ti: {
        abierto: ['en_proceso', 'solucionado', 'no_realizado', 'escalado_nt', 'transferido_nt'],
        en_proceso: ['solucionado', 'no_realizado', 'escalado_nt', 'transferido_nt', 'abierto'],
        resuelto: ['cerrado', 'abierto', 'solucionado'],
        escalado_nt: [] // TI can't change escalated tickets
      },
      nuevas_tecnologias: {
        escalado_nt: ['en_proceso', 'resuelto', 'solucionado', 'no_realizado'] // NT handles escalated tickets
      }
    };

    const allowedTransitions = validTransitions[req.user.rol]?.[ticket.estado] || [];
    if (!allowedTransitions.includes(estado)) {
      throw new AppError(`No puede cambiar el estado de '${ticket.estado}' a '${estado}'`, 403);
    }

    await withTransaction(async (client) => {
      // Auto-assign if moving to en_proceso and not assigned
      let asignadoId = ticket.asignado_id;
      if (estado === 'en_proceso' && !asignadoId) {
        asignadoId = req.user.id;
      }

      // Check if this is a resolution state (to set fecha_resolucion)
      const isResolutionState = ['resuelto', 'cerrado', 'solucionado', 'no_realizado'].includes(estado);

      await client.query(
        `UPDATE tickets SET
          estado = $1::estado_ticket,
          asignado_id = COALESCE($2, asignado_id),
          resolucion = COALESCE($3, resolucion),
          fecha_resolucion = CASE WHEN $4 THEN NOW() ELSE fecha_resolucion END,
          actualizado_en = NOW()
         WHERE id = $5`,
        [estado, asignadoId, resolucion, isResolutionState, id]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('ticket', $1, 'cambio_estado', $2, $3, $4)`,
        [id, JSON.stringify({ estado: ticket.estado }), JSON.stringify({ estado, comentario }), req.user.id]
      );

      if (comentario) {
        await client.query(
          `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo)
           VALUES ('ticket', $1, $2, $3, 'cambio_estado')`,
          [id, req.user.id, comentario]
        );
      }

      // Notify NT if escalated
      if (estado === 'escalado_nt') {
        await client.query(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
           SELECT id, 'ticket_escalado', 'Ticket escalado a NT',
             $1, $2
           FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true`,
          [
            `El ticket ${ticket.codigo} ha sido escalado a Nuevas Tecnologías`,
            JSON.stringify({ ticket_id: id, codigo: ticket.codigo })
          ]
        );
      }
    });

    logger.info(`Ticket ${ticket.codigo} state changed: ${ticket.estado} -> ${estado}`);

    // Send email and real-time notifications asynchronously
    notificationService.onTicketStatusChange(
      id,
      ticket.estado,
      estado,
      req.user.id,
      resolucion
    ).catch(err => logger.error('Failed to send ticket notifications:', err));

    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tickets/:id/escalar - Escalate to NT
router.put('/:id/escalar', authenticate, authorize('ti'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      throw new AppError('Debe proporcionar un motivo para escalar', 400);
    }

    req.body.estado = 'escalado_nt';
    req.body.comentario = `Escalado a NT: ${motivo}`;

    // Reuse estado change logic
    return router.handle({ ...req, params: { id }, body: { estado: 'escalado_nt', comentario: `Escalado a NT: ${motivo}` } }, res, next);
  } catch (error) {
    next(error);
  }
});

// POST /api/tickets/:id/comentarios - Add comment
router.post('/:id/comentarios', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contenido, interno = false } = req.body;

    if (!contenido || contenido.trim().length === 0) {
      throw new AppError('El comentario no puede estar vacío', 400);
    }

    const ticketResult = await pool.query('SELECT id FROM tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      throw new AppError('Ticket no encontrado', 404);
    }

    const result = await pool.query(
      `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, interno)
       VALUES ('ticket', $1, $2, $3, $4)
       RETURNING *`,
      [id, req.user.id, contenido.trim(), interno]
    );

    res.status(201).json({
      message: 'Comentario agregado',
      comentario: {
        ...result.rows[0],
        autor_nombre: req.user.nombre
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tickets/consulta/:codigo - Public ticket status
router.get('/consulta/:codigo', async (req, res, next) => {
  try {
    const { codigo } = req.params;

    const result = await pool.query(
      `SELECT t.codigo, t.titulo, t.categoria, t.estado, t.prioridad, t.creado_en, t.actualizado_en,
              t.transferido_a_solicitud_id,
              s.codigo as solicitud_codigo
       FROM tickets t
       LEFT JOIN solicitudes s ON t.transferido_a_solicitud_id = s.id
       WHERE t.codigo = $1`,
      [codigo.toUpperCase()]
    );

    if (result.rows.length === 0) {
      throw new AppError('Ticket no encontrado', 404);
    }

    const ticket = result.rows[0];

    // Add transfer info if applicable
    let transferInfo = null;
    if (ticket.estado === 'transferido_nt' && ticket.solicitud_codigo) {
      transferInfo = {
        tipo: 'ticket_a_solicitud',
        nuevo_codigo: ticket.solicitud_codigo,
        mensaje: `Este ticket fue transferido a Desarrollo. Nuevo código: ${ticket.solicitud_codigo}`
      };
    }

    // Get milestones for tickets (simplified)
    const milestones = [
      { id: 'recibido', label: 'Recibido', completed: true },
      { id: 'proceso', label: 'En Proceso', completed: false },
      { id: 'resuelto', label: 'Resuelto', completed: false }
    ];

    switch (ticket.estado) {
      case 'asignado':
      case 'en_proceso':
        milestones[1].completed = true;
        milestones[1].current = true;
        break;
      case 'resuelto':
      case 'cerrado':
      case 'solucionado':
        milestones.forEach(m => m.completed = true);
        break;
      case 'no_realizado':
        milestones[1].completed = true;
        milestones[2].rejected = true;
        break;
      case 'transferido_nt':
        milestones[1].completed = true;
        milestones[2].label = 'Transferido';
        milestones[2].transferred = true;
        break;
      default:
        milestones[1].current = true;
    }

    const completedMilestones = milestones.filter(m => m.completed).length;
    const progress = Math.round((completedMilestones / milestones.length) * 100);

    const esTerminal = ['resuelto', 'cerrado', 'solucionado', 'no_realizado'].includes(ticket.estado);

    res.json({
      ticket: {
        codigo: ticket.codigo,
        titulo: ticket.titulo,
        categoria: ticket.categoria,
        estado: publicLabels.getTicketEstadoLabel(ticket.estado),
        estado_interno: ticket.estado,
        prioridad: publicLabels.getPrioridadLabel(ticket.prioridad),
        creado_en: ticket.creado_en,
        actualizado_en: ticket.actualizado_en,
        progress,
        milestones,
        es_terminal: esTerminal,
        es_transferido: ticket.estado === 'transferido_nt'
      },
      transferencia: transferInfo
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/tickets/:id/transferir-nt - Transfer ticket to NT as a new solicitud
router.post('/:id/transferir-nt', authenticate, authorize('ti'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { motivo, tipo_solicitud = 'transferido_ti' } = req.body;

    if (!motivo || motivo.trim().length === 0) {
      throw new AppError('Debe proporcionar un motivo para la transferencia', 400);
    }

    // Get the ticket
    const ticketResult = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      throw new AppError('Ticket no encontrado', 404);
    }

    const ticket = ticketResult.rows[0];

    // Check if ticket is in a valid state for transfer
    const transferableStates = ['abierto', 'en_proceso'];
    if (!transferableStates.includes(ticket.estado)) {
      throw new AppError(`No se puede transferir un ticket en estado '${ticket.estado}'`, 400);
    }

    // Check if already transferred
    if (ticket.transferido_a_solicitud_id) {
      throw new AppError('Este ticket ya ha sido transferido', 400);
    }

    await withTransaction(async (client) => {
      // Generate solicitud code
      const year = new Date().getFullYear();
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const countResult = await client.query(
        `SELECT COUNT(*) FROM solicitudes WHERE EXTRACT(YEAR FROM creado_en) = $1 AND EXTRACT(MONTH FROM creado_en) = $2`,
        [year, new Date().getMonth() + 1]
      );
      const count = parseInt(countResult.rows[0].count, 10) + 1;
      const solicitudCodigo = `SOL-${year}${month}-${count.toString().padStart(4, '0')}`;

      // Create the new solicitud
      const solicitudResult = await client.query(
        `INSERT INTO solicitudes (
          codigo, tipo, estado, prioridad, titulo,
          solicitante_id, usuario_creador_id,
          datos_solicitante, descripcion_problema, origen_ticket_id
        ) VALUES ($1, $2, 'pendiente_evaluacion_nt', $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          solicitudCodigo,
          tipo_solicitud,
          ticket.prioridad,
          `[Transferido de ${ticket.codigo}] ${ticket.titulo}`,
          ticket.solicitante_id,
          req.user.id,
          JSON.stringify(ticket.datos_solicitante || {}),
          JSON.stringify({
            descripcion_original: ticket.descripcion,
            motivo_transferencia: motivo,
            ticket_origen: ticket.codigo
          }),
          ticket.id
        ]
      );

      const solicitud = solicitudResult.rows[0];

      // Update ticket to transferred state
      await client.query(
        `UPDATE tickets SET
          estado = 'transferido_nt',
          transferido_a_solicitud_id = $1,
          resolucion = $2,
          fecha_resolucion = NOW(),
          actualizado_en = NOW()
         WHERE id = $3`,
        [solicitud.id, `Transferido a NT. Nueva solicitud: ${solicitudCodigo}. Motivo: ${motivo}`, id]
      );

      // Create transfer record
      await client.query(
        `INSERT INTO transferencias (
          tipo, origen_tipo, origen_id, origen_codigo,
          destino_tipo, destino_id, destino_codigo,
          motivo, usuario_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'ticket_a_solicitud',
          'ticket',
          ticket.id,
          ticket.codigo,
          'solicitud',
          solicitud.id,
          solicitudCodigo,
          motivo,
          req.user.id
        ]
      );

      // Add comment to ticket
      await client.query(
        `INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, contenido, tipo)
         VALUES ('ticket', $1, $2, $3, 'transferencia')`,
        [id, req.user.id, `Ticket transferido a Nuevas Tecnologías. Nueva solicitud: ${solicitudCodigo}\nMotivo: ${motivo}`]
      );

      // Log change
      await client.query(
        `INSERT INTO historial_cambios (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id)
         VALUES ('ticket', $1, 'transferencia', $2, $3, $4)`,
        [
          id,
          JSON.stringify({ estado: ticket.estado }),
          JSON.stringify({ estado: 'transferido_nt', solicitud_id: solicitud.id, solicitud_codigo: solicitudCodigo }),
          req.user.id
        ]
      );

      // Notify NT team
      await client.query(
        `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos)
         SELECT id, 'ticket_transferido', 'Ticket transferido de TI',
           $1, $2
         FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true`,
        [
          `El ticket ${ticket.codigo} ha sido transferido como solicitud ${solicitudCodigo}`,
          JSON.stringify({
            ticket_id: ticket.id,
            ticket_codigo: ticket.codigo,
            solicitud_id: solicitud.id,
            solicitud_codigo: solicitudCodigo
          })
        ]
      );

      logger.info(`Ticket ${ticket.codigo} transferred to NT as ${solicitudCodigo}`);

      res.json({
        message: 'Ticket transferido exitosamente',
        ticket: {
          id: ticket.id,
          codigo: ticket.codigo,
          estado: 'transferido_nt'
        },
        solicitud: {
          id: solicitud.id,
          codigo: solicitudCodigo
        },
        transferencia: {
          origen: ticket.codigo,
          destino: solicitudCodigo
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
