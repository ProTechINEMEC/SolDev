const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { uploadMultiple, uploadSingle, uploadsDir, allowedTypes } = require('../config/multer');
const { AppError } = require('../middleware/errorHandler');
const path = require('path');
const fs = require('fs');

// POST /api/archivos/upload - Upload files for an entity
router.post('/upload', optionalAuth, uploadMultiple, async (req, res, next) => {
  try {
    const { entidad_tipo, entidad_id, session_token, origen = 'creacion', comentario_id } = req.body;

    // Validate entity type
    const validEntityTypes = ['solicitud', 'ticket', 'proyecto', 'articulo'];
    if (!validEntityTypes.includes(entidad_tipo)) {
      throw new AppError(`Tipo de entidad inválido: ${entidad_tipo}`, 400);
    }

    // Validate entity_id
    if (!entidad_id) {
      throw new AppError('ID de entidad requerido', 400);
    }

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      throw new AppError('No se enviaron archivos', 400);
    }

    // Determine user ID (from auth or session token)
    let userId = req.user?.id || null;

    // If not authenticated, validate session token for public submissions
    if (!userId && session_token) {
      const sessionResult = await pool.query(
        `SELECT s.solicitante_id
         FROM sesiones_solicitante s
         WHERE s.token = $1 AND s.expira_en > NOW() AND s.activa = true`,
        [session_token]
      );
      if (sessionResult.rows.length > 0) {
        // Session is valid, but we don't have a user ID in usuarios table
        // For public uploads, subido_por will be null
        userId = null;
      }
    }

    // Validate origen (form sections)
    const validOrigins = [
      'creacion',
      'problematica_evidencia',
      'solucion_referencias',
      'solucion_material',
      'adjuntos_generales',
      'reporte_evidencia',
      'respuesta_comunicacion'
    ];
    const safeOrigen = validOrigins.includes(origen) ? origen : 'creacion';

    // Insert file records
    const insertedFiles = [];
    for (const file of req.files) {
      const result = await pool.query(
        `INSERT INTO archivos (
          entidad_tipo, entidad_id, nombre_original, nombre_almacenado,
          mime_type, tamano, ruta, subido_por, origen, comentario_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          entidad_tipo,
          entidad_id,
          file.originalname,
          file.filename,
          file.mimetype,
          file.size,
          `/uploads/${file.filename}`,
          userId,
          safeOrigen,
          comentario_id || null
        ]
      );
      insertedFiles.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${insertedFiles.length} archivo(s) subido(s) exitosamente`,
      archivos: insertedFiles
    });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) {
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

// POST /api/archivos/upload-single - Upload a single file
router.post('/upload-single', optionalAuth, uploadSingle, async (req, res, next) => {
  try {
    const { entidad_tipo, entidad_id, session_token } = req.body;

    // Validate entity type
    const validEntityTypes = ['solicitud', 'ticket', 'proyecto', 'articulo'];
    if (!validEntityTypes.includes(entidad_tipo)) {
      throw new AppError(`Tipo de entidad inválido: ${entidad_tipo}`, 400);
    }

    if (!entidad_id) {
      throw new AppError('ID de entidad requerido', 400);
    }

    if (!req.file) {
      throw new AppError('No se envió archivo', 400);
    }

    let userId = req.user?.id || null;

    const result = await pool.query(
      `INSERT INTO archivos (
        entidad_tipo, entidad_id, nombre_original, nombre_almacenado,
        mime_type, tamano, ruta, subido_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        entidad_tipo,
        entidad_id,
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        `/uploads/${req.file.filename}`,
        userId
      ]
    );

    res.status(201).json({
      message: 'Archivo subido exitosamente',
      archivo: result.rows[0]
    });
  } catch (error) {
    if (req.file) {
      const filePath = path.join(uploadsDir, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    next(error);
  }
});

// Origin labels for display (form sections)
const origenLabels = {
  problematica_evidencia: 'Problemática - Evidencia',
  solucion_referencias: 'Solución - Referencias',
  solucion_material: 'Solución - Material de Referencia',
  adjuntos_generales: 'Adjuntos Generales',
  reporte_evidencia: 'Reporte - Evidencia',
  respuesta_comunicacion: 'Respuesta a Comunicación',
  creacion: 'Adjuntos del Solicitante'
};

// GET /api/archivos/entity/:tipo/:id - Get files for an entity
router.get('/entity/:tipo/:id', optionalAuth, async (req, res, next) => {
  try {
    const { tipo, id } = req.params;
    const { grouped } = req.query;

    const validEntityTypes = ['solicitud', 'ticket', 'proyecto', 'articulo'];
    if (!validEntityTypes.includes(tipo)) {
      throw new AppError(`Tipo de entidad inválido: ${tipo}`, 400);
    }

    const result = await pool.query(
      `SELECT a.*, u.nombre as subido_por_nombre
       FROM archivos a
       LEFT JOIN usuarios u ON a.subido_por = u.id
       WHERE a.entidad_tipo = $1 AND a.entidad_id = $2
       ORDER BY a.origen, a.creado_en DESC`,
      [tipo, id]
    );

    if (grouped === 'true') {
      // Group by origen
      const groupedArchivos = {};
      for (const archivo of result.rows) {
        const origen = archivo.origen || 'creacion';
        if (!groupedArchivos[origen]) {
          groupedArchivos[origen] = {
            origen,
            label: origenLabels[origen] || origen,
            archivos: []
          };
        }
        groupedArchivos[origen].archivos.push(archivo);
      }
      res.json({ archivos_agrupados: Object.values(groupedArchivos), total: result.rows.length });
    } else {
      res.json({ archivos: result.rows });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/archivos/:id - Get file info
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT a.*, u.nombre as subido_por_nombre
       FROM archivos a
       LEFT JOIN usuarios u ON a.subido_por = u.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Archivo no encontrado', 404);
    }

    res.json({ archivo: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/archivos/:id/download - Download a file
router.get('/:id/download', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM archivos WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Archivo no encontrado', 404);
    }

    const archivo = result.rows[0];
    const filePath = path.join(uploadsDir, archivo.nombre_almacenado);

    if (!fs.existsSync(filePath)) {
      throw new AppError('Archivo no encontrado en el servidor', 404);
    }

    res.download(filePath, archivo.nombre_original);
  } catch (error) {
    next(error);
  }
});

// GET /api/archivos/:id/preview - Get file for preview (inline)
router.get('/:id/preview', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM archivos WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Archivo no encontrado', 404);
    }

    const archivo = result.rows[0];
    const filePath = path.join(uploadsDir, archivo.nombre_almacenado);

    if (!fs.existsSync(filePath)) {
      throw new AppError('Archivo no encontrado en el servidor', 404);
    }

    // Set content type and disposition for inline viewing
    res.setHeader('Content-Type', archivo.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${archivo.nombre_original}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/archivos/:id - Delete a file
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get file info first
    const fileResult = await pool.query(
      `SELECT * FROM archivos WHERE id = $1`,
      [id]
    );

    if (fileResult.rows.length === 0) {
      throw new AppError('Archivo no encontrado', 404);
    }

    const archivo = fileResult.rows[0];

    // Check permissions - only uploader, TI, NT, or gerencia can delete
    const allowedRoles = ['ti', 'nuevas_tecnologias', 'gerencia', 'admin'];
    const isOwner = archivo.subido_por === req.user.id;
    const hasRole = allowedRoles.includes(req.user.rol);

    if (!isOwner && !hasRole) {
      throw new AppError('No tiene permisos para eliminar este archivo', 403);
    }

    // Delete from database
    await pool.query(`DELETE FROM archivos WHERE id = $1`, [id]);

    // Delete physical file
    const filePath = path.join(uploadsDir, archivo.nombre_almacenado);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Archivo eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
});

// GET /api/archivos/allowed-types - Get allowed file types
router.get('/config/allowed-types', (req, res) => {
  res.json({
    allowedTypes,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10
  });
});

module.exports = router;
