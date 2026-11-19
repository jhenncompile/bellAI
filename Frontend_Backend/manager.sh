#!/usr/bin/env bash
# ==============================================================================
# BellaIA - Gestor Interactivo de Infraestructura, Despliegue y DevOps
# Servicios: backendBellaIA (NestJS:8000) e IaBellaIA (FastAPI:8001)
# ==============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

VENV_PATH="$PROJECT_DIR/cli/.venv"
if [ ! -d "$VENV_PATH" ] && [ -d "$PROJECT_DIR/.venv" ]; then
  VENV_PATH="$PROJECT_DIR/.venv"
fi

# 1. Crear venv si no existe
if [ ! -d "$VENV_PATH" ]; then
  echo -e "\033[0;36m[i] Entorno virtual no detectado. Creando ${VENV_PATH}... \033[0m"
  python3 -m venv "$VENV_PATH"
  "$VENV_PATH/bin/pip" install --upgrade pip
fi

# 2. Activar venv
# shellcheck disable=SC1090
source "$VENV_PATH/bin/activate"

# 3. Comprobar e instalar requerimientos del CLI si faltan
if [ -f "$PROJECT_DIR/cli/requirements.txt" ]; then
  if ! python -c "import rich, requests, dotenv" >/dev/null 2>&1; then
    echo -e "\033[0;33m[i] Instalando dependencias del gestor CLI (rich, psycopg2, requests, dotenv)... \033[0m"
    pip install -r "$PROJECT_DIR/cli/requirements.txt" --quiet
  fi
fi

# 4. Soporte para comandos rápidos por argumento de terminal
case "$1" in
  install-all|install-deps|deps)
    echo -e "\033[0;36m[1/3] Instalando dependencias de Backend NestJS (npm install)...\033[0m"
    (cd backend && npm install)
    echo -e "\033[0;36m[2/3] Instalando librerías y modelos de IA en su venv (pip install & download_models)...\033[0m"
    python -c "from cli.modules.compilacion.menu import instalar_deps_ia, descargar_modelos_ia; instalar_deps_ia(); descargar_modelos_ia()"
    echo -e "\033[0;36m[3/3] Instalando dependencias de Frontend React (pnpm/npm install)...\033[0m"
    (cd Frontend && pnpm install || npm install)
    echo -e "\033[0;32m✔ Todas las dependencias y librerías quedaron instaladas.\033[0m"
    ;;
  build-all)
    echo -e "\033[0;36mInstalando y Compilando Backend, IA y Frontend...\033[0m"
    python -c "from cli.modules.compilacion.menu import instalar_y_compilar_todo; instalar_y_compilar_todo()"
    ;;
  restart)
    sudo systemctl restart IaBellaIA backendBellaIA redis-server nginx
    sudo systemctl status backendBellaIA IaBellaIA --no-pager
    ;;
  status)
    python -c "from cli.modules.sistema.servicios_controller import ver_estado; ver_estado()"
    ;;
  logs)
    sudo journalctl -u backendBellaIA -u IaBellaIA -f
    ;;
  *)
    # Modo Interactivo Principal
    export PYTHONPATH="$PROJECT_DIR"
    python "$PROJECT_DIR/cli/main.py"
    ;;
esac
