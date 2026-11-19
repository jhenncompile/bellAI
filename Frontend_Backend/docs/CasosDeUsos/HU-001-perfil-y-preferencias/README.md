# HU-001: Gestionar mi perfil y preferencias de estilo

| Campo | Valor |
|---|---|
| Rol | Usuaria |
| Prioridad | Alta |
| Razón (PDF) | Personalizar los análisis y recomendaciones según mis gustos, colores, ocasiones y presupuesto |
| Planificación | Sprint 1 |
| Estado | **🟢 Completa** |
| Revisado | 15/11/2026 |

## Situación actual

La usuaria edita sus datos y su foto, y declara estilos, colores (favoritos y evitados), ocasiones y presupuesto. Esas preferencias alimentan el Style DNA, las recomendaciones y los outfits.

## Cómo funciona

1. La usuaria abre Perfil y edita nombre, teléfono, dirección y foto.
2. En Preferencias marca estilos, colores, ocasiones y presupuesto.
3. El backend guarda las preferencias y el Style DNA se recalcula con lo declarado como fuente de mayor peso.
4. Las recomendaciones y los outfits usan esas preferencias en la siguiente consulta.

## Implementación

**Endpoints**

- `GET/PUT /api/profile`
- `POST /api/profile/avatar`
- `GET/PUT /api/profile/preferences`

**Archivos principales** (relativos a `Frontend_Backend/`)

- `backend/src/modules/profile/profile.service.ts`
- `backend/src/modules/profile/dto/update-profile.dto.ts`
- `backend/src/modules/style/style-dna.ts`

**Panel web**

- Frontend/src/features/profile/pages/ProfilePage.tsx y PreferencesPage.tsx (perfil del administrador que usa el panel).

**Tablas**

`users`, `profiles` (teléfono y dirección cifrados con AES-256-GCM), `preferences`

## Pruebas y criterios de aceptación

- CP-001-01 Editar nombre: **OK** (plan_de_pruebas.py)
- CP-001-02 Nombre vacío → «El nombre es obligatorio»: **OK** (validación `IsNotEmpty` en `UpdateProfileDto`)
- CP-001-03 Preferencias usadas en el Style DNA: **OK**
- CP-001-04 Quitar un estilo actualiza el perfil: **OK**

Los casos CP se ejecutan con `backend/ai/.venv/bin/python backend/tests/e2e/plan_de_pruebas.py` (sistema levantado con `docker compose up -d`).

## Qué falta o limitaciones

- La subida de foto en JPG de CP-001-01 existe (`POST /api/profile/avatar`), pero el script automático solo prueba el cambio de nombre.

## Plataformas

- Móvil: **🟢 Completa** · ver [documento móvil](../../../../Movil/docs/CasosDeUsos/HU-001-perfil-y-preferencias/README.md).
- Panel web: sí.

[← Volver al índice](../README.md)
