# Dockerfile para servicio de backup con rclone
FROM alpine:3.18

# Instalar dependencias
RUN apk add --no-cache \
    rclone \
    curl \
    bash \
    coreutils \
    tzdata \
    zip \
    gzip \
    file \
    postgresql15-client

# Configurar timezone
ENV TZ=America/Bogota
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Crear directorios de trabajo
RUN mkdir -p /app/scripts /app/config /app/logs /app/temp

# Copiar scripts de backup
COPY scripts/ /app/scripts/
COPY config/ /app/config/

# Hacer ejecutables los scripts y convertir terminaciones de linea
RUN chmod +x /app/scripts/*.sh /app/config/*.sh && \
    sed -i 's/\r$//' /app/scripts/*.sh /app/config/*.sh && \
    echo "=== Verificando scripts ===" && \
    ls -la /app/scripts/ && \
    file /app/scripts/backup_daemon.sh && \
    head -3 /app/scripts/backup_daemon.sh

# Directorio de trabajo
WORKDIR /app

# Comando por defecto
CMD ["/bin/bash", "-c", "echo 'Verificando directorio /app/scripts:' && ls -la /app/scripts/ && echo 'Ejecutando daemon:' && exec /app/scripts/backup_daemon.sh"]
