#!/usr/bin/env bash
# ==============================================================================
# BellAI - Script de Aprovisionamiento y Configuración Automática para VPS / AWS Linux
# Compatible con: Ubuntu 24.04 LTS, Ubuntu 22.04 LTS y Debian 12 (AWS EC2, etc.)
# ==============================================================================

set -e

# Configurar modo no interactivo para evitar pausas de needrestart o kernel prompts
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

# Colores de salida
CORAL='\033[38;2;224;122;95m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin color

echo -e "${CORAL}"
echo "========================================================================"
echo "           BELLAI - SETUP DE INFRAESTRUCTURA VPS / AWS LINUX            "
echo "========================================================================"
echo -e "${NC}"

# 1. Comprobación de permisos de root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Este script debe ejecutarse como root o con sudo:${NC}"
  echo "        sudo ./setup.sh"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
echo -e "${CYAN}[1/8] Directorio base del proyecto: ${PROJECT_DIR}${NC}"

# Configurar needrestart en modo automático si existe para no pausar el script
if [ -f /etc/needrestart/needrestart.conf ]; then
  sed -i "s/#\$nrconf{restart} = 'i';/\$nrconf{restart} = 'a';/g" /etc/needrestart/needrestart.conf || true
fi

# 2. Actualización de paquetes del sistema
echo -e "\n${CYAN}[2/8] Actualizando repositorios del sistema operativo...${NC}"
apt-get update -y
apt-get upgrade -y -o DPkg::Options::="--force-confdef" -o DPkg::Options::="--force-confold"

# 3. Herramientas base y librerías de visión por computadora (OpenCV/MediaPipe)
echo -e "\n${CYAN}[3/8] Instalando dependencias del sistema, compiladores y bibliotecas gráficas...${NC}"
apt-get install -y -o DPkg::Options::="--force-confdef" -o DPkg::Options::="--force-confold" \
  curl \
  wget \
  git \
  build-essential \
  software-properties-common \
  ufw \
  htop \
  jq \
  unzip \
  net-tools \
  libgl1 \
  libglx-mesa0 \
  libsm6 \
  libxext6 \
  libxrender-dev \
  libgomp1 \
  libpq-dev

# 4. Instalación de Python 3, venv y pip
echo -e "\n${CYAN}[4/8] Instalando Python 3, pip y python3-venv...${NC}"
apt-get install -y python3 python3-pip python3-venv python3-dev
echo -e "${GREEN}✔ Python instalado: $(python3 --version)${NC}"

# 5. Instalación de Node.js (v20 LTS) y pnpm
echo -e "\n${CYAN}[5/8] Verificando e instalando Node.js LTS y gestor pnpm...${NC}"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
  echo -e "${YELLOW}Configurando repositorio oficial NodeSource (Node.js 20.x)...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo -e "${GREEN}✔ Node.js versión: $(node -v)${NC}"
echo -e "${GREEN}✔ npm versión: $(npm -v)${NC}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo -e "${CYAN}Instalando pnpm globalmente...${NC}"
  npm install -g pnpm@latest
fi
echo -e "${GREEN}✔ pnpm versión: $(pnpm -v)${NC}"

# 6. Instalación de Servidor Web NGINX y Certbot (SSL)
echo -e "\n${CYAN}[6/8] Instalando NGINX y Certbot para certificados SSL...${NC}"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx
echo -e "${GREEN}✔ NGINX activo y configurado para arranque automático.${NC}"

# 7. Instalación de PostgreSQL y Redis
echo -e "\n${CYAN}[7/8] Instalando PostgreSQL y Redis Server...${NC}"
apt-get install -y postgresql postgresql-contrib redis-server
systemctl enable postgresql
systemctl start postgresql
systemctl enable redis-server
systemctl start redis-server
echo -e "${GREEN}✔ PostgreSQL y Redis iniciados correctamente.${NC}"

# Configuración de base de datos local y sincronización de contraseñas sin pedir la anterior
echo -e "${CYAN}Asegurando usuario postgres, base de datos 'bellia' y credenciales...${NC}"

# Si backend/.env no existe, crearlo a partir de backend/.env.example
if [ ! -f "$PROJECT_DIR/backend/.env" ] && [ -f "$PROJECT_DIR/backend/.env.example" ]; then
  cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
fi

# Extraer DB_PASSWORD de backend/.env si está configurada, o fijar una contraseña segura
DB_PASS=$(grep -E "^DB_PASSWORD=" "$PROJECT_DIR/backend/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
if [ -z "$DB_PASS" ] || [ "$DB_PASS" = "tu_contraseña_segura" ]; then
  DB_PASS="BellaiSecurePass_2026!"
  if [ -f "$PROJECT_DIR/backend/.env" ]; then
    sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASS/" "$PROJECT_DIR/backend/.env"
  fi
fi

# Crear base de datos 'bellia' si no existe
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname = 'bellia'\" | grep -q 1 || psql -c \"CREATE DATABASE bellia ENCODING 'UTF8';\"" || true

# Restablecer la contraseña del usuario postgres sin pedir la anterior (autenticación peer de root)
su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD '$DB_PASS';\"" || true
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE bellia TO postgres;\"" || true
echo -e "${GREEN}✔ Contraseña de 'postgres' restablecida y sincronizada con backend/.env.${NC}"

# 8. Configuración de memoria SWAP (4GB) para evitar Out-Of-Memory en VPS
echo -e "\n${CYAN}[8/8] Verificando memoria SWAP...${NC}"
if [ "$(swapon --show | wc -l)" -le 1 ]; then
  echo -e "${YELLOW}No se detectó SWAP activa. Creando archivo swapfile de 4GB...${NC}"
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo "/swapfile swap swap defaults 0 0" >> /etc/fstab
  fi
  echo -e "${GREEN}✔ SWAP de 4GB creada y registrada en /etc/fstab.${NC}"
else
  echo -e "${GREEN}✔ Memoria SWAP ya presente en el sistema.${NC}"
fi

# 9. Configuración del Entorno Virtual para el CLI de Operaciones
echo -e "\n${CYAN}Creando entorno virtual Python para el gestor CLI (cli/.venv)...${NC}"
python3 -m venv "$PROJECT_DIR/cli/.venv"
"$PROJECT_DIR/cli/.venv/bin/pip" install --upgrade pip
if [ -f "$PROJECT_DIR/cli/requirements.txt" ]; then
  "$PROJECT_DIR/cli/.venv/bin/pip" install -r "$PROJECT_DIR/cli/requirements.txt"
fi

# 10. Permisos a los scripts
chmod +x "$PROJECT_DIR/manager.sh" || true
chmod +x "$PROJECT_DIR/setup.sh" || true

echo -e "\n${GREEN}========================================================================${NC}"
echo -e "${GREEN}✔ APROVISIONAMIENTO COMPLETADO EXITOSAMENTE                             ${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo -e "Credenciales de PostgreSQL configuradas:"
echo -e "  Usuario:    ${CYAN}postgres${NC}"
echo -e "  Base datos: ${CYAN}bellia${NC}"
echo -e "  Contraseña: ${CYAN}${DB_PASS}${NC} (registrada en backend/.env)"
echo ""
echo -e "Para iniciar el gestor de despliegue, compilar y administrar servicios, ejecuta:"
echo -e "${CORAL}  ./manager.sh${NC}"
echo ""
