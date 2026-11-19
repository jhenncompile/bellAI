# HU-040: Mantener disponible el armario, perfil e historial

| Campo | Valor |
|---|---|
| Rol | Sistema |
| Prioridad | Media |
| Razón (PDF) | Permitir la continuidad de la experiencia y conservar la información necesaria para personalizar futuras interacciones |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

Persistencia en PostgreSQL con volúmenes Docker y `restart: always`; sincronización y caché sin conexión del armario en el móvil; copias de seguridad restaurables.

## Cómo funciona

1. Los datos viven en PostgreSQL y los archivos en el volumen de uploads.
2. El móvil guarda una copia local y sincroniza al volver la conexión.
3. `scripts/backup.sh` y `scripts/restore.sh` hacen y restauran copias.

## Implementación

**Endpoints**

- `GET /api/wardrobe/sync`
- `PATCH /api/wardrobe/sync/settings`
- `GET /api/wardrobe/history`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/wardrobe/wardrobe.service.ts`
- `backend/src/modules/wardrobe/dto/wardrobe-sync.dto.ts`
- `scripts/backup.sh`
- `scripts/restore.sh`
- `docker-compose.yml`

**Tablas**

`todas`

## Pruebas y criterios de aceptación

- CP-040-01/02 Armario disponible tras volver a iniciar sesión: **OK**
- CP-040-03 Recuperación ante caídas: los contenedores tienen `restart: always` y los datos están en volúmenes; no está automatizado en el script.
- CP-040-04 Copia restaurada en una base de prueba con las mismas cifras que la original (6 usuarios, 20 prendas, 3 diagnósticos): **OK** (15/11/2026).

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- Las copias no están programadas (hay que ejecutar `backup.sh` o ponerlo en cron).

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-040-disponibilidad-armario-perfil-historial/README.md).
- Panel web: no aplica.

[← Volver al índice](../README.md)
