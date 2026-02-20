const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { uploadMultiple, uploadsDir } = require('../config/multer');
const logger = require('../utils/logger');

// GET /api/respuestas/:token - Get response page data (public)
router.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    // Find pending response
    const result = await pool.query(
      `SELECT rp.*, c.contenido as pregunta, c.creado_en as pregunta_fecha,
              u.nombre as pregunta_autor,
              CASE
                WHEN rp.entidad_tipo = 'ticket' THEN (SELECT codigo FROM tickets WHERE id = rp.entidad_id)
                WHEN rp.entidad_tipo = 'solicitud' THEN (SELECT codigo FROM solicitudes WHERE id = rp.entidad_id)
              END as entidad_codigo,
              CASE
                WHEN rp.entidad_tipo = 'ticket' THEN (SELECT titulo FROM tickets WHERE id = rp.entidad_id)
                WHEN rp.entidad_tipo = 'solicitud' THEN (SELECT titulo FROM solicitudes WHERE id = rp.entidad_id)
              END as entidad_titulo
       FROM respuestas_pendientes rp
       JOIN comentarios c ON rp.comentario_id = c.id
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE rp.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new AppError('Enlace no válido o ya utilizado', 404);
    }

    const respuesta = result.rows[0];

    // Check if expired
    if (new Date() > new Date(respuesta.expira_en)) {
      throw new AppError('Este enlace ha expirado', 410);
    }

    // Check if already used
    if (respuesta.usado) {
      throw new AppError('Este enlace ya ha sido utilizado', 410);
    }

    res.json({
      entidad_tipo: respuesta.entidad_tipo,
      entidad_codigo: respuesta.entidad_codigo,
      entidad_titulo: respuesta.entidad_titulo,
      pregunta: respuesta.pregunta,
      pregunta_fecha: respuesta.pregunta_fecha,
      pregunta_autor: respuesta.pregunta_autor,
      expira_en: respuesta.expira_en
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/respuestas/:token - Submit response (public, with optional file upload)
router.post('/:token', uploadMultiple, async (req, res, next) => {
  try {
    const { token } = req.params;
    const { contenido } = req.body;

    if (!contenido || contenido.trim().length === 0) {
      throw new AppError('La respuesta no puede estar vacía', 400);
    }

    // Find and validate pending response
    const result = await pool.query(
      `SELECT rp.*,
              CASE
                WHEN rp.entidad_tipo = 'ticket' THEN (SELECT codigo FROM tickets WHERE id = rp.entidad_id)
                WHEN rp.entidad_tipo = 'solicitud' THEN (SELECT codigo FROM solicitudes WHERE id = rp.entidad_id)
              END as entidad_codigo,
              u.nombre as pregunta_autor,
              u.email as pregunta_autor_email
       FROM respuestas_pendientes rp
       LEFT JOIN usuarios u ON rp.usuario_pregunta_id = u.id
       WHERE rp.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new AppError('Enlace no válido o ya utilizado', 404);
    }

    const respuestaPendiente = result.rows[0];

    // Check if expired
    if (new Date() > new Date(respuestaPendiente.expira_en)) {
      throw new AppError('Este enlace ha expirado', 410);
    }

    // Check if already used
    if (respuestaPendiente.usado) {
      throw new AppError('Este enlace ya ha sido utilizado', 410);
    }

    // Get solicitante name from ticket/solicitud
    let solicitanteNombre = 'Solicitante';
    if (respuestaPendiente.entidad_tipo === 'ticket') {
      const ticketResult = await pool.query(
        'SELECT datos_solicitante FROM tickets WHERE id = $1',
        [respuestaPendiente.entidad_id]
      );
      if (ticketResult.rows.length > 0) {
        const datos = ticketResult.rows[0].datos_solicitante;
        solicitanteNombre = datos?.nombre_completo || datos?.nombre || 'Solicitante';
      }
    } else {
      const solicitudResult = await pool.query(
        'SELECT datos_solicitante FROM solicitudes WHERE id = $1',
        [respuestaPendiente.entidad_id]
      );
      if (solicitudResult.rows.length > 0) {
        const datos = solicitudResult.rows[0].datos_solicitante;
        solicitanteNombre = datos?.nombre_completo || datos?.nombre || 'Solicitante';
      }
    }

    // Insert response as a comment (tipo: 'respuesta' to identify as user response)
    const comentarioResult = await pool.query(
      `INSERT INTO comentarios (entidad_tipo, entidad_id, contenido, tipo, interno, autor_externo)
       VALUES ($1, $2, $3, 'respuesta', false, $4)
       RETURNING *`,
      [respuestaPendiente.entidad_tipo, respuestaPendiente.entidad_id, contenido.trim(), solicitanteNombre]
    );

    const comentario = comentarioResult.rows[0];

    // Upload files if any
    let attachmentNumbers = [];
    if (req.files && req.files.length > 0) {
      // Get current max respuesta_numero for this entity
      const maxNumResult = await pool.query(
        `SELECT MAX(CAST(respuesta_numero AS INTEGER)) as max_num
         FROM archivos
         WHERE entidad_tipo = $1 AND entidad_id = $2
           AND origen = 'respuesta_comunicacion'
           AND respuesta_numero IS NOT NULL`,
        [respuestaPendiente.entidad_tipo, respuestaPendiente.entidad_id]
      );
      let nextNum = (maxNumResult.rows[0]?.max_num || 0) + 1;

      for (const file of req.files) {
        const respuestaNumero = String(nextNum).padStart(3, '0');
        attachmentNumbers.push(respuestaNumero);

        await pool.query(
          `INSERT INTO archivos (
            entidad_tipo, entidad_id, nombre_original, nombre_almacenado,
            mime_type, tamano, ruta, origen, comentario_id, respuesta_numero
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'respuesta_comunicacion', $8, $9)`,
          [
            respuestaPendiente.entidad_tipo,
            respuestaPendiente.entidad_id,
            file.originalname,
            file.filename,
            file.mimetype,
            file.size,
            `/uploads/${file.filename}`,
            comentario.id,
            respuestaNumero
          ]
        );
        nextNum++;
      }
    }

    // Mark token as used
    await pool.query(
      'UPDATE respuestas_pendientes SET usado = true WHERE token = $1',
      [token]
    );

    // Send notification email to staff member who asked
    if (respuestaPendiente.pregunta_autor_email) {
      const emailService = require('../services/email');
      emailService.sendEmail({
        to: respuestaPendiente.pregunta_autor_email,
        subject: `Respuesta recibida - ${respuestaPendiente.entidad_codigo}`,
        html: `
          <h2>Nueva respuesta del solicitante</h2>
          <p>El solicitante ha respondido a su comunicación sobre <strong>${respuestaPendiente.entidad_codigo}</strong>:</p>
          <blockquote style="border-left: 3px solid #52c41a; padding-left: 15px; margin: 20px 0; color: #333;">
            ${contenido.trim().replace(/\n/g, '<br>')}
          </blockquote>
          <p><strong>De:</strong> ${solicitanteNombre}</p>
          ${req.files && req.files.length > 0 ? `<p><strong>Archivos adjuntos:</strong> ${req.files.length} archivo(s)</p>` : ''}
          <hr>
          <p style="color: #666; font-size: 12px;">INEMEC S.A. - Sistema de Gestión de Solicitudes</p>
        `
      }).catch(err => {
        logger.error('Error sending response notification email:', err);
      });
    }

    res.status(201).json({
      message: 'Respuesta enviada exitosamente',
      comentario
    });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) {
      const fs = require('fs');
      const path = require('path');
      for (const file of req.files) {
        const filePath = path.join(uploadsDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
    next(error);
  }
});

// Cleanup job - delete expired tokens (can be called by scheduler)
router.delete('/cleanup/expired', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM respuestas_pendientes
       WHERE expira_en < NOW() OR usado = true
       RETURNING id`
    );

    res.json({
      message: `${result.rowCount} tokens eliminados`,
      deleted: result.rowCount
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
