#!/bin/bash

# =============================================================================
# GESTOR PROYECTOS (SolDev) - RESTAURACION DE POSTGRESQL
# =============================================================================
# Uso:
#   ./restore_postgres.sh <archivo_backup.sql.gz>
#   ./restore_postgres.sh latest                    # Restaura el ultimo backup local
#   ./restore_postgres.sh --from-remote <fecha>     # Descarga y restaura desde SharePoint
#
# Ejemplos:
#   ./restore_postgres.sh /app/backups/soldev_backup_20260219_152522.sql.gz
#   ./restore_postgres.sh latest
#   ./restore_postgres.sh --from-remote 20260219
# =============================================================================

set -euo pipefail

# Configuracion
LOG_FILE="/app/logs/restore.log"
TEMP_DIR="/app/temp"
LOCAL_BACKUP_DIR="/app/backups"
REMOTE_SOURCE=${BACKUP_DESTINATIONS:-sharepoint_jesus_corp}

# PostgreSQL connection
PG_HOST="${DB_HOST:-database}"
PG_PORT="5432"
PG_USER="${DB_USER:-soldev_user}"
PG_PASSWORD="${DB_PASSWORD:-soldev_prod_2026}"
PG_DATABASE="${DB_NAME:-soldev_db}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funcion de logging
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$LOG_FILE"
}

log_info() { log "${BLUE}INFO:${NC} $1"; }
log_success() { log "${GREEN}OK:${NC} $1"; }
log_warning() { log "${YELLOW}WARN:${NC} $1"; }
log_error() { log "${RED}ERROR:${NC} $1"; }

# Mostrar uso
show_usage() {
    echo "Uso: $0 <archivo_backup.sql.gz | latest | --from-remote <fecha>>"
    echo ""
    echo "Opciones:"
    echo "  <archivo>           Ruta al archivo de backup (.sql.gz)"
    echo "  latest              Restaura el ultimo backup local"
    echo "  --from-remote DATE  Descarga backup de SharePoint (formato: YYYYMMDD)"
    echo ""
    echo "Ejemplos:"
    echo "  $0 /app/backups/soldev_backup_20260219_152522.sql.gz"
    echo "  $0 latest"
    echo "  $0 --from-remote 20260219"
    exit 1
}

# Verificar conexion a PostgreSQL
check_postgres_connection() {
    log_info "Verificando conexion a PostgreSQL..."
    if PGPASSWORD="$PG_PASSWORD" pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" &>/dev/null; then
        log_success "Conexion a PostgreSQL verificada"
        return 0
    else
        log_error "No se puede conectar a PostgreSQL en $PG_HOST:$PG_PORT"
        return 1
    fi
}

# Descargar backup desde SharePoint
download_from_remote() {
    local date_pattern="$1"
    local year="${date_pattern:0:4}"
    local month="${date_pattern:4:2}"
    local remote_path="GestorProyectos/backups/postgres/$year/$month/"

    log_info "Buscando backups en $REMOTE_SOURCE:$remote_path con patron $date_pattern..."

    # Listar archivos que coincidan con la fecha
    local files
    files=$(rclone ls "$REMOTE_SOURCE:$remote_path" 2>/dev/null | grep "soldev_backup_$date_pattern" | sort | tail -1)

    if [[ -z "$files" ]]; then
        log_error "No se encontraron backups para la fecha $date_pattern"
        log_info "Backups disponibles:"
        rclone ls "$REMOTE_SOURCE:$remote_path" 2>/dev/null | tail -10 || true
        return 1
    fi

    # Extraer nombre del archivo (ultima columna)
    local filename
    filename=$(echo "$files" | awk '{print $NF}')

    log_info "Descargando $filename..."

    mkdir -p "$TEMP_DIR"
    if rclone copy "$REMOTE_SOURCE:$remote_path$filename" "$TEMP_DIR/" --progress; then
        log_success "Backup descargado: $TEMP_DIR/$filename"
        echo "$TEMP_DIR/$filename"
        return 0
    else
        log_error "Error descargando backup"
        return 1
    fi
}

# Obtener el ultimo backup local
get_latest_local_backup() {
    if [[ -L "$LOCAL_BACKUP_DIR/latest.sql.gz" ]]; then
        local target
        target=$(readlink -f "$LOCAL_BACKUP_DIR/latest.sql.gz")
        if [[ -f "$target" ]]; then
            echo "$target"
            return 0
        fi
    fi

    # Buscar el mas reciente si no hay symlink
    local latest
    latest=$(find "$LOCAL_BACKUP_DIR" -name "soldev_backup_*.sql.gz" -type f 2>/dev/null | sort | tail -1)

    if [[ -n "$latest" ]]; then
        echo "$latest"
        return 0
    fi

    log_error "No se encontraron backups locales en $LOCAL_BACKUP_DIR"
    return 1
}

# Preparar archivo SQL para restauracion
prepare_sql_for_restore() {
    local input_file="$1"
    local output_file="$2"

    log_info "Preparando SQL para restauracion..."

    if [[ "$input_file" == *.gz ]]; then
        zcat "$input_file" | \
            sed '/^DROP DATABASE/d; /^CREATE DATABASE/d; /^\\connect/d' > "$output_file"
    else
        sed '/^DROP DATABASE/d; /^CREATE DATABASE/d; /^\\connect/d' "$input_file" > "$output_file"
    fi

    local size
    size=$(du -h "$output_file" | cut -f1)
    log_success "SQL preparado: $output_file ($size)"
}

# Terminar conexiones activas a la base de datos
terminate_connections() {
    log_info "Terminando conexiones activas a $PG_DATABASE..."

    PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -c "
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '$PG_DATABASE'
        AND pid <> pg_backend_pid();
    " &>/dev/null || true

    log_success "Conexiones terminadas"
}

# Recrear base de datos
recreate_database() {
    log_info "Recreando base de datos $PG_DATABASE..."

    PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -c "
        DROP DATABASE IF EXISTS $PG_DATABASE;
    " 2>/dev/null

    PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -c "
        CREATE DATABASE $PG_DATABASE OWNER $PG_USER;
    " 2>/dev/null

    log_success "Base de datos recreada"
}

# Restaurar backup
restore_backup() {
    local sql_file="$1"

    log_info "Restaurando backup en $PG_DATABASE..."
    log_info "Esto puede tomar varios minutos dependiendo del tamano..."

    local start_time
    start_time=$(date +%s)

    if PGPASSWORD="$PG_PASSWORD" psql \
        -h "$PG_HOST" \
        -p "$PG_PORT" \
        -U "$PG_USER" \
        -d "$PG_DATABASE" \
        -v ON_ERROR_STOP=0 \
        -f "$sql_file" &>>"$LOG_FILE"; then

        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))

        log_success "Restauracion completada en ${duration}s"
        return 0
    else
        log_error "Error durante la restauracion (ver $LOG_FILE para detalles)"
        return 1
    fi
}

# Verificar restauracion
verify_restore() {
    log_info "Verificando restauracion..."

    local counts
    counts=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -t -c "
        SELECT 'usuarios: ' || COUNT(*) FROM usuarios
        UNION ALL SELECT 'proyectos: ' || COUNT(*) FROM proyectos
        UNION ALL SELECT 'solicitudes: ' || COUNT(*) FROM solicitudes
        UNION ALL SELECT 'tickets: ' || COUNT(*) FROM tickets;
    " 2>/dev/null)

    if [[ -n "$counts" ]]; then
        log_success "Verificacion de datos:"
        echo "$counts" | while read -r line; do
            [[ -n "$line" ]] && log_info "  $line"
        done
        return 0
    else
        log_error "No se pudieron verificar los datos"
        return 1
    fi
}

# Funcion principal
main() {
    local backup_file=""
    local temp_sql=""
    local cleanup_temp=false

    log "=========================================="
    log "RESTAURACION DE POSTGRESQL - GESTOR PROYECTOS"
    log "=========================================="

    # Parsear argumentos
    if [[ $# -lt 1 ]]; then
        show_usage
    fi

    case "$1" in
        --from-remote)
            if [[ $# -lt 2 ]]; then
                log_error "Falta la fecha para --from-remote"
                show_usage
            fi
            backup_file=$(download_from_remote "$2")
            cleanup_temp=true
            ;;
        latest)
            backup_file=$(get_latest_local_backup)
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            backup_file="$1"
            ;;
    esac

    # Verificar que el archivo existe
    if [[ ! -f "$backup_file" ]]; then
        log_error "Archivo no encontrado: $backup_file"
        exit 1
    fi

    log_info "Archivo de backup: $backup_file"
    log_info "Tamano: $(du -h "$backup_file" | cut -f1)"

    # Confirmacion
    echo ""
    echo -e "${YELLOW}ADVERTENCIA: Esta operacion eliminara TODOS los datos actuales${NC}"
    echo -e "${YELLOW}de la base de datos '$PG_DATABASE' y los reemplazara con el backup.${NC}"
    echo ""
    read -p "Desea continuar? (si/no): " confirm

    if [[ "$confirm" != "si" && "$confirm" != "SI" && "$confirm" != "s" && "$confirm" != "S" ]]; then
        log_info "Restauracion cancelada por el usuario"
        exit 0
    fi

    # Crear directorio temporal
    mkdir -p "$TEMP_DIR"
    temp_sql="$TEMP_DIR/restore_$(date +%s).sql"

    # Ejecutar restauracion
    check_postgres_connection || exit 1
    prepare_sql_for_restore "$backup_file" "$temp_sql"
    terminate_connections
    recreate_database
    restore_backup "$temp_sql"
    verify_restore

    # Limpiar
    log_info "Limpiando archivos temporales..."
    rm -f "$temp_sql"
    if [[ "$cleanup_temp" == true ]]; then
        rm -f "$backup_file"
    fi

    log "=========================================="
    log_success "RESTAURACION COMPLETADA EXITOSAMENTE"
    log "=========================================="

    echo ""
    echo -e "${GREEN}La base de datos ha sido restaurada correctamente.${NC}"
    echo -e "${YELLOW}IMPORTANTE: Reinicie el backend para que tome los cambios:${NC}"
    echo "  docker restart soldev_backend"
}

# Verificar dependencias
if ! command -v psql &> /dev/null; then
    log_error "psql no esta instalado"
    exit 1
fi

if ! command -v rclone &> /dev/null; then
    log_warning "rclone no esta instalado (--from-remote no funcionara)"
fi

# Ejecutar
main "$@"
