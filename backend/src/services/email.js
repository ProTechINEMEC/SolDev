const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

// Create transporter
const createTransporter = () => {
  if (!config.smtp.user || !config.smtp.pass) {
    logger.warn('SMTP credentials not configured, email sending disabled');
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    },
    // Office 365 specific settings
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });
};

let transporter = createTransporter();

// Base email template with INEMEC branding
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #D52B1E; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .code { font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 8px; padding: 20px; background: #fce8e6; border-radius: 8px; margin: 20px 0; color: #D52B1E; }
    .button { display: inline-block; padding: 12px 24px; background: #D52B1E; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .status { padding: 8px 16px; border-radius: 4px; display: inline-block; font-weight: bold; }
    .status-pendiente { background: #fff7e6; color: #fa8c16; }
    .status-aprobado { background: #f6ffed; color: #52c41a; }
    .status-rechazado { background: #fff1f0; color: #f5222d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Portal de Gestión INEMEC</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Este es un mensaje automático del Portal de Gestión de INEMEC S.A.</p>
      <p>Departamento de Nuevas Tecnologías</p>
      <p>Por favor no responda a este correo.</p>
    </div>
  </div>
</body>
</html>
`;

// Send email helper
const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    logger.warn(`Email not sent (no transporter): ${subject} to ${to}`);
    return false;
  }

  try {
    const fromName = config.smtp.fromName || 'Portal INEMEC';
    await transporter.sendMail({
      from: `"${fromName}" <${config.smtp.from}>`,
      to,
      subject,
      html
    });
    logger.info(`Email sent: ${subject} to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email: ${error.message}`);
    return false;
  }
};

// Email functions
const emailService = {
  // Send verification code
  async sendVerificationCode(email, nombre, codigo) {
    const content = `
      <h2>Verificación de Email</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Has solicitado verificar tu correo electrónico para enviar una solicitud en el Portal de Gestión de INEMEC.</p>
      <p>Tu código de verificación es:</p>
      <div class="code">${codigo}</div>
      <p>Este código expirará en <strong>15 minutos</strong>.</p>
      <p>Si no solicitaste este código, puedes ignorar este mensaje.</p>
    `;
    return sendEmail(email, 'Código de Verificación - Portal INEMEC', baseTemplate(content));
  },

  // Request received confirmation
  async sendRequestReceived(email, nombre, codigo, titulo, tipo) {
    const tipoLabels = {
      proyecto_nuevo_interno: 'Proyecto Nuevo (Interno)',
      proyecto_nuevo_externo: 'Proyecto Nuevo (Externo)',
      actualizacion: 'Actualización',
      reporte_fallo: 'Reporte de Fallo',
      cierre_servicio: 'Cierre de Servicio'
    };

    const content = `
      <h2>Solicitud Recibida</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu solicitud ha sido recibida y está pendiente de evaluación.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Código:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${codigo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Título:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${titulo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Tipo:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${tipoLabels[tipo] || tipo}</td>
        </tr>
      </table>
      <p>Puedes consultar el estado de tu solicitud usando el código <strong>${codigo}</strong> en el portal.</p>
      <a href="${config.frontendUrl}/consulta/${codigo}" class="button">Consultar Estado</a>
      <p>Te notificaremos cuando haya actualizaciones en tu solicitud.</p>
    `;
    return sendEmail(email, `Solicitud ${codigo} Recibida - Portal INEMEC`, baseTemplate(content));
  },

  // Status change notification
  async sendStatusChange(email, nombre, codigo, titulo, estadoAnterior, estadoNuevo, comentario = null) {
    const estadoLabels = {
      pendiente_evaluacion_nt: 'Pendiente de Evaluación',
      descartado_nt: 'Descartado',
      pendiente_aprobacion_gerencia: 'Pendiente de Aprobación',
      rechazado_gerencia: 'Rechazado por Gerencia',
      aprobado: 'Aprobado',
      en_desarrollo: 'En Desarrollo',
      stand_by: 'En Espera',
      completado: 'Completado',
      cancelado: 'Cancelado'
    };

    const estadoClasses = {
      aprobado: 'status-aprobado',
      en_desarrollo: 'status-aprobado',
      completado: 'status-aprobado',
      descartado_nt: 'status-rechazado',
      rechazado_gerencia: 'status-rechazado',
      cancelado: 'status-rechazado'
    };

    const content = `
      <h2>Actualización de Solicitud</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>El estado de tu solicitud <strong>${codigo}</strong> ha sido actualizado.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Título:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${titulo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Estado anterior:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${estadoLabels[estadoAnterior] || estadoAnterior}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Nuevo estado:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">
            <span class="status ${estadoClasses[estadoNuevo] || 'status-pendiente'}">
              ${estadoLabels[estadoNuevo] || estadoNuevo}
            </span>
          </td>
        </tr>
        ${comentario ? `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Comentario:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${comentario}</td>
        </tr>
        ` : ''}
      </table>
      <a href="${config.frontendUrl}/consulta/${codigo}" class="button">Ver Detalles</a>
    `;
    return sendEmail(email, `Solicitud ${codigo} - ${estadoLabels[estadoNuevo]}`, baseTemplate(content));
  },

  // Approval request to Gerencia
  async sendApprovalRequest(email, nombre, codigo, titulo, solicitanteNombre, departamento) {
    const content = `
      <h2>Solicitud Pendiente de Aprobación</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Una nueva solicitud requiere su aprobación.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Código:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${codigo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Título:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${titulo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Solicitante:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${solicitanteNombre}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Departamento:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${departamento || 'No especificado'}</td>
        </tr>
      </table>
      <p>Por favor revise la solicitud y tome una decisión.</p>
      <a href="${config.frontendUrl}/gerencia/aprobaciones/${codigo}" class="button">Revisar Solicitud</a>
    `;
    return sendEmail(email, `Aprobación Requerida: ${codigo} - Portal INEMEC`, baseTemplate(content));
  },

  // Weekly report
  async sendWeeklyReport(email, nombre, reporteData) {
    const content = `
      <h2>Reporte Semanal</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Este es el resumen semanal de actividades del Portal de Gestión.</p>

      <h3>Solicitudes</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Nuevas</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.solicitudes?.nuevas || 0}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Aprobadas</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.solicitudes?.aprobadas || 0}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Pendientes Evaluación</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.solicitudes?.pendientes_evaluacion || 0}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Pendientes Aprobación</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.solicitudes?.pendientes_aprobacion || 0}</td>
        </tr>
      </table>

      <h3>Proyectos</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Activos</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.proyectos?.activos || 0}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Completados esta semana</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.proyectos?.completados_semana || 0}</td>
        </tr>
      </table>

      <h3>Tickets</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Nuevos</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.tickets?.nuevos || 0}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Resueltos</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.tickets?.resueltos || 0}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Abiertos</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${reporteData.tickets?.abiertos || 0}</td>
        </tr>
      </table>

      <a href="${config.frontendUrl}/reportes" class="button">Ver Reporte Completo</a>
    `;
    return sendEmail(email, 'Reporte Semanal - Portal INEMEC', baseTemplate(content));
  },

  // Ticket created notification
  async sendTicketCreated(email, nombre, codigo, titulo, categoria) {
    const content = `
      <h2>Ticket de Soporte Creado</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu ticket de soporte ha sido creado exitosamente.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Código:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${codigo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Título:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${titulo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Categoría:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${categoria}</td>
        </tr>
      </table>
      <p>El equipo de TI revisará tu solicitud a la brevedad.</p>
      <a href="${config.frontendUrl}/tickets/consulta/${codigo}" class="button">Consultar Estado</a>
    `;
    return sendEmail(email, `Ticket ${codigo} Creado - Portal INEMEC`, baseTemplate(content));
  },

  // Password reset notification
  async sendPasswordReset(email, nombre, resetUrl) {
    const content = `
      <h2>Restablecer Contrasena</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Hemos recibido una solicitud para restablecer la contrasena de su cuenta en el Portal de Gestion de INEMEC.</p>
      <p>Haga clic en el siguiente enlace para crear una nueva contrasena:</p>
      <a href="${resetUrl}" class="button">Restablecer Contrasena</a>
      <p style="margin-top: 20px;">Este enlace expirara en <strong>1 hora</strong>.</p>
      <p>Si no solicito este cambio, puede ignorar este mensaje. Su contrasena permanecera sin cambios.</p>
      <p style="font-size: 12px; color: #666; margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
        <strong>Nota de seguridad:</strong> Por su seguridad, no comparta este enlace con nadie.
        Si cree que alguien mas solicito este cambio, por favor contacte al administrador del sistema.
      </p>
    `;
    return sendEmail(email, 'Restablecer Contrasena - Portal INEMEC', baseTemplate(content));
  }
};

module.exports = emailService;
