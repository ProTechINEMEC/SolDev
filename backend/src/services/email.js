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
  // Generic send email (for custom emails like comunicacion)
  async sendEmail({ to, subject, html }) {
    return sendEmail(to, subject, baseTemplate(html));
  },

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
  },

  // IT Ticket created with full form data
  async sendTicketCreatedWithForm(email, nombre, codigo, formData) {
    const categoriaLabels = {
      hardware: 'Hardware',
      software: 'Software',
      red: 'Red',
      acceso: 'Acceso',
      soporte_general: 'Soporte General',
      otro: 'Otro'
    };

    const urgenciaLabels = {
      baja: 'Baja',
      media: 'Media',
      alta: 'Alta',
      critica: 'Crítica'
    };

    const solicitante = formData.datos_solicitante || {};
    const criticidad = solicitante.criticidad || formData.criticidad || {};

    const content = `
      <h2>Ticket de Soporte Creado</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu ticket de soporte ha sido registrado exitosamente.</p>

      <div class="code">${codigo}</div>

      <p style="text-align: center; color: #666; margin-bottom: 20px;">
        Use este código para consultar el estado de su ticket en la página de consultas.
      </p>

      <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Identificación del Solicitante</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Nombre Completo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${solicitante.nombre_completo || solicitante.nombre || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cargo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${solicitante.cargo || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Área:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${solicitante.area || solicitante.departamento || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Operación/Contrato:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${solicitante.operacion_contrato || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Correo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${solicitante.correo || solicitante.email || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Teléfono:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${solicitante.telefono || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cédula:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${solicitante.cedula || '--'}</td>
        </tr>
      </table>

      <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Reporte de la Situación</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Categoría:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${categoriaLabels[formData.categoria] || formData.categoria || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Título:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.titulo || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Descripción:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${formData.descripcion || '--'}</td>
        </tr>
      </table>

      <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Criticidad</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Urgencia:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${urgenciaLabels[criticidad.urgencia] || criticidad.urgencia || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Justificación:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${criticidad.justificacion || '--'}</td>
        </tr>
      </table>

      <p style="text-align: center; margin-top: 20px;">
        <a href="${config.frontendUrl}/consulta/${codigo}" class="button">Consultar Estado</a>
      </p>
    `;
    return sendEmail(email, `Ticket ${codigo} Creado - Portal INEMEC`, baseTemplate(content));
  },

  // NT Solicitud created with full form data
  async sendSolicitudCreatedWithForm(email, nombre, codigo, tipo, formData) {
    const tipoLabels = {
      proyecto_nuevo_interno: 'Proyecto Nuevo (Interno)',
      actualizacion: 'Actualización de Sistema',
      reporte_fallo: 'Reporte de Fallo/Error',
      cierre_servicio: 'Cierre de Servicio'
    };

    const urgenciaLabels = {
      baja: 'Baja',
      media: 'Media',
      alta: 'Alta',
      critica: 'Crítica'
    };

    let formSections = '';

    // Build form sections based on tipo
    if (tipo === 'reporte_fallo') {
      const identificacion = formData.identificacion || formData.datos_solicitante || {};
      const reporte = formData.reporte || formData.descripcion_problema || {};
      const criticidad = formData.criticidad || formData.necesidad_urgencia || {};

      formSections = `
        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Identificación del Solicitante</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Nombre Completo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.nombre_completo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cargo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.cargo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Área:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.area || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Operación/Contrato:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.operacion_contrato || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Correo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.correo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Teléfono:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.telefono || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cédula:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.cedula || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Reporte del Fallo</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Título:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.titulo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Descripción:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${reporte.descripcion || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Criticidad</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Urgencia:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${urgenciaLabels[criticidad.urgencia] || criticidad.urgencia || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Justificación:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${criticidad.justificacion || '--'}</td></tr>
        </table>
      `;
    } else if (tipo === 'cierre_servicio') {
      const identificacion = formData.identificacion || formData.datos_solicitante || {};
      const razonamiento = formData.razonamiento || formData.descripcion_problema || {};
      const responsables = formData.responsables || {};

      formSections = `
        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Identificación del Solicitante</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Nombre Completo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.nombre_completo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cargo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.cargo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Área:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.area || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Operación/Contrato:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.operacion_contrato || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Correo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.correo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Teléfono:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.telefono || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cédula:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.cedula || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Razonamiento</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Título:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.titulo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Razón de cierre:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${razonamiento.razon_cierre || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Impacto esperado:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${razonamiento.impacto_esperado || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Responsables</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Responsable del cierre:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${responsables.responsable_cierre || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Fecha propuesta:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${responsables.fecha_propuesta || '--'}</td></tr>
        </table>
      `;
    } else {
      // proyecto_nuevo_interno or actualizacion
      const identificacion = formData.identificacion || formData.datos_solicitante || {};
      const sponsor = formData.sponsor || formData.datos_patrocinador || {};
      const stakeholders = formData.stakeholders || formData.datos_stakeholders || {};
      const problematica = formData.problematica || formData.descripcion_problema || {};
      const urgencia = formData.urgencia || formData.necesidad_urgencia || {};
      const solucion = formData.solucion || formData.solucion_propuesta || {};
      const beneficios = formData.beneficios || {};
      const desempeno = formData.desempeno || {};

      formSections = `
        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Identificación del Solicitante</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Nombre Completo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.nombre_completo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cargo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.cargo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Área:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.area || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Operación/Contrato:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.operacion_contrato || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Correo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.correo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Teléfono:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.telefono || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cédula:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${identificacion.cedula || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Patrocinador</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Nombre:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${sponsor.nombre || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Cargo:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${sponsor.cargo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Área:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${sponsor.area || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Problemática</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Título:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${formData.titulo || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Situación Actual:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${problematica.situacion_actual || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Problema Identificado:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${problematica.problema_identificado || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Impacto Actual:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${problematica.impacto_actual || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Urgencia</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Nivel:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${urgenciaLabels[urgencia.nivel] || urgencia.nivel || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Justificación:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${urgencia.justificacion || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Solución Propuesta</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Descripción:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${solucion.descripcion || '--'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Alcance:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${solucion.alcance || '--'}</td></tr>
        </table>

        <h3 style="border-bottom: 2px solid #D52B1E; padding-bottom: 8px;">Beneficios Esperados</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9; width: 40%;"><strong>Beneficios:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${beneficios.descripcion || '--'}</td></tr>
        </table>
      `;
    }

    const content = `
      <h2>Solicitud Registrada</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu solicitud ha sido registrada exitosamente.</p>

      <div class="code">${codigo}</div>

      <p style="text-align: center; color: #666; margin-bottom: 20px;">
        Use este código para consultar el estado de su solicitud en la página de consultas.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: #fff7e6;">
        <tr>
          <td style="padding: 12px; border: 1px solid #fa8c16;">
            <strong>Tipo de Solicitud:</strong> ${tipoLabels[tipo] || tipo}
          </td>
        </tr>
      </table>

      ${formSections}

      <p style="text-align: center; margin-top: 20px;">
        <a href="${config.frontendUrl}/consulta/${codigo}" class="button">Consultar Estado</a>
      </p>
    `;
    return sendEmail(email, `Solicitud ${codigo} Registrada - Portal INEMEC`, baseTemplate(content));
  },

  // Transfer notification (IT to NT or NT to IT)
  async sendTransferNotification(email, nombre, codigoOrigen, codigoDestino, tipoTransferencia, motivo) {
    const isTicketToSolicitud = tipoTransferencia === 'ticket_a_solicitud';

    const content = `
      <h2>Transferencia de ${isTicketToSolicitud ? 'Ticket' : 'Solicitud'}</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu ${isTicketToSolicitud ? 'ticket' : 'solicitud'} ha sido transferido${isTicketToSolicitud ? '' : 'a'} al departamento de ${isTicketToSolicitud ? 'Nuevas Tecnologías' : 'Soporte Técnico (TI)'}.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Código anterior:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${codigoOrigen}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #fce8e6;"><strong>Nuevo código:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #D52B1E;">${codigoDestino}</td>
        </tr>
        ${motivo ? `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Motivo:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${motivo}</td>
        </tr>
        ` : ''}
      </table>

      <p style="background: #e6f7ff; padding: 15px; border-radius: 4px; border-left: 4px solid #1890ff;">
        <strong>Importante:</strong> Para futuras consultas sobre el estado de su ${isTicketToSolicitud ? 'solicitud' : 'ticket'},
        utilice el nuevo código <strong>${codigoDestino}</strong>.
      </p>

      <p style="text-align: center; margin-top: 20px;">
        <a href="${config.frontendUrl}/consulta/${codigoDestino}" class="button">Consultar Estado</a>
      </p>
    `;
    return sendEmail(email, `Transferencia: ${codigoOrigen} → ${codigoDestino} - Portal INEMEC`, baseTemplate(content));
  },

  // Ticket resolved/closed notification
  async sendTicketResolved(email, nombre, codigo, titulo, estado, resolucion) {
    const estadoLabels = {
      solucionado: 'Solucionado',
      cerrado: 'Cerrado',
      no_realizado: 'No Realizado'
    };

    const estadoClasses = {
      solucionado: 'status-aprobado',
      cerrado: 'status-aprobado',
      no_realizado: 'status-rechazado'
    };

    const content = `
      <h2>Ticket ${estadoLabels[estado] || estado}</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu ticket de soporte ha sido marcado como <strong>${estadoLabels[estado] || estado}</strong>.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Código:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${codigo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Título:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${titulo}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Estado:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">
            <span class="status ${estadoClasses[estado] || ''}">${estadoLabels[estado] || estado}</span>
          </td>
        </tr>
        ${resolucion ? `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Resolución:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd; white-space: pre-wrap;">${resolucion}</td>
        </tr>
        ` : ''}
      </table>

      <p style="text-align: center; margin-top: 20px;">
        <a href="${config.frontendUrl}/consulta/${codigo}" class="button">Ver Detalles</a>
      </p>
    `;
    return sendEmail(email, `Ticket ${codigo} ${estadoLabels[estado] || estado} - Portal INEMEC`, baseTemplate(content));
  }
};

module.exports = emailService;
