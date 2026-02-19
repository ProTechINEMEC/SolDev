#!/bin/bash

# =============================================================================
# GESTOR PROYECTOS (SolDev) - CONFIGURACION DE RCLONE
# =============================================================================

echo "=================================="
echo "CONFIGURACION DE RCLONE"
echo "=================================="
echo ""
echo "Este script te ayudara a configurar rclone para backups remotos."
echo ""
echo "Opciones:"
echo "  1. Configurar nuevo remote"
echo "  2. Listar remotes configurados"
echo "  3. Probar conexion"
echo "  4. Salir"
echo ""

# Ejecutar configuracion de rclone
rclone config
