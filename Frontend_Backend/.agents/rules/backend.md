---
trigger: glob
globs: "backend/**/*.ts, backend/**/*.sql, backend/**/*.py"
description: Módulos NestJS, guards de autenticación y roles, DTOs, cifrado de datos personales y cambios de esquema de la base de datos.
---

# Backend — NestJS + PostgreSQL 17

Reglas completas en `.rules/20-backend.md`. Tabla de endpoints y estado real en `AGENTS.md`.

- Un módulo por dominio en `src/modules/<modulo>/` con controlador, servicio, `dto/` y `entities/`; se registra en `app.module.ts`. La lógica va en el servicio.
- Los controladores declaran el prefijo en la ruta: `@Controller('api/usuarios')`. No hay `setGlobalPrefix`.
- Ruta nueva ⇒ `@UseGuards(JwtAuthGuard)`, salvo que sea pública a propósito (hoy solo `register` y `login`). Para roles, `RolesGuard` + `@Roles('admin')`, nunca comprobando `user.role` a mano.
- Datos personales sensibles (teléfono, dirección, documento): cifrado con `CryptoService` (AES-256-GCM) y registro en `AuditLog`. Nada de PII en claro.
- Todo body entra por un DTO con `class-validator`. El `ValidationPipe` global usa `whitelist`: si un campo "no llega", revisa el DTO antes que el frontend.
- `synchronize` de TypeORM se queda en `false`. Cambio de esquema = `backend/schema.sql` **y** una migración en `backend/src/migrations/`.
- Si cambias un contrato, actualiza también el `service` del frontend y la tabla de `AGENTS.md`.
- Si tocas `backend/ai/**`, `pytest` tiene que pasar: ese workflow despliega a AWS ECR/ECS.
