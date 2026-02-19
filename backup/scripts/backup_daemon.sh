#!/bin/bash

# =============================================================================
# GESTOR PROYECTOS (SolDev) - DAEMON DE BACKUP AUTOMATIZADO
# =============================================================================

set -euo pipefail

# Configuracion
LOG_FILE="/app/logs/backup_daemon.log"
BACKUP_SCRIPT="/app/scripts/backup_postgres.sh"
INTERVAL=${BACKUP_INTERVAL:-600}  # 10 minutos por defecto

# Crear directorio de logs si no existe
mkdir -p /app/logs

# Funcion de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Funcion para limpiar al salir
cleanup() {
    log "Recibida senal de terminacion. Cerrando daemon de backup..."
    exit 0
}

# Configurar trap para manejo de senales
trap cleanup SIGTERM SIGINT

# Funcion principal del daemon
main() {
    log "Iniciando daemon de backup PostgreSQL automatizado"
    log "Intervalo configurado: $INTERVAL segundos"
    log "Base de datos: PostgreSQL (soldev_db)"
    log "Destinos: ${BACKUP_DESTINATIONS:-sharepoint_jesus_corp}"

    # Verificar que existe el script de backup
    if [[ ! -f "$BACKUP_SCRIPT" ]]; then
        log "ERROR: Script de backup no encontrado en $BACKUP_SCRIPT"
        exit 1
    fi

    # Verificar configuracion de rclone
    if [[ ! -f "/root/.config/rclone/rclone.conf" ]]; then
        log "ADVERTENCIA: No se encontro configuracion de rclone"
        log "Por favor, configure rclone usando: docker exec soldev-backup rclone config"
    fi

    # Bucle principal
    backup_count=0
    while true; do
        backup_count=$((backup_count + 1))

        log "Iniciando backup #$backup_count"

        # Ejecutar backup
        if bash "$BACKUP_SCRIPT"; then
            log "Backup #$backup_count completado exitosamente"
        else
            log "ERROR: Backup #$backup_count fallo"
        fi

        log "Esperando $INTERVAL segundos hasta el siguiente backup..."
        sleep "$INTERVAL"
    done
}

# Crear directorios necesarios
mkdir -p /app/temp /app/logs

# Verificar conexion a PostgreSQL
log "Verificando conexion a PostgreSQL..."
if PGPASSWORD="${DB_PASSWORD:-soldev_prod_2026}" pg_isready -h database -p 5432 -U "${DB_USER:-soldev_user}" &>/dev/null; then
    log "Conexion a PostgreSQL verificada"
else
    log "No se puede conectar a PostgreSQL aun, esperando..."
    sleep 30
fi

# Ejecutar funcion principal
main
