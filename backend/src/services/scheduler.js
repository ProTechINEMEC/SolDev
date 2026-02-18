/**
 * Scheduler Service
 * Automated scheduled tasks using node-cron
 */

const cron = require('node-cron');
const { pool } = require('../config/database');
const emailService = require('./email');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

const scheduler = {
  /**
   * Start all scheduled tasks
   */
  start() {
    // Weekly report generation - Mondays at 8:00 AM
    cron.schedule('0 8 * * 1', async () => {
      logger.info('Running scheduled weekly report generation');
      await this.generateAndSendWeeklyReport();
    }, {
      timezone: 'America/Guayaquil'
    });

    // Daily cleanup of expired tokens - Daily at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      logger.info('Running scheduled token cleanup');
      await this.cleanupExpiredTokens();
    }, {
      timezone: 'America/Guayaquil'
    });

    // Daily reminder for pending approvals - Weekdays at 9:00 AM
    cron.schedule('0 9 * * 1-5', async () => {
      logger.info('Running pending approvals reminder');
      await this.sendPendingApprovalsReminder();
    }, {
      timezone: 'America/Guayaquil'
    });

    // Daily deadline check - Weekdays at 8:00 AM
    cron.schedule('0 8 * * 1-5', async () => {
      logger.info('Running deadline check');
      await notificationService.checkUpcomingDeadlines();
    }, {
      timezone: 'America/Guayaquil'
    });

    // Daily reevaluation reminder - Weekdays at 10:00 AM
    cron.schedule('0 10 * * 1-5', async () => {
      logger.info('Running reevaluation reminder');
      await this.sendReevaluationReminder();
    }, {
      timezone: 'America/Guayaquil'
    });

    logger.info('Scheduler started with timezone America/Guayaquil');
  },

  /**
   * Generate weekly report and send to gerencia and NT users
   */
  async generateAndSendWeeklyReport() {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() - 7); // Previous week Sunday
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Generate report data
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

      const proyectosStats = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado IN ('planificacion', 'en_desarrollo')) as activos,
          COUNT(*) FILTER (WHERE estado = 'completado' AND actualizado_en BETWEEN $1 AND $2) as completados_semana,
          COUNT(*) FILTER (WHERE estado = 'pausado') as pausados
        FROM proyectos
      `, [startOfWeek, endOfWeek]);

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

      const reporteData = {
        solicitudes: solicitudesStats.rows[0],
        proyectos: proyectosStats.rows[0],
        tickets: ticketsStats.rows[0],
        generado_en: new Date().toISOString()
      };

      // Save report to database
      await pool.query(`
        INSERT INTO reportes_semanales (fecha_inicio, fecha_fin, datos)
        VALUES ($1, $2, $3)
        ON CONFLICT (fecha_inicio) DO UPDATE SET datos = $3, actualizado_en = NOW()
      `, [startOfWeek, endOfWeek, JSON.stringify(reporteData)]);

      // Send email to gerencia and NT users
      const recipients = await pool.query(
        "SELECT email, nombre FROM usuarios WHERE rol IN ('gerencia', 'nuevas_tecnologias') AND activo = true"
      );

      for (const user of recipients.rows) {
        try {
          await emailService.sendWeeklyReport(user.email, user.nombre, reporteData);
        } catch (error) {
          logger.error(`Failed to send weekly report to ${user.email}:`, error);
        }
      }

      logger.info(`Weekly report generated and sent to ${recipients.rows.length} users`);
    } catch (error) {
      logger.error('Failed to generate weekly report:', error);
    }
  },

  /**
   * Cleanup expired tokens and old sessions
   */
  async cleanupExpiredTokens() {
    try {
      // Clean expired password reset tokens
      const resetResult = await pool.query(
        'DELETE FROM password_reset_tokens WHERE expira_en < NOW() RETURNING id'
      );

      // Clean expired verification codes
      const verifyResult = await pool.query(
        'DELETE FROM codigos_verificacion WHERE expira_en < NOW() RETURNING id'
      );

      // Clean old inactive sessions (older than 30 days)
      const sessionResult = await pool.query(
        "DELETE FROM sesiones WHERE activa = false AND creado_en < NOW() - INTERVAL '30 days' RETURNING id"
      );

      // Clean old expired sessions
      const expiredSessionResult = await pool.query(
        "DELETE FROM sesiones WHERE expira_en < NOW() - INTERVAL '7 days' RETURNING id"
      );

      logger.info(`Token cleanup: ${resetResult.rowCount} reset tokens, ${verifyResult.rowCount} verification codes, ${sessionResult.rowCount + expiredSessionResult.rowCount} sessions deleted`);
    } catch (error) {
      logger.error('Failed to cleanup tokens:', error);
    }
  },

  /**
   * Send reminder for pending approvals to gerencia
   */
  async sendPendingApprovalsReminder() {
    try {
      // Get pending approvals count
      const pendingResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM solicitudes
        WHERE estado = 'pendiente_aprobacion_gerencia'
      `);

      const pendingCount = parseInt(pendingResult.rows[0].count);

      if (pendingCount === 0) {
        logger.info('No pending approvals to remind');
        return;
      }

      // Get gerencia users
      const gerenciaUsers = await pool.query(
        "SELECT email, nombre FROM usuarios WHERE rol = 'gerencia' AND activo = true"
      );

      // We could create a reminder email template, for now just log
      logger.info(`Reminder: ${pendingCount} solicitudes pending approval for ${gerenciaUsers.rows.length} gerencia users`);

      // TODO: Implement reminder email when needed
      // for (const user of gerenciaUsers.rows) {
      //   await emailService.sendPendingReminder(user.email, user.nombre, pendingCount);
      // }

    } catch (error) {
      logger.error('Failed to send pending approvals reminder:', error);
    }
  },

  /**
   * Send reminder for solicitudes pending reevaluation
   */
  async sendReevaluationReminder() {
    try {
      // Get solicitudes pending reevaluation that have been waiting for more than 2 days
      const pendingResult = await pool.query(`
        SELECT s.id, s.codigo, s.titulo, s.actualizado_en
        FROM solicitudes s
        WHERE s.estado = 'pendiente_reevaluacion'
          AND s.actualizado_en < NOW() - INTERVAL '2 days'
      `);

      if (pendingResult.rows.length === 0) {
        logger.info('No pending reevaluations to remind');
        return;
      }

      // Get NT users
      const ntUsers = await pool.query(
        "SELECT id, email, nombre FROM usuarios WHERE rol = 'nuevas_tecnologias' AND activo = true"
      );

      for (const user of ntUsers.rows) {
        for (const solicitud of pendingResult.rows) {
          // Check if we already sent reminder today
          const existing = await pool.query(
            `SELECT id FROM notificaciones
             WHERE usuario_id = $1 AND tipo = 'recordatorio_reevaluacion'
               AND datos->>'solicitud_id' = $2
               AND creado_en::date = CURRENT_DATE`,
            [user.id, solicitud.id.toString()]
          );

          if (existing.rows.length === 0) {
            await notificationService.createNotification(
              user.id,
              'recordatorio_reevaluacion',
              `Reevaluación pendiente: ${solicitud.codigo}`,
              `La solicitud "${solicitud.titulo}" está pendiente de reevaluación`,
              { solicitud_id: solicitud.id, codigo: solicitud.codigo }
            );
          }
        }
      }

      logger.info(`Reevaluation reminder: ${pendingResult.rows.length} solicitudes reminded to ${ntUsers.rows.length} NT users`);
    } catch (error) {
      logger.error('Failed to send reevaluation reminder:', error);
    }
  },

  /**
   * Manually trigger weekly report generation (for testing)
   */
  async triggerWeeklyReport() {
    logger.info('Manually triggering weekly report generation');
    await this.generateAndSendWeeklyReport();
  },

  /**
   * Manually trigger deadline check (for testing)
   */
  async triggerDeadlineCheck() {
    logger.info('Manually triggering deadline check');
    await notificationService.checkUpcomingDeadlines();
  }
};

module.exports = scheduler;
