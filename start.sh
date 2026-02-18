#!/bin/bash

# SolDev - Portal de Gestión INEMEC
# Quick Start Script

set -e

echo "=========================================="
echo "  SolDev - Portal de Gestión INEMEC"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Create .env if not exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}Created .env file. Please update with your configuration.${NC}"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p database/data uploads logs

# Build and start services
echo ""
echo -e "${YELLOW}Building and starting services...${NC}"
docker-compose up -d --build

# Wait for services to be ready
echo ""
echo "Waiting for services to start..."
sleep 10

# Health check
echo ""
echo -e "${YELLOW}Checking service health...${NC}"

# Check database
if docker-compose exec -T database pg_isready -U soldev_user -d soldev_db > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is healthy${NC}"
else
    echo -e "${RED}✗ Database is not ready${NC}"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is healthy${NC}"
else
    echo -e "${RED}✗ Redis is not ready${NC}"
fi

# Check Backend
if curl -s http://localhost:11001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${YELLOW}⏳ Backend is starting...${NC}"
fi

# Check Frontend
if curl -s http://localhost:11000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
    echo -e "${YELLOW}⏳ Frontend is starting...${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}  SolDev is running!${NC}"
echo "=========================================="
echo ""
echo "  Frontend:  http://localhost:11000"
echo "  Backend:   http://localhost:11001"
echo "  API Docs:  http://localhost:11001/docs"
echo "  Database:  localhost:11002"
echo ""
echo "  Default Users:"
echo "    admin@inemec.com / Admin123!"
echo "    nt@inemec.com / Test123!"
echo "    ti@inemec.com / Test123!"
echo "    gerencia@inemec.com / Test123!"
echo ""
echo "  Commands:"
echo "    docker-compose logs -f    # View logs"
echo "    docker-compose down       # Stop services"
echo "    docker-compose restart    # Restart services"
echo ""
