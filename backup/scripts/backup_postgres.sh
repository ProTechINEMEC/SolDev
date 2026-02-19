#!/bin/bash

# =============================================================================
# GESTOR PROYECTOS (SolDev) - BACKUP DE POSTGRESQL CON RCLONE
# =============================================================================

set -euo pipefail

# Configuracion
LOG_FILE="/app/logs/backup.log"
TEMP_DIR="/app/temp"
LOCAL_BACKUP_DIR="/app/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="soldev_backup_$TIMESTAMP"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
DESTINATIONS=${BACKUP_DESTINATIONS:-sharepoint_jesus_corp}

# PostgreSQL connection
PG_HOST="${DB_HOST:-database}"
PG_PORT="5432"
PG_USER="${DB_USER:-soldev_user}"
PG_PASSWORD="${DB_PASSWORD:-soldev_prod_2026}"
PG_DATABASE="${DB_NAME:-soldev_db}"

# Funcion de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Funcion para enviar notificaciones
send_notification() {
    local message="$1"
    local status="$2"

    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"message\":\"$message\",\"status\":\"$status\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            &>/dev/null || true
    fi
}

# Funcion para crear backup de PostgreSQL
create_postgres_backup() {
    local backup_file="$1"

    log "Creando backup de PostgreSQL..."

    # Realizar dump de la base de datos
    if PGPASSWORD="$PG_PASSWORD" pg_dump \
        -h "$PG_HOST" \
        -p "$PG_PORT" \
        -U "$PG_USER" \
        -d "$PG_DATABASE" \
        --verbose \
        --no-owner \
        --no-privileges \
        --if-exists \
        --clean \
        --create \
        2>>"$LOG_FILE" | gzip > "$backup_file"; then

        local size=$(du -h "$backup_file" | cut -f1)
        log "Backup creado: $backup_file ($size)"
        return 0
    else
        log "ERROR: No se pudo crear el backup de PostgreSQL"
        return 1
    fi
}

# Funcion para subir a destinos remotos
upload_to_remote() {
    local backup_file="$1"
    local success_count=0
    local total_destinations=0

    # Convertir destinos en array
    IFS=',' read -ra DEST_ARRAY <<< "$DESTINATIONS"

    for destination in "${DEST_ARRAY[@]}"; do
        destination=$(echo "$destination" | xargs)
        total_destinations=$((total_destinations + 1))

        log "Subiendo a $destination..."

        # Directorio remoto organizado por fecha
        local remote_dir="GestorProyectos/backups/postgres/$(date '+%Y/%m')"

        if rclone copy "$backup_file" "$destination:$remote_dir" --progress 2>&1 | tee -a "$LOG_FILE"; then
            log "Subida exitosa a $destination:$remote_dir"
            success_count=$((success_count + 1))
        else
            log "ERROR: Fallo al subir a $destination"
        fi
    done

    if [[ $success_count -eq $total_destinations ]]; then
        log "Todas las subidas completadas"
        return 0
    elif [[ $success_count -gt 0 ]]; then
        log "Subidas parciales: $success_count/$total_destinations"
        return 1
    else
        log "ERROR: Todas las subidas fallaron"
        return 2
    fi
}

# Funcion para guardar backup localmente
save_local_backup() {
    local backup_file="$1"
    local local_file="$LOCAL_BACKUP_DIR/$(basename "$backup_file")"

    log "Guardando backup localmente..."

    # Crear directorio si no existe
    mkdir -p "$LOCAL_BACKUP_DIR"

    # Copiar backup al directorio local
    if cp "$backup_file" "$local_file"; then
        local size=$(du -h "$local_file" | cut -f1)
        log "Backup local guardado: $local_file ($size)"

        # Crear enlace simbolico al ultimo backup
        ln -sf "$(basename "$local_file")" "$LOCAL_BACKUP_DIR/latest.sql.gz" 2>/dev/null || true

        return 0
    else
        log "ERROR: No se pudo guardar el backup localmente"
        return 1
    fi
}

# Funcion para limpiar backups antiguos
cleanup_old_backups() {
    log "Limpiando backups antiguos..."

    # Limpiar archivos locales temporales
    find "$TEMP_DIR" -name "soldev_backup_*.sql.gz" -mtime +1 -delete 2>/dev/null || true

    # Limpiar backups locales antiguos (>RETENTION_DAYS dias)
    local deleted_local=0
    if [ -d "$LOCAL_BACKUP_DIR" ]; then
        deleted_local=$(find "$LOCAL_BACKUP_DIR" -name "soldev_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
        if [ $deleted_local -gt 0 ]; then
            log "Eliminados $deleted_local backups locales antiguos (>$RETENTION_DAYS dias)"
        fi
    fi

    # Limpiar backups remotos antiguos
    IFS=',' read -ra DEST_ARRAY <<< "$DESTINATIONS"

    for destination in "${DEST_ARRAY[@]}"; do
        destination=$(echo "$destination" | xargs)

        log "Limpiando backups remotos en $destination (>$RETENTION_DAYS dias)..."

        # Usar rclone para eliminar backups antiguos
        rclone delete "$destination:GestorProyectos/backups/postgres/" \
            --min-age "${RETENTION_DAYS}d" \
            --rmdirs 2>>"$LOG_FILE" || true
    done
}

# Funcion principal
main() {
    local start_time=$(date +%s)

    log "Iniciando backup de PostgreSQL"
    log "Base de datos: $PG_DATABASE@$PG_HOST"
    log "Destinos: $DESTINATIONS"

    # Crear directorio temporal
    mkdir -p "$TEMP_DIR"

    # Ruta del archivo de backup
    local backup_file="$TEMP_DIR/$BACKUP_NAME.sql.gz"

    # Verificar conexion a PostgreSQL
    if ! PGPASSWORD="$PG_PASSWORD" pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" &>/dev/null; then
        log "ERROR: No se puede conectar a PostgreSQL"
        send_notification "Backup fallo: No se puede conectar a PostgreSQL" "error"
        return 1
    fi

    # Crear backup
    if ! create_postgres_backup "$backup_file"; then
        send_notification "Backup fallo: Error creando dump" "error"
        return 1
    fi

    # Guardar backup localmente
    save_local_backup "$backup_file"

    # Subir a destinos remotos
    local upload_result=0
    upload_to_remote "$backup_file" || upload_result=$?

    # Limpiar archivo temporal
    log "Limpiando archivo temporal..."
    rm -f "$backup_file"

    # Limpiar backups antiguos
    cleanup_old_backups

    # Calcular tiempo total
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Notificacion final
    if [[ $upload_result -eq 0 ]]; then
        log "Backup completado en ${duration}s"
        send_notification "Backup PostgreSQL completado en ${duration}s" "success"
        return 0
    elif [[ $upload_result -eq 1 ]]; then
        log "Backup parcial en ${duration}s"
        send_notification "Backup PostgreSQL parcial en ${duration}s" "warning"
        return 0
    else
        log "Backup fallo en ${duration}s"
        send_notification "Backup PostgreSQL fallo en ${duration}s" "error"
        return 1
    fi
}

# Verificar dependencias
if ! command -v pg_dump &> /dev/null; then
    log "ERROR: pg_dump no esta instalado"
    exit 1
fi

if ! command -v rclone &> /dev/null; then
    log "ERROR: rclone no esta instalado"
    exit 1
fi

# Ejecutar
main "$@"
