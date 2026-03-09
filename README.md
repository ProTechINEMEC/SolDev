# SolDev — Portal de Gestión INEMEC

Management portal for project tracking, IT support tickets, and knowledge management at INEMEC S.A.

**Stack:** React 18 + Vite + Ant Design | Node.js + Express | PostgreSQL 15 | Redis 7 | Socket.IO | Docker Compose

---

## Quick Start

```bash
cd work/SolDev
./start.sh                     # Start all services
docker compose up -d           # Alternative: direct start
docker compose logs -f         # View logs
```

**Ports:** Frontend `11000` | Backend API `11001` | PostgreSQL `11002` | Redis `11003`

**Default credentials:**

| User | Password | Role |
|------|----------|------|
| admin | Inemec2024 | Admin |
| nt | Inemec2024 | Nuevas Tecnologías |
| ti | Inemec2024 | TI (Soporte) |
| gerencia | Inemec2024 | Gerencia |
| coord.nt | Inemec2024 | Coordinador NT |
| coord.ti | Inemec2024 | Coordinador TI |

Test users (nt, ti, gerencia, coord.*) are disabled by default. Enable via Admin → Usuarios.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Network                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────┐  ┌───────┐ │
│  │   Frontend    │  │   Backend    │  │  DB   │  │ Redis │ │
│  │  React+Vite   │  │   Express    │  │  PG15 │  │  7.x  │ │
│  │  :11000       │  │  :11001      │  │ :11002│  │ :11003│ │
│  └──────┬───────┘  └──────┬───────┘  └───┬───┘  └───┬───┘ │
│         │                 │              │           │     │
│         │    REST API     │   SQL/Pool   │   Cache   │     │
│         ├────────────────►├─────────────►│           │     │
│         │    WebSocket    │              │  ◄────────┤     │
│         ├────────────────►│              │           │     │
│         │                 │              │           │     │
└─────────┴─────────────────┴──────────────┴───────────┴─────┘
```

- **Frontend** (`frontend/`): React 18 + Vite + Ant Design + Zustand + FullCalendar + Recharts
- **Backend** (`backend/`): Express + node-postgres + Redis + Socket.IO + node-cron + multer + pdfkit
- **Database** (`database/`): PostgreSQL 15 with init scripts (`database/init/01-*.sql` through `15-*.sql`)
- **Redis**: Session caching, rate limiting, real-time pub/sub

---

## Database Structure

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│    usuarios      │     │   solicitantes    │     │   sesiones     │
│  (internal users)│     │ (external users)  │     │  (JWT tokens)  │
└────────┬────────┘     └────────┬─────────┘     └────────────────┘
         │                       │
         │    ┌──────────────────┼──────────────────┐
         │    │                  │                   │
    ┌────▼────▼───┐    ┌────────▼───────┐   ┌──────▼──────┐
    │  solicitudes │    │    tickets     │   │  codigos_   │
    │  (requests)  │    │  (IT support)  │   │ verificacion│
    └──────┬──────┘    └───────┬────────┘   └─────────────┘
           │                   │
    ┌──────▼──────┐           │
    │ evaluaciones │           │
    │   _nt        │           │
    └──────┬──────┘           │
           │                   │
    ┌──────▼──────┐           │
    │  proyectos   │           │
    │  (projects)  │           │
    └──────┬──────┘           │
           │                   │
     ┌─────┼─────┬─────┐     │
     │     │     │     │     │
┌────▼─┐┌──▼──┐┌▼───┐┌▼────┐│
│tareas││miem-││cos- ││impl.││
│      ││bros ││tos  ││tare-││
│      ││     ││     ││as   ││
└──────┘└─────┘└─────┘└─────┘│
                               │
    ┌──────────────────────────┘
    │
    ▼ (shared across entities)
┌──────────────┐  ┌────────────────┐  ┌─────────────────┐
│ comentarios  │  │    archivos    │  │historial_cambios│
│  (comments)  │  │   (files)      │  │   (audit log)   │
└──────────────┘  └────────────────┘  └─────────────────┘

┌──────────────────┐  ┌──────────────────────┐  ┌─────────────────┐
│  notificaciones  │  │  opciones_formulario  │  │  reportes_      │
│  (in-app alerts) │  │  (form config)        │  │  semanales      │
└──────────────────┘  └──────────────────────┘  └─────────────────┘

┌───────────────────────┐  ┌────────────────────────┐
│ conocimiento_categorias│  │ conocimiento_articulos  │
│  (KB categories)       │  │  (KB articles)          │
└───────────────────────┘  └────────────────────────┘
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `usuarios` | Internal portal users (6 roles) |
| `solicitantes` | External requesters (email-verified) |
| `solicitudes` | Development requests (18-state lifecycle) |
| `tickets` | IT support tickets (8-state lifecycle) |
| `evaluaciones_nt` | NT technical evaluations with risk, cost, timeline |
| `proyectos` | Projects born from approved solicitudes |
| `proyecto_tareas` | Gantt chart tasks during development |
| `implementacion_tareas` | Implementation phase tasks (post-development) |
| `proyecto_miembros` | Project team assignments with leader flag |
| `proyecto_costos` | Project cost tracking (subtotal + IVA) |
| `proyecto_pausas` | Pause history with resume dates |
| `cronogramas` | Scheduling templates and proposals |
| `aprobaciones` | Gerencia approval decisions |
| `comentarios` | Comments on solicitudes, projects, tickets |
| `archivos` | File attachments (solicitud, proyecto, ticket, articulo) |
| `historial_cambios` | Full audit trail |
| `notificaciones` | In-app + real-time notifications |
| `opciones_formulario` | Configurable form options (admin-managed) |
| `conocimiento_articulos` | Knowledge base articles |
| `reportes_semanales` | Auto-generated weekly reports |
| `reprogramaciones` | Project rescheduling requests |

---

## Workflow Diagrams

### Solicitud Lifecycle (18 states)

```
                        ┌──────────────────────────────┐
                        │    pendiente_evaluacion_nt    │ ◄── Created
                        └──────────────┬───────────────┘
                                       │
                            ┌──────────▼──────────┐
                            │   en_evaluacion_nt   │
                            └──────────┬──────────┘
                                       │
                       ┌───────────────┼───────────────┐
                       │               │               │
              ┌────────▼───────┐      │      ┌────────▼────────┐
              │  descartado_nt │      │      │pendiente_aprob. │
              │   (rejected)   │      │      │   coordinador   │
              └────────────────┘      │      └────────┬────────┘
                                      │               │
                                      │      ┌────────▼────────┐
                                      │      │pendiente_aprob. │
                                      │      │    gerencia     │
                                      │      └────────┬────────┘
                                      │               │
                                      │    ┌──────────┼──────────┐
                                      │    │                     │
                                      │    ▼                     ▼
                                      │ rechazado_         ┌──────────┐
                                      │ gerencia           │ aprobado │
                                      │                    └────┬─────┘
                                      │                         │
                                      │                    ┌────▼─────┐
                                      │                    │ agendado │
                                      │                    └────┬─────┘
                                      │                         │
                              ┌───────▼────────┐          ┌────▼──────────┐
                              │  en_desarrollo │◄─────────│en_desarrollo  │
                              └───────┬────────┘          └───────────────┘
                                      │
                       ┌──────────────┼──────────────┐
                       │              │              │
                  ┌────▼────┐   ┌────▼─────┐   ┌───▼────┐
                  │ pausado │   │completado│   │cancelado│
                  └────┬────┘   └────┬─────┘   └────────┘
                       │             │
                       └─────►  ┌────▼──────────────┐
                                │en_implementacion  │
                                └────┬──────────────┘
                                     │
                                ┌────▼────────┐
                                │ solucionado │
                                └─────────────┘
```

Also: `pendiente_reevaluacion`, `stand_by`, `transferido_a_ti`

### Ticket Lifecycle (8 states)

```
┌────────┐     ┌─────────────┐     ┌───────────┐     ┌────────┐
│ abierto├────►│ en_progreso ├────►│ resuelto  ├────►│cerrado │
└────┬───┘     └──────┬──────┘     └───────────┘     └────────┘
     │                │
     │           ┌────▼─────┐     ┌──────────────┐
     │           │ escalado  ├───►│transferido_nt│
     │           └──────────┘     └──────────────┘
     │
     ├────►┌───────────────┐
     │     │cerrado_forzado│
     │     └───────────────┘
     │
     └────►┌──────────┐
           │ reabierto │──► en_progreso
           └──────────┘
```

### Project Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌───────────────────┐     ┌─────────────┐
│ planificacion├────►│en_desarrollo ├────►│en_implementacion  ├────►│ solucionado │
└──────────────┘     └──────┬───────┘     └───────────────────┘     └─────────────┘
                            │
                       ┌────▼────┐
                       │ pausado │──► en_desarrollo
                       └─────────┘

   Any active state ──► cancelado (by lead, coordinador_nt, or gerencia)
```

---

## Email Notifications

### Immediate Emails

| Trigger | Recipient | Email Function |
|---------|-----------|----------------|
| New solicitud (fallo/cierre) | NT team | `sendNewSolicitudToNT` |
| New solicitud (any) | Requester | `sendSolicitudCreatedWithForm` |
| Solicitud status change | Requester | `sendStatusChange` |
| Solicitud needs approval | Gerencia | `sendApprovalRequest` |
| Solicitud transferred to TI | Requester | `sendTransferNotification` |
| New ticket created | TI team | `sendNewTicketToTI` |
| New ticket created | Requester | `sendTicketCreatedWithForm` |
| Ticket resolved/closed | Requester | `sendTicketResolved` |
| Ticket transferred to NT | Requester | `sendTransferNotification` |
| Coordinator comment on ticket | Assigned TI | `sendCoordinatorCommentToTI` |
| Project → en_implementacion | Requester | `sendImplementationStarted` |
| Project → en_implementacion | NT + Gerencia | `sendProjectStatusChange` |
| Project → solucionado | Requester | `sendImplementationCompleted` |
| Project → solucionado | NT + Gerencia | `sendProjectStatusChange` |
| Project cancelled (coord/ger) | Requester | `sendProjectStatusChange` |
| Project started/paused/resumed | Requester | Inline email |
| Verification code | Requester | `sendVerificationCode` |
| Password reset | User | `sendPasswordReset` |

### Scheduled Emails (America/Bogota timezone)

| Schedule | Email | Recipients |
|----------|-------|------------|
| Monday 08:00 | Weekly report | NT + Gerencia |
| Daily 02:00 | Cleanup (expired tokens, old notifications) | — (no email) |
| Weekdays 08:00 | Deadline alerts + NT pending digest | NT team |
| Weekdays 09:00 | Pending approvals digest | Gerencia |
| Weekdays 10:00 | Reevaluation reminders | NT team |

---

## Roles & Permissions

| Role | Key Capabilities |
|------|-----------------|
| **admin** | Manage users, toggle test users, knowledge articles, form options config |
| **nuevas_tecnologias** | Full solicitud lifecycle, create/manage projects, evaluations, Gantt charts, implementation tasks |
| **ti** | Ticket management, assignment, resolution, statistics |
| **coordinador_nt** | Review/approve NT evaluations (gate before gerencia), cancel projects, manage rescheduling |
| **coordinador_ti** | Supervise TI, reassign tickets, forced close, workload overview |
| **gerencia** | Final solicitud approval, project oversight, reports, calendar, rescheduling approval |

---

## API Endpoints

All endpoints prefixed with `/api/`.

### Auth (`/api/auth`)
`POST /login` · `POST /logout` · `GET /me` · `POST /refresh` · `POST /forgot-password` · `POST /reset-password` · `GET /verify-reset-token/:token`

### Solicitudes (`/api/solicitudes`)
`GET /` · `POST /` · `GET /consulta/:codigo` · `GET /:codigo` · `PUT /:codigo/estado` · `POST /:codigo/comentarios` · `GET /:codigo/historial` · `POST /:codigo/agendar` · `POST /:codigo/solicitar-reevaluacion` · `GET /:codigo/reevaluaciones` · `POST /:codigo/transferir-ti` · `PATCH /:codigo/proyecto-referencia` · `PATCH /:codigo/formulario` · `GET /proyecto/consulta/:codigo`

### Tickets (`/api/tickets`)
`GET /consulta/:codigo` · `POST /` · `GET /` · `GET /ti-workers` · `GET /:codigo` · `PUT /:codigo` · `PUT /:codigo/estado` · `PUT /:codigo/escalar` · `POST /:codigo/comentarios` · `POST /:codigo/transferir-nt` · `PATCH /:codigo/categoria` · `PUT /:codigo/reasignar` · `PUT /:codigo/cerrar-forzado`

### Proyectos (`/api/proyectos`)
`GET /public` · `GET /holidays/:year` · `GET /` · `GET /:codigo` · `PUT /:codigo` · `PUT /:codigo/iniciar-desarrollo` · `PUT /:codigo/pausar` · `PUT /:codigo/reanudar` · `PUT /:codigo/cancelar-proyecto` · `PUT /:codigo/completar` · `PUT /:codigo/finalizar` · `PUT /:codigo/cancelar-coordinador` · `PUT /:codigo/cancelar-gerencia` · `PUT /:codigo/cambiar-lider` · `GET /:codigo/implementacion-tareas` · `PUT /:codigo/implementacion-tareas/:tareaId/progreso` · `GET /:codigo/tareas` · `POST /:codigo/tareas` · `PUT /:codigo/tareas/:tareaId` · `DELETE /:codigo/tareas/:tareaId` · `GET /:codigo/miembros` · `POST /:codigo/miembros` · `DELETE /:codigo/miembros/:userId` · `GET /:codigo/costos` · `POST /:codigo/costos` · `PUT /:codigo/costos/:costoId` · `DELETE /:codigo/costos/:costoId` · `GET /:codigo/costos/resumen` · `GET /:codigo/cambios-emergentes` · `POST /:codigo/comentarios` · `GET /:codigo/pausas` · `GET /:codigo/progreso` · `GET /:codigo/reprogramacion` · `POST /:codigo/reprogramacion` · `PUT /:codigo/reprogramacion/:id/coordinador` · `PUT /:codigo/reprogramacion/:id/gerencia`

### Evaluaciones (`/api/evaluaciones`)
`GET /` · `GET /solicitud/:param` · `GET /:id` · `POST /` · `PUT /:id` · `PUT /:id/lider` · `POST /:id/enviar`

### Dashboard (`/api/dashboard`)
`GET /nt` · `GET /ti` · `GET /gerencia` · `GET /coordinador-nt` · `GET /coordinador-ti` · `GET /admin`

### Notificaciones (`/api/notificaciones`)
`GET /` · `PUT /:id/leer` · `PUT /leer-todas` · `DELETE /:id`

### Conocimiento (`/api/conocimiento`)
`GET /articulos` · `GET /articulos/:slug` · `POST /articulos` · `PUT /articulos/:id` · `DELETE /articulos/:id` · `POST /articulos/:id/pdfs` · `DELETE /articulos/:articleId/pdfs/:fileId` · `GET /categorias` · `POST /categorias` · `PUT /categorias/:id` · `DELETE /categorias/:id` · `GET /etiquetas`

### Opciones (`/api/opciones`)
`GET /:categoria` · `GET /` · `POST /` · `PUT /:id` · `DELETE /:id` · `POST /:id/restore` · `POST /reorder`

### Calendario (`/api/calendario`)
`GET /festivos` · `GET /proyectos` · `GET /conflictos` · `GET /estadisticas` · `GET /proyectos-con-tareas` · `GET /equipo-carga` · `POST /calcular-fechas` · `POST /preview` · `POST /preview-reprogramacion`

### Reportes (`/api/reportes`)
`GET /semanal` · `GET /proyectos` · `GET /tickets` · `POST /generar` · `GET /solicitudes`

### Export (`/api/export`)
`GET /solicitud/:codigo/pdf` · `GET /ticket/:codigo/pdf` · `GET /evaluacion/:id/pdf` · `GET /proyecto/:id/pdf` · `GET /reporte-semanal/pdf` · `GET /audit-log` · `GET /solicitudes` · `GET /tickets`

### Other
- **Archivos** (`/api/archivos`): Upload, download, preview, delete
- **Profile** (`/api/profile`): View/edit profile, change password, activity log, sessions
- **Verificacion** (`/api/verificacion`): Email verification for external requesters
- **Search** (`/api/search`): Full-text search across entities
- **Cronogramas** (`/api/cronogramas`): Schedule templates and management
- **Estimaciones** (`/api/estimaciones`): Cost estimation for evaluations
- **Transferencias** (`/api/transferencias`): Transfer history lookup
- **Respuestas** (`/api/respuestas`): External requester response tokens
- **Usuarios** (`/api/usuarios`): User CRUD (admin only)

---

## Deployment

### Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `frontend` | Node 20 (Vite dev) | 11000 | React SPA |
| `backend` | Node 20 | 11001 | Express API |
| `database` | postgres:15 | 11002 | PostgreSQL |
| `redis` | redis:7-alpine | 11003 | Cache + pub/sub |

### Environment Variables (`.env`)

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Environment (development/production) |
| `JWT_SECRET` | JWT signing secret |
| `POSTGRES_*` | Database credentials |
| `REDIS_URL` | Redis connection string |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Office365 SMTP |
| `SMTP_FROM`, `SMTP_FROM_NAME` | Email sender info |
| `FRONTEND_URL` | Frontend URL for email links |
| `OPENAI_API_KEY` | (unused, reserved) |

### Production (Cloudflare Tunnel)

```bash
./deploy-tunnel.sh    # Build, deploy, and configure tunnel
```

Production URLs:
- Frontend: `tecnologia.inemec.com`
- Backend: `api.tecnologia.inemec.com`
