/**
 * PDF Generation Service
 * Corporate PDF reports for INEMEC SolDev Portal
 */

const PDFDocument = require('pdfkit');
const { pool } = require('../config/database');
const dayjs = require('dayjs');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// INEMEC Brand Colors
const COLORS = {
  primary: '#D52B1E',      // INEMEC Red (for accents)
  headerBg: '#1a1a1a',     // Dark header background
  secondary: '#333333',    // Dark gray for text
  lightGray: '#F8F8F8',    // Light background
  mediumGray: '#E0E0E0',   // Border gray
  white: '#FFFFFF',
  black: '#000000'
};

// Logo path
const LOGO_PATH = path.join(__dirname, '../assets/inemec-logo.png');

// Spanish labels
const estadoLabels = {
  pendiente_evaluacion_nt: 'Pendiente Evaluación NT',
  pendiente_aprobacion_gerencia: 'Pendiente Aprobación Gerencia',
  aprobado: 'Aprobado',
  rechazado_gerencia: 'Rechazado por Gerencia',
  descartado_nt: 'Descartado por NT',
  en_desarrollo: 'En Desarrollo',
  completado: 'Completado',
  cancelado: 'Cancelado',
  en_estudio: 'En Estudio',
  pendiente_reevaluacion: 'Pendiente Reevaluación',
  agendado: 'Agendado'
};

const tipoLabels = {
  proyecto_nuevo_interno: 'Proyecto Nuevo Interno',
  proyecto_nuevo_externo: 'Proyecto Nuevo Externo',
  actualizacion: 'Actualización',
  reporte_fallo: 'Reporte de Fallo',
  cierre_servicio: 'Cierre de Servicio'
};

const ticketEstadoLabels = {
  abierto: 'Abierto',
  en_proceso: 'En Proceso',
  solucionado: 'Solucionado',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  no_realizado: 'No Realizado',
  transferido_nt: 'Transferido a NT',
  escalado_nt: 'Escalado a NT'
};

const categoriaLabels = {
  hardware: 'Hardware',
  software: 'Software',
  red: 'Red',
  acceso: 'Acceso',
  soporte_general: 'Soporte General',
  otro: 'Otro'
};

const prioridadLabels = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja'
};

/**
 * Helper class for corporate PDF styling - Two Column Layout
 */
class CorporatePDF {
  constructor(doc) {
    this.doc = doc;
    this.pageWidth = 595.28;  // A4 width in points
    this.pageHeight = 841.89; // A4 height in points
    this.margin = 40;         // Reduced margin
    this.contentWidth = this.pageWidth - (this.margin * 2);
    this.columnGap = 15;      // Gap between columns
    this.columnWidth = (this.contentWidth - this.columnGap) / 2;
    this.currentColumn = 0;   // 0 = left, 1 = right
    this.columnY = [58, 58];  // Track Y position for each column
  }

  // Get X position for current column
  getColumnX(col = this.currentColumn) {
    return col === 0 ? this.margin : this.margin + this.columnWidth + this.columnGap;
  }

  // Switch to next column or new page
  nextColumn() {
    if (this.currentColumn === 0) {
      this.currentColumn = 1;
      this.doc.y = this.columnY[1];
    } else {
      this.currentColumn = 0;
      this.doc.addPage();
      this.columnY = [this.margin, this.margin];
      this.doc.y = this.margin;
    }
  }

  // Reset to two column mode
  resetColumns() {
    this.currentColumn = 0;
    this.columnY = [this.doc.y, this.doc.y];
  }

  // Draw corporate header with logo - compact
  drawHeader(title, subtitle = null) {
    const doc = this.doc;

    // Header background - black, compact
    doc.rect(0, 0, this.pageWidth, 50).fill(COLORS.headerBg);

    // Logo (if exists)
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, this.margin, 8, { height: 34 });
    } else {
      doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.white)
        .text('INEMEC', this.margin, 18);
    }

    // Title and subtitle on the right
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.white)
      .text(title + (subtitle ? ' - ' + subtitle : ''), this.margin + 100, 18, {
        width: this.contentWidth - 100,
        align: 'right'
      });

    doc.y = 58;
    this.columnY = [58, 58];
    doc.fillColor(COLORS.secondary);
  }

  // Draw a badge with auto-sizing
  drawBadge(text, color, x, y) {
    const doc = this.doc;
    doc.fontSize(7).font('Helvetica-Bold');
    const textWidth = doc.widthOfString(text);
    const badgeWidth = textWidth + 10;
    const badgeHeight = 14;

    doc.rect(x, y, badgeWidth, badgeHeight).fill(color);
    doc.fillColor(COLORS.white).text(text, x + 5, y + 3, { width: textWidth + 2 });
    doc.fillColor(COLORS.secondary);

    return badgeWidth + 5; // Return width + gap for next badge
  }

  // Draw section header - minimal (full width)
  drawSectionHeader(title, fullWidth = false) {
    const doc = this.doc;
    const x = fullWidth ? this.margin : this.getColumnX();
    const width = fullWidth ? this.contentWidth : this.columnWidth;

    doc.moveDown(0.2);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(title, x, doc.y, { width });
    doc.moveDown(0.1);
    doc.fillColor(COLORS.secondary);

    if (!fullWidth) {
      this.columnY[this.currentColumn] = doc.y;
    }
  }

  // Draw section header spanning both columns
  drawSectionHeaderFull(title) {
    this.drawSectionHeader(title, true);
    this.columnY = [this.doc.y, this.doc.y];
  }

  // Draw a data row in current column
  drawDataRow(label, value, options = {}) {
    const doc = this.doc;
    const { fullWidth = false } = options;

    const x = fullWidth ? this.margin : this.getColumnX();
    const width = fullWidth ? this.contentWidth : this.columnWidth;
    const labelWidth = fullWidth ? 120 : 70;

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555')
      .text(label + ':', x, doc.y, { continued: true, width: labelWidth });

    doc.font('Helvetica').fillColor(COLORS.secondary)
      .text(' ' + (value || 'N/A'), { width: width - labelWidth });

    if (!fullWidth) {
      this.columnY[this.currentColumn] = doc.y;
    }
  }

  // Draw a data row spanning full width
  drawDataRowFull(label, value) {
    this.drawDataRow(label, value, { fullWidth: true });
    this.columnY = [this.doc.y, this.doc.y];
  }

  // Draw info box - minimal, no background
  drawInfoBox(content, fullWidth = false) {
    const doc = this.doc;
    const x = fullWidth ? this.margin : this.getColumnX();
    const width = fullWidth ? this.contentWidth : this.columnWidth;

    doc.fontSize(8).font('Helvetica').fillColor(COLORS.secondary)
      .text(content, x, doc.y, { width });
    doc.moveDown(0.2);

    if (!fullWidth) {
      this.columnY[this.currentColumn] = doc.y;
    } else {
      this.columnY = [doc.y, doc.y];
    }
  }

  // Draw a simple table - compact (always full width)
  drawTable(headers, rows, options = {}) {
    const doc = this.doc;
    const { columnWidths = [] } = options;

    const startX = this.margin;
    let startY = doc.y;
    const rowHeight = 16;
    const headerHeight = 18;

    const colWidths = columnWidths.length ? columnWidths :
      headers.map(() => this.contentWidth / headers.length);

    // Check if we need a new page
    if (startY + headerHeight + (rows.length * rowHeight) > this.pageHeight - 50) {
      doc.addPage();
      startY = this.margin;
      doc.y = startY;
    }

    // Header row
    doc.rect(startX, startY, this.contentWidth, headerHeight).fill(COLORS.headerBg);

    let xPos = startX;
    headers.forEach((header, i) => {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.white)
        .text(header, xPos + 3, startY + 4, { width: colWidths[i] - 6 });
      xPos += colWidths[i];
    });

    startY += headerHeight;

    // Data rows
    rows.forEach((row, rowIndex) => {
      const bgColor = rowIndex % 2 === 0 ? COLORS.white : COLORS.lightGray;
      doc.rect(startX, startY, this.contentWidth, rowHeight).fill(bgColor);

      xPos = startX;
      row.forEach((cell, i) => {
        doc.fontSize(7).font('Helvetica').fillColor(COLORS.secondary)
          .text(cell || '', xPos + 3, startY + 3, {
            width: colWidths[i] - 6,
            height: rowHeight - 4,
            ellipsis: true
          });
        xPos += colWidths[i];
      });

      startY += rowHeight;
    });

    doc.rect(startX, doc.y, this.contentWidth, startY - doc.y)
      .strokeColor(COLORS.mediumGray).stroke();

    doc.y = startY + 5;
    this.columnY = [doc.y, doc.y];
    doc.fillColor(COLORS.secondary);
  }

  // Draw footer - minimal
  drawFooter(pageNum, totalPages) {
    const doc = this.doc;
    const footerY = this.pageHeight - 20;
    doc.fontSize(6).font('Helvetica').fillColor('#aaaaaa');
    doc.text(`INEMEC S.A. | Confidencial | ${pageNum}/${totalPages}`, 0, footerY, {
      width: this.pageWidth,
      align: 'center'
    });
  }

  // Check page break and handle columns
  checkPageBreak(neededSpace = 40) {
    if (this.doc.y > this.pageHeight - neededSpace) {
      this.doc.addPage();
      this.doc.y = this.margin;
      this.columnY = [this.margin, this.margin];
      this.currentColumn = 0;
    }
  }

  // Start left column content
  startLeftColumn() {
    this.currentColumn = 0;
    this.doc.y = this.columnY[0];
  }

  // Start right column content
  startRightColumn() {
    this.currentColumn = 1;
    this.doc.y = this.columnY[1];
  }

  // Sync both columns to the same Y position (max of both)
  syncColumns() {
    const maxY = Math.max(this.columnY[0], this.columnY[1]);
    this.columnY = [maxY, maxY];
    this.doc.y = maxY;
  }
}

const pdfService = {
  /**
   * Generate corporate PDF for a ticket
   */
  async generateTicketPDF(ticketId) {
    const result = await pool.query(`
      SELECT t.*,
             sol.nombre as solicitante_nombre,
             sol.email as solicitante_email,
             u.nombre as asignado_nombre,
             u.email as asignado_email
      FROM tickets t
      LEFT JOIN solicitantes sol ON t.solicitante_id = sol.id
      LEFT JOIN usuarios u ON t.asignado_id = u.id
      WHERE t.id = $1
    `, [ticketId]);

    if (result.rows.length === 0) {
      throw new Error('Ticket no encontrado');
    }

    const ticket = result.rows[0];
    const datosSol = ticket.datos_solicitante || {};

    // Get comments/history
    const historialResult = await pool.query(`
      SELECT c.id, c.contenido, c.tipo, c.interno, c.creado_en,
             u.nombre as usuario_nombre
      FROM comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.entidad_tipo = 'ticket' AND c.entidad_id = $1
      ORDER BY c.creado_en ASC
    `, [ticketId]);

    // Check for transfer
    const transferenciaResult = await pool.query(`
      SELECT tr.*, s.codigo as destino_codigo
      FROM transferencias tr
      LEFT JOIN solicitudes s ON tr.destino_id = s.id AND tr.destino_tipo = 'solicitud'
      WHERE tr.origen_tipo = 'ticket' AND tr.origen_id = $1
    `, [ticketId]);

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pdf = new CorporatePDF(doc);

    // Header
    pdf.drawHeader('TICKET DE SOPORTE', ticket.codigo);

    // Title
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.secondary)
      .text(ticket.titulo, pdf.margin, doc.y, { width: pdf.contentWidth });

    // Status badges - auto-sized
    const badgeY = doc.y + 2;
    let badgeX = pdf.margin;

    const prioColor = ticket.prioridad === 'critica' ? '#D32F2F' :
                      ticket.prioridad === 'alta' ? '#F57C00' :
                      ticket.prioridad === 'media' ? '#0288D1' : '#388E3C';

    badgeX += pdf.drawBadge(ticketEstadoLabels[ticket.estado] || ticket.estado, COLORS.primary, badgeX, badgeY);
    badgeX += pdf.drawBadge(prioridadLabels[ticket.prioridad] || ticket.prioridad, prioColor, badgeX, badgeY);
    badgeX += pdf.drawBadge(categoriaLabels[ticket.categoria] || ticket.categoria, '#607D8B', badgeX, badgeY);

    doc.y = badgeY + 18;
    pdf.resetColumns();

    // LEFT COLUMN - Ticket Info
    pdf.startLeftColumn();
    pdf.drawSectionHeader('INFORMACIÓN');
    pdf.drawDataRow('Código', ticket.codigo);
    pdf.drawDataRow('Creado', dayjs(ticket.creado_en).format('DD/MM/YYYY HH:mm'));
    pdf.drawDataRow('Asignado', ticket.asignado_nombre || 'Sin asignar');

    // RIGHT COLUMN - Solicitante Info
    pdf.startRightColumn();
    pdf.drawSectionHeader('SOLICITANTE');
    pdf.drawDataRow('Nombre', datosSol.nombre_completo || datosSol.nombre || ticket.solicitante_nombre);
    pdf.drawDataRow('Correo', datosSol.correo || datosSol.email || ticket.solicitante_email);
    if (datosSol.telefono) pdf.drawDataRow('Teléfono', datosSol.telefono);
    if (datosSol.cargo) pdf.drawDataRow('Cargo', datosSol.cargo);

    // Sync and continue with more solicitante data in left column if needed
    pdf.syncColumns();

    // Additional solicitante info in two columns
    if (datosSol.area || datosSol.departamento || datosSol.operacion_contrato || datosSol.cedula || datosSol.es_doliente !== undefined) {
      pdf.startLeftColumn();
      if (datosSol.area || datosSol.departamento) pdf.drawDataRow('Área', datosSol.area || datosSol.departamento);
      if (datosSol.cedula) pdf.drawDataRow('Cédula', datosSol.cedula);

      pdf.startRightColumn();
      if (datosSol.operacion_contrato) pdf.drawDataRow('Operación', datosSol.operacion_contrato);
      if (datosSol.es_doliente !== undefined) pdf.drawDataRow('Afectado', datosSol.es_doliente ? 'Sí' : 'No');

      pdf.syncColumns();
    }

    // Criticidad if exists
    if (datosSol.criticidad) {
      pdf.startLeftColumn();
      pdf.drawDataRow('Urgencia', prioridadLabels[datosSol.criticidad.urgencia] || datosSol.criticidad.urgencia);
      if (datosSol.criticidad.justificacion) {
        pdf.startRightColumn();
        pdf.drawDataRow('Justific.', datosSol.criticidad.justificacion);
      }
      pdf.syncColumns();
    }

    // Descripción section - full width
    pdf.drawSectionHeaderFull('DESCRIPCIÓN');
    pdf.drawInfoBox(ticket.descripcion || 'Sin descripción', true);

    // Resolución section - full width (if exists)
    if (ticket.resolucion) {
      pdf.drawSectionHeaderFull('RESOLUCIÓN');
      pdf.drawInfoBox(ticket.resolucion, true);
    }

    // Transfer info (if exists)
    if (transferenciaResult.rows.length > 0) {
      const transferencia = transferenciaResult.rows[0];
      pdf.drawDataRowFull('Transferido a', 'NT - ' + (transferencia.destino_codigo || 'N/A'));
    }

    // Historial section - full width, only if there are comments
    if (historialResult.rows.length > 0) {
      pdf.drawSectionHeaderFull('HISTORIAL');
      historialResult.rows.forEach(h => {
        doc.fontSize(7).font('Helvetica').fillColor('#555555')
          .text(`${dayjs(h.creado_en).format('DD/MM/YY HH:mm')} - ${h.usuario_nombre || 'Sistema'}: ${h.contenido}`,
            pdf.margin, doc.y, { width: pdf.contentWidth });
      });
    }

    // Finalize pages and add footers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      pdf.drawFooter(i + 1, pages.count);
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  },

  /**
   * Generate corporate PDF for a solicitud - compact layout
   */
  async generateSolicitudPDF(solicitudId) {
    const result = await pool.query(`
      SELECT s.*,
             sol.nombre as solicitante_nombre,
             sol.email as solicitante_email,
             u.nombre as evaluador_nombre
      FROM solicitudes s
      LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
      LEFT JOIN usuarios u ON s.evaluador_id = u.id
      WHERE s.id = $1
    `, [solicitudId]);

    if (result.rows.length === 0) {
      throw new Error('Solicitud no encontrada');
    }

    const solicitud = result.rows[0];
    const datosSol = solicitud.datos_solicitante || {};
    const sponsor = solicitud.datos_patrocinador || {};
    const stakeholders = solicitud.datos_stakeholders || {};
    const problematica = solicitud.descripcion_problema || {};
    const urgencia = solicitud.necesidad_urgencia || {};
    const solucion = solicitud.solucion_propuesta || {};
    const beneficios = solicitud.beneficios || {};
    const kpis = solicitud.kpis || [];

    // Get comments
    const comentariosResult = await pool.query(`
      SELECT c.id, c.contenido, c.tipo, c.creado_en,
             u.nombre as usuario_nombre
      FROM comentarios c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.entidad_tipo = 'solicitud' AND c.entidad_id = $1
      ORDER BY c.creado_en ASC
    `, [solicitudId]);

    // Check for transfer
    const transferenciaResult = await pool.query(`
      SELECT tr.*, t.codigo as destino_codigo
      FROM transferencias tr
      LEFT JOIN tickets t ON tr.destino_id = t.id AND tr.destino_tipo = 'ticket'
      WHERE tr.origen_tipo = 'solicitud' AND tr.origen_id = $1
    `, [solicitudId]);

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pdf = new CorporatePDF(doc);

    // Header
    pdf.drawHeader('SOLICITUD NT', solicitud.codigo);

    // Title
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.secondary)
      .text(solicitud.titulo, pdf.margin, doc.y, { width: pdf.contentWidth });

    // Status badges - auto-sized
    const badgeY = doc.y + 2;
    let badgeX = pdf.margin;

    const prioColor = solicitud.prioridad === 'critica' ? '#D32F2F' :
                      solicitud.prioridad === 'alta' ? '#F57C00' :
                      solicitud.prioridad === 'media' ? '#0288D1' : '#388E3C';

    badgeX += pdf.drawBadge(tipoLabels[solicitud.tipo] || solicitud.tipo, '#607D8B', badgeX, badgeY);
    badgeX += pdf.drawBadge(estadoLabels[solicitud.estado] || solicitud.estado, COLORS.primary, badgeX, badgeY);
    if (solicitud.prioridad) {
      badgeX += pdf.drawBadge(prioridadLabels[solicitud.prioridad] || solicitud.prioridad, prioColor, badgeX, badgeY);
    }

    doc.y = badgeY + 18;
    pdf.resetColumns();

    // LEFT COLUMN - Basic info
    pdf.startLeftColumn();
    pdf.drawSectionHeader('INFORMACIÓN');
    pdf.drawDataRow('Código', solicitud.codigo);
    pdf.drawDataRow('Creado', dayjs(solicitud.creado_en).format('DD/MM/YYYY HH:mm'));
    if (solicitud.evaluador_nombre) {
      pdf.drawDataRow('Evaluador', solicitud.evaluador_nombre);
    }

    // RIGHT COLUMN - Solicitante
    pdf.startRightColumn();
    pdf.drawSectionHeader('SOLICITANTE');
    pdf.drawDataRow('Nombre', datosSol.nombre_completo || datosSol.nombre || solicitud.solicitante_nombre);
    pdf.drawDataRow('Correo', datosSol.correo || datosSol.email || solicitud.solicitante_email);
    if (datosSol.telefono) pdf.drawDataRow('Teléfono', datosSol.telefono);
    if (datosSol.cargo) pdf.drawDataRow('Cargo', datosSol.cargo);

    pdf.syncColumns();

    // Additional solicitante info in two columns
    if (datosSol.area || datosSol.departamento || datosSol.operacion_contrato || datosSol.cedula || datosSol.es_doliente !== undefined) {
      pdf.startLeftColumn();
      if (datosSol.area || datosSol.departamento) pdf.drawDataRow('Área', datosSol.area || datosSol.departamento);
      if (datosSol.cedula) pdf.drawDataRow('Cédula', datosSol.cedula);

      pdf.startRightColumn();
      if (datosSol.operacion_contrato) pdf.drawDataRow('Operación', datosSol.operacion_contrato);
      if (datosSol.es_doliente !== undefined) pdf.drawDataRow('Doliente', datosSol.es_doliente ? 'Sí' : 'No');

      pdf.syncColumns();
    }

    // Type-specific content
    const tipo = solicitud.tipo;

    if (tipo === 'reporte_fallo') {
      // Reporte de fallo - full width description
      pdf.drawSectionHeaderFull('DESCRIPCIÓN DEL FALLO');
      const desc = problematica.descripcion || problematica.situacion_actual || problematica.problema_actual;
      if (desc) {
        pdf.drawInfoBox(desc, true);
      }

      if (urgencia.urgencia || urgencia.nivel) {
        pdf.startLeftColumn();
        pdf.drawSectionHeader('CRITICIDAD');
        pdf.drawDataRow('Nivel', (urgencia.urgencia || urgencia.nivel || '').toUpperCase());

        pdf.startRightColumn();
        if (urgencia.justificacion || urgencia.justificacion_nt) {
          pdf.drawSectionHeader('JUSTIFICACIÓN');
          pdf.drawInfoBox(urgencia.justificacion || urgencia.justificacion_nt);
        }
        pdf.syncColumns();
      }

    } else if (tipo === 'cierre_servicio') {
      // Cierre de servicio - full width
      pdf.drawSectionHeaderFull('RAZONAMIENTO');
      const desc = problematica.descripcion || problematica.situacion_actual;
      if (desc) {
        pdf.drawInfoBox(desc, true);
      }

      if (stakeholders.responsable_nombre) {
        pdf.startLeftColumn();
        pdf.drawSectionHeader('RESPONSABLE');
        pdf.drawDataRow('Nombre', stakeholders.responsable_nombre);
        if (stakeholders.responsable_cargo) pdf.drawDataRow('Cargo', stakeholders.responsable_cargo);

        pdf.startRightColumn();
        if (stakeholders.veedores?.length > 0) {
          pdf.drawSectionHeader('VEEDORES');
          stakeholders.veedores.forEach(v => {
            pdf.drawDataRow(v.nombre, v.cargo || '-');
          });
        }
        pdf.syncColumns();
      }

    } else {
      // proyecto_nuevo_interno / actualizacion

      // Sponsor in left, Stakeholders in right
      if (sponsor.nombre_completo) {
        pdf.startLeftColumn();
        pdf.drawSectionHeader('SPONSOR');
        pdf.drawDataRow('Nombre', sponsor.nombre_completo || sponsor.nombre);
        if (sponsor.cargo) pdf.drawDataRow('Cargo', sponsor.cargo);
        if (sponsor.correo) pdf.drawDataRow('Correo', sponsor.correo);
      }

      const internas = stakeholders.internas || {};
      const externas = stakeholders.externas || {};
      if (internas.areas?.length > 0 || internas.personas?.length > 0) {
        pdf.startRightColumn();
        pdf.drawSectionHeader('PARTES INTERESADAS');
        if (internas.areas?.length > 0) pdf.drawDataRow('Áreas', internas.areas.join(', '));
        if (internas.personas?.length > 0) pdf.drawDataRow('Personas', internas.personas.join(', '));
      }
      pdf.syncColumns();

      // External stakeholders if applicable
      if (stakeholders.aplica_externas && (externas.sectores?.length > 0 || externas.empresas?.length > 0)) {
        pdf.startLeftColumn();
        if (externas.sectores?.length > 0) pdf.drawDataRow('Sectores', externas.sectores.join(', '));
        if (externas.empresas?.length > 0) pdf.drawDataRow('Empresas', externas.empresas.join(', '));

        pdf.startRightColumn();
        if (externas.proveedores?.length > 0) pdf.drawDataRow('Proveedores', externas.proveedores.join(', '));
        pdf.syncColumns();
      }

      // Problemática - full width for long text
      if (problematica.situacion_actual || problematica.problema_actual) {
        pdf.drawSectionHeaderFull('PROBLEMÁTICA');
        pdf.drawDataRowFull('Situación', problematica.situacion_actual || problematica.problema_actual);

        pdf.startLeftColumn();
        if (problematica.origen) pdf.drawDataRow('Origen', problematica.origen);
        if (problematica.desde_cuando) pdf.drawDataRow('Desde', dayjs(problematica.desde_cuando).format('DD/MM/YYYY'));
        if (problematica.impacto_nivel) pdf.drawDataRow('Impacto', (problematica.impacto_nivel || '').toUpperCase());

        pdf.startRightColumn();
        if (problematica.afectacion_operacion) pdf.drawDataRow('Afectación', problematica.afectacion_operacion);
        if (problematica.procesos_comprometidos) pdf.drawDataRow('Procesos', problematica.procesos_comprometidos);
        pdf.syncColumns();
      }

      // Urgencia - two columns
      if (urgencia.necesidad_principal || urgencia.nivel) {
        pdf.startLeftColumn();
        pdf.drawSectionHeader('URGENCIA');
        if (urgencia.nivel) pdf.drawDataRow('Nivel', (urgencia.nivel || '').replace(/_/g, ' ').toUpperCase());
        if (urgencia.fecha_limite) pdf.drawDataRow('Fecha límite', dayjs(urgencia.fecha_limite).format('DD/MM/YYYY'));

        pdf.startRightColumn();
        pdf.drawSectionHeader('NECESIDAD');
        if (urgencia.necesidad_principal) pdf.drawDataRow('Principal', urgencia.necesidad_principal);
        if (urgencia.justificacion_nt || urgencia.justificacion) {
          pdf.drawDataRow('¿Por qué NT?', urgencia.justificacion_nt || urgencia.justificacion);
        }
        pdf.syncColumns();
      }

      // Solución - two columns
      if (solucion.tipo_solucion || solucion.solucion_ideal) {
        pdf.drawSectionHeaderFull('SOLUCIÓN PROPUESTA');
        pdf.startLeftColumn();
        if (solucion.tipo_solucion) {
          pdf.drawDataRow('Tipo', solucion.tipo_solucion + (solucion.tipo_solucion_otro ? ' - ' + solucion.tipo_solucion_otro : ''));
        }
        if (solucion.forma_entrega) pdf.drawDataRow('Entrega', solucion.forma_entrega);
        if (solucion.funcionalidades_minimas?.length > 0) {
          pdf.drawDataRow('Func. mín.', solucion.funcionalidades_minimas.join('; '));
        }

        pdf.startRightColumn();
        if (solucion.solucion_ideal) pdf.drawDataRow('Ideal', solucion.solucion_ideal);
        if (solucion.casos_uso) pdf.drawDataRow('Casos uso', solucion.casos_uso);
        if (solucion.funcionalidades_deseables?.length > 0) {
          pdf.drawDataRow('Func. des.', solucion.funcionalidades_deseables.join('; '));
        }
        pdf.syncColumns();
      }

      // Beneficios - two columns
      if (beneficios.descripcion || beneficios.mejora_concreta) {
        pdf.startLeftColumn();
        pdf.drawSectionHeader('BENEFICIOS');
        if (beneficios.descripcion) pdf.drawDataRow('Descripción', beneficios.descripcion);
        if (beneficios.procesos_optimizados?.length > 0) {
          pdf.drawDataRow('Procesos', beneficios.procesos_optimizados.join(', '));
        }

        pdf.startRightColumn();
        pdf.drawSectionHeader('MEJORAS');
        if (beneficios.mejora_concreta) pdf.drawDataRow('Mejora', beneficios.mejora_concreta);
        if (beneficios.reduccion_costos) {
          pdf.drawDataRow('Costos', beneficios.reduccion_costos_descripcion || 'Reducción esperada');
        }
        pdf.syncColumns();
      }

      // KPIs - two columns
      if (kpis.length > 0) {
        pdf.drawSectionHeaderFull('INDICADORES');
        kpis.forEach((kpi, i) => {
          if (i % 2 === 0) pdf.startLeftColumn();
          else pdf.startRightColumn();
          pdf.drawDataRow(kpi.nombre, `${kpi.valor_actual || '-'} → ${kpi.valor_objetivo || '-'} (${kpi.unidad || '-'})`);
        });
        pdf.syncColumns();
      }
    }

    // Transfer info - full width
    if (transferenciaResult.rows.length > 0 && solicitud.estado === 'transferido_ti') {
      const transferencia = transferenciaResult.rows[0];
      pdf.drawSectionHeaderFull('TRANSFERENCIA');
      pdf.drawDataRowFull('Transferido a', 'TI - ' + (transferencia.destino_codigo || 'N/A'));
    }

    // Historial - full width, only if there are comments
    if (comentariosResult.rows.length > 0) {
      pdf.drawSectionHeaderFull('HISTORIAL');
      comentariosResult.rows.forEach(h => {
        doc.fontSize(7).font('Helvetica').fillColor('#555555')
          .text(`${dayjs(h.creado_en).format('DD/MM/YY HH:mm')} - ${h.usuario_nombre || 'Sistema'}: ${h.contenido}`,
            pdf.margin, doc.y, { width: pdf.contentWidth });
      });
    }

    // Finalize pages and add footers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      pdf.drawFooter(i + 1, pages.count);
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  },

  /**
   * Generate PDF for an NT evaluation
   */
  async generateEvaluacionPDF(evaluacionId) {
    const result = await pool.query(`
      SELECT e.*,
             s.codigo as solicitud_codigo,
             s.titulo as solicitud_titulo,
             s.tipo as solicitud_tipo,
             s.estado as solicitud_estado,
             sol.nombre as solicitante_nombre,
             sol.email as solicitante_email,
             u.nombre as evaluador_nombre
      FROM evaluaciones_nt e
      JOIN solicitudes s ON e.solicitud_id = s.id
      LEFT JOIN solicitantes sol ON s.solicitante_id = sol.id
      LEFT JOIN usuarios u ON e.evaluador_id = u.id
      WHERE e.id = $1
    `, [evaluacionId]);

    if (result.rows.length === 0) {
      throw new Error('Evaluación no encontrada');
    }

    const evaluacion = result.rows[0];

    // Get cronograma
    const cronogramaResult = await pool.query(`
      SELECT ct.*
      FROM cronogramas c
      LEFT JOIN cronograma_tareas ct ON ct.cronograma_id = c.id
      WHERE c.evaluacion_id = $1
      ORDER BY ct.fecha_inicio
    `, [evaluacionId]);

    // Get cost estimation
    const costosResult = await pool.query(`
      SELECT * FROM estimaciones_costo WHERE evaluacion_id = $1
    `, [evaluacionId]);

    // Get team
    const equipoResult = await pool.query(`
      SELECT ea.*, u.nombre, u.email, u.cargo
      FROM evaluacion_asignaciones ea
      JOIN usuarios u ON ea.usuario_id = u.id
      WHERE ea.evaluacion_id = $1
    `, [evaluacionId]);

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pdf = new CorporatePDF(doc);

    // Header
    pdf.drawHeader('EVALUACIÓN TÉCNICA', evaluacion.solicitud_codigo);

    // Title
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.secondary)
      .text(evaluacion.solicitud_titulo, pdf.margin, doc.y, { width: pdf.contentWidth });

    // Badges - auto-sized
    const badgeY = doc.y + 2;
    let badgeX = pdf.margin;

    const recomColor = evaluacion.recomendacion === 'aprobar' ? '#388E3C' :
                       evaluacion.recomendacion === 'rechazar' ? '#D32F2F' : '#FF9800';

    badgeX += pdf.drawBadge(tipoLabels[evaluacion.solicitud_tipo] || evaluacion.solicitud_tipo, '#607D8B', badgeX, badgeY);
    badgeX += pdf.drawBadge((evaluacion.recomendacion || 'Pendiente').toUpperCase(), recomColor, badgeX, badgeY);

    doc.y = badgeY + 18;
    pdf.resetColumns();

    // LEFT COLUMN - Solicitud Info
    pdf.startLeftColumn();
    pdf.drawSectionHeader('SOLICITUD');
    pdf.drawDataRow('Código', evaluacion.solicitud_codigo);
    pdf.drawDataRow('Solicitante', evaluacion.solicitante_nombre);

    // RIGHT COLUMN - Evaluación Info
    pdf.startRightColumn();
    pdf.drawSectionHeader('EVALUACIÓN');
    pdf.drawDataRow('Evaluador', evaluacion.evaluador_nombre);
    pdf.drawDataRow('Fecha', dayjs(evaluacion.creado_en).format('DD/MM/YYYY HH:mm'));

    pdf.syncColumns();

    // Resumen Ejecutivo - full width
    if (evaluacion.resumen_ejecutivo) {
      pdf.drawSectionHeaderFull('RESUMEN EJECUTIVO');
      pdf.drawInfoBox(evaluacion.resumen_ejecutivo, true);
    }

    // Justificación - full width
    if (evaluacion.justificacion) {
      pdf.drawSectionHeaderFull('JUSTIFICACIÓN DE LA RECOMENDACIÓN');
      pdf.drawInfoBox(evaluacion.justificacion, true);
    }

    // Cronograma - table full width
    const tareas = cronogramaResult.rows.filter(r => r.titulo);
    if (tareas.length > 0) {
      pdf.drawSectionHeaderFull('CRONOGRAMA PROPUESTO');

      const cronogramaRows = tareas.map(t => [
        t.titulo,
        t.fecha_inicio ? dayjs(t.fecha_inicio).format('DD/MM/YY') : '',
        t.fecha_fin ? dayjs(t.fecha_fin).format('DD/MM/YY') : '',
        `${t.duracion_dias || 0}d`
      ]);

      pdf.drawTable(
        ['Tarea', 'Inicio', 'Fin', 'Dur.'],
        cronogramaRows,
        { columnWidths: [260, 80, 80, 75] }
      );
    }

    // Costos - table full width
    if (costosResult.rows.length > 0) {
      pdf.drawSectionHeaderFull('ESTIMACIÓN DE COSTOS');

      const costos = costosResult.rows[0];
      const formatCOP = (val) => val ? `$${Number(val).toLocaleString('es-CO')}` : '$0';

      const costRows = [
        ['Desarrollo Interno', formatCOP(costos.desarrollo_interno)],
        ['Infraestructura', formatCOP(costos.infraestructura)],
        ['Servicios Externos', formatCOP(costos.servicios_externos)],
        ['Contingencia', formatCOP(costos.contingencia)],
        ['TOTAL ESTIMADO', formatCOP(costos.total)]
      ];

      pdf.drawTable(['Concepto', 'Monto (COP)'], costRows, { columnWidths: [320, 175] });
    }

    // Equipo - table full width
    if (equipoResult.rows.length > 0) {
      pdf.drawSectionHeaderFull('EQUIPO PROPUESTO');

      const equipoRows = equipoResult.rows.map(m => [
        m.nombre,
        m.cargo || 'N/A',
        m.rol_proyecto || 'Miembro',
        m.es_lider ? 'Sí' : '-',
        m.horas_estimadas ? `${m.horas_estimadas}h` : '-'
      ]);

      pdf.drawTable(
        ['Nombre', 'Cargo', 'Rol', 'Líder', 'Horas'],
        equipoRows,
        { columnWidths: [140, 110, 110, 50, 55] }
      );
    }

    // Riesgos and Requisitos in two columns
    if (evaluacion.riesgos || evaluacion.requisitos) {
      pdf.startLeftColumn();
      if (evaluacion.riesgos) {
        pdf.drawSectionHeader('RIESGOS');
        pdf.drawInfoBox(evaluacion.riesgos);
      }

      pdf.startRightColumn();
      if (evaluacion.requisitos) {
        pdf.drawSectionHeader('REQUISITOS');
        pdf.drawInfoBox(evaluacion.requisitos);
      }
      pdf.syncColumns();
    }

    // Finalize
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      pdf.drawFooter(i + 1, pages.count);
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  },

  /**
   * Generate weekly report PDF
   */
  async generateWeeklyReportPDF(reportData) {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pdf = new CorporatePDF(doc);

    const fechaInicio = dayjs(reportData.fecha_inicio).format('DD/MM/YYYY');
    const fechaFin = dayjs(reportData.fecha_fin).format('DD/MM/YYYY');

    // Header
    pdf.drawHeader('REPORTE SEMANAL', `${fechaInicio} - ${fechaFin}`);

    const datos = reportData.datos || {};

    // Solicitudes
    pdf.drawSectionHeader('SOLICITUDES');
    const solicitudes = datos.solicitudes || {};
    const solRows = [
      ['Nuevas en el período', String(solicitudes.nuevas || 0)],
      ['Aprobadas', String(solicitudes.aprobadas || 0)],
      ['Rechazadas', String(solicitudes.rechazadas || 0)],
      ['Completadas', String(solicitudes.completadas || 0)],
      ['Pendientes Evaluación NT', String(solicitudes.pendientes_evaluacion || 0)],
      ['Pendientes Aprobación Gerencia', String(solicitudes.pendientes_aprobacion || 0)]
    ];
    pdf.drawTable(['Métrica', 'Cantidad'], solRows, { columnWidths: [350, 145] });

    // Proyectos
    pdf.drawSectionHeader('PROYECTOS');
    const proyectos = datos.proyectos || {};
    const proyRows = [
      ['Proyectos Activos', String(proyectos.activos || 0)],
      ['Completados esta semana', String(proyectos.completados_semana || 0)],
      ['Pausados', String(proyectos.pausados || 0)]
    ];
    pdf.drawTable(['Métrica', 'Cantidad'], proyRows, { columnWidths: [350, 145] });

    // Tickets
    pdf.drawSectionHeader('TICKETS DE SOPORTE TI');
    const tickets = datos.tickets || {};
    const ticketRows = [
      ['Nuevos en el período', String(tickets.nuevos || 0)],
      ['Resueltos', String(tickets.resueltos || 0)],
      ['Abiertos actualmente', String(tickets.abiertos || 0)],
      ['Escalados a NT', String(tickets.escalados || 0)]
    ];
    if (tickets.tiempo_promedio_horas) {
      ticketRows.push(['Tiempo promedio de resolución', `${Math.round(tickets.tiempo_promedio_horas)} horas`]);
    }
    pdf.drawTable(['Métrica', 'Valor'], ticketRows, { columnWidths: [350, 145] });

    // Footer
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      pdf.drawFooter(i + 1, pages.count);
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  },

  /**
   * Generate project PDF
   */
  async generateProjectPDF(proyectoId) {
    const result = await pool.query(`
      SELECT p.*,
             u.nombre as responsable_nombre,
             s.codigo as solicitud_codigo,
             s.titulo as solicitud_titulo
      FROM proyectos p
      LEFT JOIN usuarios u ON p.responsable_id = u.id
      LEFT JOIN solicitudes s ON p.solicitud_id = s.id
      WHERE p.id = $1
    `, [proyectoId]);

    if (result.rows.length === 0) {
      throw new Error('Proyecto no encontrado');
    }

    const proyecto = result.rows[0];

    // Get tasks
    const tareasResult = await pool.query(`
      SELECT t.*, u.nombre as asignado_nombre
      FROM proyecto_tareas t
      LEFT JOIN usuarios u ON t.asignado_id = u.id
      WHERE t.proyecto_id = $1
      ORDER BY t.fecha_inicio
    `, [proyectoId]);

    // Get team
    const miembrosResult = await pool.query(`
      SELECT pm.*, u.nombre, u.email
      FROM proyecto_miembros pm
      JOIN usuarios u ON pm.usuario_id = u.id
      WHERE pm.proyecto_id = $1
    `, [proyectoId]);

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pdf = new CorporatePDF(doc);

    // Header
    pdf.drawHeader('PROYECTO', proyecto.codigo);

    // Summary
    doc.moveDown(0.5);
    const summaryY = doc.y;
    doc.rect(pdf.margin, summaryY, pdf.contentWidth, 50).fill(COLORS.lightGray);

    doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.secondary)
      .text(proyecto.titulo, pdf.margin + 15, summaryY + 10, { width: pdf.contentWidth - 30 });

    // Progress bar
    const progressY = summaryY + 32;
    const progressWidth = 200;
    const progress = proyecto.progreso || 0;
    doc.rect(pdf.margin + 15, progressY, progressWidth, 10).fill('#E0E0E0');
    doc.rect(pdf.margin + 15, progressY, progressWidth * (progress / 100), 10).fill(COLORS.primary);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.secondary)
      .text(`${progress}%`, pdf.margin + progressWidth + 25, progressY + 1);

    doc.y = summaryY + 60;

    // Información General
    pdf.drawSectionHeader('INFORMACIÓN DEL PROYECTO');
    pdf.drawDataRow('Código', proyecto.codigo);
    pdf.drawDataRow('Estado', (proyecto.estado || '').replace(/_/g, ' ').toUpperCase());
    pdf.drawDataRow('Responsable', proyecto.responsable_nombre);
    pdf.drawDataRow('Solicitud Origen', proyecto.solicitud_codigo);
    pdf.drawDataRow('Fecha Inicio Estimada', proyecto.fecha_inicio_estimada ?
      dayjs(proyecto.fecha_inicio_estimada).format('DD/MM/YYYY') : 'No definida');
    pdf.drawDataRow('Fecha Fin Estimada', proyecto.fecha_fin_estimada ?
      dayjs(proyecto.fecha_fin_estimada).format('DD/MM/YYYY') : 'No definida');
    pdf.drawDataRow('Progreso', `${proyecto.progreso || 0}%`);
    doc.moveDown(0.5);

    if (proyecto.descripcion) {
      pdf.drawSectionHeader('DESCRIPCIÓN');
      pdf.drawInfoBox(proyecto.descripcion, 'info');
    }

    // Team
    if (miembrosResult.rows.length > 0) {
      pdf.checkPageBreak(100);
      pdf.drawSectionHeader('EQUIPO DEL PROYECTO');

      const equipoRows = miembrosResult.rows.map(m => [
        m.nombre,
        m.email,
        m.rol_proyecto || 'Miembro'
      ]);

      pdf.drawTable(['Nombre', 'Email', 'Rol'], equipoRows, { columnWidths: [180, 200, 115] });
    }

    // Tasks
    if (tareasResult.rows.length > 0) {
      pdf.checkPageBreak(150);
      pdf.drawSectionHeader('TAREAS');

      const tareaRows = tareasResult.rows.map(t => [
        t.completada ? '✓' : '○',
        t.titulo,
        t.asignado_nombre || 'Sin asignar',
        `${t.progreso || 0}%`
      ]);

      pdf.drawTable(['', 'Tarea', 'Asignado', 'Progreso'], tareaRows, { columnWidths: [30, 250, 140, 75] });
    }

    // Footer
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      pdf.drawFooter(i + 1, pages.count);
    }

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
};

module.exports = pdfService;
