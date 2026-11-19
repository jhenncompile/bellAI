#!/usr/bin/env bash
# HU-040 (CP-040-04): copia de seguridad de la base de datos y de los archivos subidos.
# Uso: scripts/backup.sh [directorio_destino]   (por defecto ./backups)
# Genera bellai-AAAAMMDD-HHMMSS/{db.dump, uploads.tar.gz, manifest.txt}
set -euo pipefail
DB_USER="${DB_USER:-valeria}"; DB_NAME="${DB_NAME:-bellia}"
PG="${PG_CONTAINER:-bellia_postgres}"; API="${API_CONTAINER:-bellia_backend}"
DEST="${1:-./backups}/bellai-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
echo "→ Base de datos ($DB_NAME)"
docker exec "$PG" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$DEST/db.dump"
echo "→ Archivos subidos (/app/uploads)"
if docker exec "$API" test -d /app/uploads; then
  docker exec "$API" tar -czf - -C /app uploads > "$DEST/uploads.tar.gz"
else
  echo "  (el contenedor $API no tiene /app/uploads; se omite)"
fi
{ echo "fecha=$(date -Iseconds)"; echo "base=$DB_NAME"; sha256sum "$DEST"/*.dump "$DEST"/*.tar.gz 2>/dev/null; } > "$DEST/manifest.txt"
echo "✔ Copia creada en $DEST"
