#!/bin/bash

# =============================================================================
# GESTOR PROYECTOS (SolDev) - Script de despliegue con Cloudflare Tunnel
# Uso: ./deploy-tunnel.sh [start|stop|restart|logs|status|setup|...]
# =============================================================================

set -e

ACTION=${1:-start}

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funcion para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Verificar si Docker esta instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker no esta instalado"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
        error "Docker Compose no esta disponible"
        exit 1
    fi
}

# Verificar configuracion para tunel
check_tunnel_config() {
    log "Verificando configuracion del tunel..."

    # Verificar archivos necesarios
    if [[ ! -f "docker-compose.tunnel.yml" ]]; then
        error "Archivo docker-compose.tunnel.yml no encontrado"
        exit 1
    fi

    if [[ ! -f ".env.tunnel" ]]; then
        error "Archivo .env.tunnel no encontrado"
        echo ""
        warning "Crea el archivo .env.tunnel con tu TUNNEL_TOKEN"
        exit 1
    fi

    # Verificar que existe el token
    if ! grep -q "TUNNEL_TOKEN=" .env.tunnel; then
        error "TUNNEL_TOKEN no encontrado en .env.tunnel"
        exit 1
    fi

    # Verificar que el token no este vacio
    TUNNEL_TOKEN=$(grep "^TUNNEL_TOKEN=" .env.tunnel | cut -d'=' -f2-)
    if [[ -z "$TUNNEL_TOKEN" || "$TUNNEL_TOKEN" == "tu_token_aqui_sera_muy_largo" ]]; then
        error "TUNNEL_TOKEN esta vacio o sin configurar"
        echo ""
        warning "Configura tu TUNNEL_TOKEN real en .env.tunnel"
        exit 1
    fi

    success "Configuracion del tunel verificada"
}

# Configuracion inicial
setup_environment() {
    log "Configurando entorno para Cloudflare Tunnel..."

    # Crear directorios necesarios
    mkdir -p uploads logs backups/postgres backup/logs backup/temp

    # Copiar archivo de entorno si no existe
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.tunnel" ]]; then
            cp .env.tunnel .env
            success "Archivo .env creado desde .env.tunnel"
        else
            warning "Crea el archivo .env.tunnel con tu configuracion"
        fi
    fi

    # Configurar permisos
    chmod 755 uploads logs

    success "Entorno configurado"
}

# Mostrar instrucciones para configurar tunel
show_tunnel_instructions() {
    echo ""
    log "INSTRUCCIONES PARA CONFIGURAR EL TUNEL:"
    echo ""
    echo "1. Ve al Cloudflare Zero Trust Dashboard:"
    echo "   https://one.dash.cloudflare.com/"
    echo ""
    echo "2. Ve a Networks > Tunnels > Create a tunnel"
    echo ""
    echo "3. Nombra tu tunel: 'tecnologia-tunnel'"
    echo ""
    echo "4. Copia el token que aparece y usalo en .env.tunnel"
    echo ""
    echo "5. Configura estas rutas publicas:"
    echo "   - Subdomain: tecnologia"
    echo "     Domain: inemec.com"
    echo "     Service: http://frontend:80"
    echo ""
    echo "   - Subdomain: api.tecnologia"
    echo "     Domain: inemec.com"
    echo "     Service: http://backend:11001"
    echo ""
    echo "6. Ejecuta: ./deploy-tunnel.sh start"
    echo ""
}

case $ACTION in
  start)
    log "Iniciando servicios con Cloudflare Tunnel..."

    check_docker
    check_tunnel_config
    setup_environment

    # Construir y ejecutar contenedores
    docker-compose -f docker-compose.tunnel.yml --env-file .env.tunnel up -d --build

    # Esperar un momento para que los servicios inicien
    sleep 10

    # Verificar estado
    log "Verificando estado de servicios..."

    success "Servicios iniciados con Cloudflare Tunnel:"
    echo "   Frontend: https://tecnologia.inemec.com"
    echo "   Backend API: https://api.tecnologia.inemec.com"
    echo ""
    warning "NOTA: Los servicios estan accesibles SOLO a traves del tunel"
    warning "No hay puertos expuestos localmente (mas seguro)"
    ;;

  stop)
    log "Deteniendo servicios..."
    docker-compose -f docker-compose.tunnel.yml down
    success "Servicios detenidos"
    ;;

  restart)
    log "Reiniciando servicios..."
    docker-compose -f docker-compose.tunnel.yml down
    sleep 5
    docker-compose -f docker-compose.tunnel.yml --env-file .env.tunnel up -d --build
    success "Servicios reiniciados"
    ;;

  logs)
    log "Mostrando logs..."
    docker-compose -f docker-compose.tunnel.yml logs -f
    ;;

  status)
    log "Estado de servicios con Cloudflare Tunnel..."
    echo ""
    docker-compose -f docker-compose.tunnel.yml ps
    echo ""

    log "Estado del tunel:"

    # Check tunnel
    TUNNEL_STATUS=$(docker logs soldev-cloudflared --tail 10 2>/dev/null | grep -i "connection.*registered" | tail -1 || echo "No conectado")
    if [[ "$TUNNEL_STATUS" == *"registered"* ]]; then
        success "Tunel: Conectado"
    else
        warning "Tunel: Verificando conexion..."
        echo "   $TUNNEL_STATUS"
    fi

    echo ""
    log "URLs de acceso:"
    echo "   Frontend: https://tecnologia.inemec.com"
    echo "   Backend: https://api.tecnologia.inemec.com"
    echo ""
    warning "Los servicios NO estan expuestos localmente (solo tunel)"
    ;;

  setup)
    log "Configuracion inicial para Cloudflare Tunnel..."
    check_docker
    setup_environment

    if [[ ! -f ".env.tunnel" ]] || ! grep -q "TUNNEL_TOKEN=" .env.tunnel; then
        show_tunnel_instructions
    else
        TUNNEL_TOKEN=$(grep "^TUNNEL_TOKEN=" .env.tunnel | cut -d'=' -f2-)
        if [[ -z "$TUNNEL_TOKEN" || "$TUNNEL_TOKEN" == "tu_token_aqui_sera_muy_largo" ]]; then
            show_tunnel_instructions
        else
            success "Configuracion del tunel completada"
            echo ""
            log "Todo listo? Ejecuta: ./deploy-tunnel.sh start"
        fi
    fi
    ;;

  instructions|help)
    show_tunnel_instructions
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  start           - Iniciar servicios con Cloudflare Tunnel"
    echo "  stop            - Detener todos los servicios"
    echo "  restart         - Reiniciar servicios con rebuild"
    echo "  logs            - Mostrar logs en tiempo real"
    echo "  status          - Mostrar estado de servicios y tunel"
    echo "  setup           - Configuracion inicial"
    echo "  instructions    - Mostrar instrucciones del tunel"
    echo ""
    echo "Comandos de Backup:"
    echo "  backup-status   - Ver estado del sistema de backup"
    echo "  backup-logs     - Ver logs del daemon de backup"
    echo "  backup-manual   - Ejecutar backup manual inmediato"
    echo "  backup-local    - Listar backups locales en el servidor"
    echo "  backup-list     - Listar backups en la nube"
    echo "  backup-config   - Configurar rclone interactivamente"
    echo "  backup-reconnect - Reconectar token de SharePoint/OneDrive"
    echo "  restore <opt>   - Restaurar base de datos desde backup"
    echo "                    Opciones: latest, archivo.sql.gz, --from-remote YYYYMMDD"
    echo ""
    echo "Con Cloudflare Tunnel:"
    echo "   - Sin puertos expuestos (mas seguro)"
    echo "   - SSL automatico"
    echo "   - Sin configuracion de firewall"
    echo "   - Sin IP publica necesaria"
    echo ""
    echo "Sistema de Backup:"
    echo "   - Backups automaticos cada 10 minutos"
    echo "   - Sincronizacion a OneDrive/SharePoint"
    echo "   - Retencion: 30 dias"
    ;;

  backup-logs)
    log "Mostrando logs del sistema de backup..."
    docker logs soldev-backup --tail 100 -f
    ;;

  backup-status)
    log "Estado del sistema de backup..."
    echo ""
    echo "=== Contenedor de Backup ==="
    docker ps --filter "name=soldev-backup" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    echo ""
    echo "=== Ultimos backups en la nube ==="
    docker exec soldev-backup rclone lsf sharepoint_jesus_corp:GestorProyectos/backups/postgres/ --recursive | tail -10
    echo ""
    echo "=== Ultimas lineas del log ==="
    docker exec soldev-backup tail -20 /app/logs/backup_daemon.log
    ;;

  backup-manual)
    log "Ejecutando backup manual..."
    docker exec soldev-backup /app/scripts/backup_postgres.sh
    success "Backup manual completado"
    ;;

  backup-list)
    log "Listando backups en la nube..."
    docker exec soldev-backup rclone ls sharepoint_jesus_corp:GestorProyectos/backups/postgres/ --recursive
    ;;

  backup-local)
    log "Listando backups locales..."
    echo ""
    if [ -d "backups/postgres" ] && [ "$(ls -A backups/postgres 2>/dev/null)" ]; then
        ls -lh backups/postgres/*.sql.gz 2>/dev/null | awk '{print $9, "-", $5}' || echo "No hay backups locales"
        echo ""
        echo "Total de backups locales: $(ls backups/postgres/*.sql.gz 2>/dev/null | wc -l)"
        echo "Espacio usado: $(du -sh backups/postgres 2>/dev/null | cut -f1)"
    else
        warning "No hay backups locales todavia"
    fi
    ;;

  restore)
    log "Restauracion de base de datos PostgreSQL..."
    echo ""

    if [[ $# -lt 2 ]]; then
        echo "Uso: $0 restore <opcion>"
        echo ""
        echo "Opciones:"
        echo "  latest              - Restaurar el ultimo backup local"
        echo "  <archivo.sql.gz>    - Restaurar un archivo especifico"
        echo "  --from-remote DATE  - Descargar y restaurar desde SharePoint (YYYYMMDD)"
        echo ""
        echo "Ejemplos:"
        echo "  $0 restore latest"
        echo "  $0 restore /ruta/al/backup.sql.gz"
        echo "  $0 restore --from-remote 20260219"
        echo ""
        echo "ADVERTENCIA: Esto ELIMINARA todos los datos actuales"
        exit 1
    fi

    # Pasar argumentos al script de restauracion en el contenedor
    shift  # Remover 'restore' de los argumentos
    docker exec -it soldev-backup /app/scripts/restore_postgres.sh "$@"

    if [[ $? -eq 0 ]]; then
        echo ""
        log "Reiniciando backend para aplicar cambios..."
        docker restart soldev_backend
        sleep 5
        success "Restauracion completada. Backend reiniciado."
    fi
    ;;

  backup-config)
    log "Configuracion de rclone..."
    docker exec -it soldev-backup rclone config
    ;;

  backup-reconnect)
    log "Reconectando token de SharePoint/OneDrive para backups..."

    RCLONE_CONFIG="./backup/rclone_config/rclone.conf"

    # Verificar que rclone este instalado
    if ! command -v rclone &> /dev/null; then
        warning "rclone no esta instalado. Instalando..."
        sudo apt install rclone -y
        if [ $? -ne 0 ]; then
            error "No se pudo instalar rclone"
            exit 1
        fi
        success "rclone instalado correctamente"
    fi

    # Verificar archivo de configuracion
    if [[ ! -f "$RCLONE_CONFIG" ]]; then
        error "Archivo de configuracion no encontrado: $RCLONE_CONFIG"
        exit 1
    fi

    echo ""
    log "INSTRUCCIONES PARA RECONECTAR:"
    echo ""
    echo "Este proceso requiere autenticacion con Microsoft."
    echo "Se abrira un servidor local en el puerto 53682."
    echo ""
    echo "OPCION A - Si tienes navegador en este servidor:"
    echo "   El navegador se abrira automaticamente."
    echo ""
    echo "OPCION B - Si accedes por SSH (sin GUI):"
    echo "   1. PRIMERO abre otra terminal y crea el tunel SSH:"
    echo "      ssh -L 53682:127.0.0.1:53682 $(whoami)@$(hostname -I | awk '{print $1}')"
    echo ""
    echo "   2. Luego presiona ENTER aqui para iniciar rclone"
    echo ""
    echo "   3. Copia la URL COMPLETA que aparecera (incluye ?state=...)"
    echo "      y abrela en tu navegador local"
    echo ""
    warning "Presiona ENTER cuando tengas el tunel SSH listo (o Ctrl+C para cancelar)..."
    read -r

    log "Iniciando autorizacion OAuth..."
    echo ""
    warning "COPIA LA URL QUE APARECE ABAJO Y ABRELA EN TU NAVEGADOR"
    echo ""

    # Ejecutar rclone authorize y capturar el output
    TEMP_OUTPUT=$(mktemp)
    rclone authorize "onedrive" 2>&1 | tee "$TEMP_OUTPUT"

    # Extraer el token del output
    TOKEN=$(grep -A1 "Paste the following" "$TEMP_OUTPUT" | tail -1 | tr -d ' ')

    if [[ -z "$TOKEN" || "$TOKEN" != "{"* ]]; then
        error "No se pudo obtener el token. Verifica la autenticacion."
        rm -f "$TEMP_OUTPUT"
        exit 1
    fi

    # Hacer backup del archivo actual
    cp "$RCLONE_CONFIG" "${RCLONE_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

    # Actualizar el token en el archivo de configuracion
    DRIVE_ID=$(grep "drive_id" "$RCLONE_CONFIG" | head -1)
    DRIVE_TYPE=$(grep "drive_type" "$RCLONE_CONFIG" | head -1)

    cat > "$RCLONE_CONFIG" << EOF
[sharepoint_jesus_corp]
type = onedrive
token = $TOKEN
$DRIVE_ID
$DRIVE_TYPE
EOF

    success "Token actualizado en $RCLONE_CONFIG"
    rm -f "$TEMP_OUTPUT"

    # Reiniciar contenedor de backup
    log "Reiniciando contenedor de backup..."
    docker restart soldev-backup

    # Esperar y verificar
    sleep 10

    log "Verificando conexion..."
    if docker logs soldev-backup --tail 20 2>&1 | grep -q "exitosa"; then
        success "Backup reconectado y funcionando correctamente!"
    else
        warning "El contenedor se reinicio. Verifica los logs con:"
        echo "   docker logs soldev-backup --tail 30"
    fi
    ;;

  *)
    echo "Uso: $0 [start|stop|restart|logs|status|setup|instructions|backup-*]"
    echo ""
    echo "Comandos disponibles:"
    echo "  start           - Iniciar servicios con Cloudflare Tunnel"
    echo "  stop            - Detener todos los servicios"
    echo "  restart         - Reiniciar servicios con rebuild"
    echo "  logs            - Mostrar logs en tiempo real"
    echo "  status          - Mostrar estado de servicios y tunel"
    echo "  setup           - Configuracion inicial"
    echo "  instructions    - Mostrar instrucciones del tunel"
    echo ""
    echo "Comandos de Backup:"
    echo "  backup-status   - Ver estado del sistema de backup"
    echo "  backup-logs     - Ver logs del daemon de backup"
    echo "  backup-manual   - Ejecutar backup manual inmediato"
    echo "  backup-local    - Listar backups locales en el servidor"
    echo "  backup-list     - Listar backups en la nube"
    echo "  backup-config   - Configurar rclone interactivamente"
    echo "  backup-reconnect - Reconectar token de SharePoint/OneDrive"
    echo "  restore <opt>   - Restaurar base de datos desde backup"
    echo "                    Opciones: latest, archivo.sql.gz, --from-remote YYYYMMDD"
    echo ""
    echo "Con Cloudflare Tunnel:"
    echo "   - Sin puertos expuestos (mas seguro)"
    echo "   - SSL automatico"
    echo "   - Sin configuracion de firewall"
    echo "   - Sin IP publica necesaria"
    echo ""
    echo "Sistema de Backup:"
    echo "   - Backups automaticos cada 10 minutos"
    echo "   - Sincronizacion a OneDrive/SharePoint"
    echo "   - Retencion: 30 dias"
    exit 1
    ;;
esac
