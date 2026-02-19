# Etapa de construccion
FROM node:18-alpine AS builder

WORKDIR /app

# Build argument for API URL (Vite requires env vars at build time)
ARG VITE_API_URL=http://localhost:11001
ENV VITE_API_URL=$VITE_API_URL

# Copiar archivos de configuracion
COPY package*.json ./
COPY vite.config.js ./

# Instalar dependencias
RUN npm ci

# Copiar codigo fuente
COPY . .

# Construir la aplicacion
RUN npm run build

# Etapa de produccion
FROM nginx:alpine

# Copiar configuracion personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos construidos desde la etapa de construccion
COPY --from=builder /app/dist /usr/share/nginx/html

# Exponer puerto
EXPOSE 80

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]
