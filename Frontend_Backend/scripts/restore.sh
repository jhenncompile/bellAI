#!/usr/bin/env bash
# HU-040 (CP-040-04): restaura una copia hecha con scripts/backup.sh.
# Uso: scripts/restore.sh <directorio_de_copia> [base_destino]
#   Sin base_destino restaura sobre la base de la aplicación (pide confirmación).
#   Con base_destino (p. ej. bellia_restore_test) crea esa base aparte: útil para probar el respaldo.
set -euo pipefail
SRC="${1:?Indica el directorio de la copia}"; TARGET="${2:-}"
DB_USER="${DB_USER:-valeria}"; DB_NAME="${DB_NAME:-bellia}"
PG="${PG_CONTAINER:-bellia_postgres}"; API="${API_CONTAINER:-bellia_backend}"
[ -f "$SRC/db.dump" ] || { echo "No existe $SRC/db.dump"; exit 1; }
( cd "$SRC" && sha256sum --check --quiet <(grep -E '^[0-9a-f]{64}' manifest.txt | sed "s#  .*/#  #") ) || { echo "La suma de verificación no coincide"; exit 1; }
if [ -n "$TARGET" ]; then
  echo "→ Restaurando en la base de prueba $TARGET"
  docker exec "$PG" dropdb -U "$DB_USER" --if-exists "$TARGET"
  docker exec "$PG" createdb -U "$DB_USER" "$TARGET"
  docker exec -i "$PG" pg_restore -U "$DB_USER" -d "$TARGET" --no-owner < "$SRC/db.dump"
  echo "✔ Base $TARGET restaurada (los archivos no se tocan en este modo)"
  exit 0
fi
read -r -p "Esto reemplaza la base $DB_NAME y los archivos subidos. Escribe RESTAURAR para continuar: " OK
[ "$OK" = "RESTAURAR" ] || { echo "Cancelado"; exit 1; }
docker exec -i "$PG" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner < "$SRC/db.dump"
if [ -f "$SRC/uploads.tar.gz" ]; then
  docker exec -i "$API" sh -c 'rm -rf /app/uploads && tar -xzf - -C /app' < "$SRC/uploads.tar.gz"
fi
echo "✔ Restauración completa. Reinicia el backend: docker compose restart backend"
