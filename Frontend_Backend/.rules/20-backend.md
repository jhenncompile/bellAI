# Reglas del backend (`backend/**`)

API NestJS 10 + TypeORM + PostgreSQL 17, con un microservicio de IA aparte en `backend/ai/` (Python + FastAPI).

## Estructura

```
backend/src/
├── main.ts          # Helmet, CORS, ValidationPipe, /uploads estático
├── app.module.ts    # TypeORM, Cache, Throttler, registro de módulos
├── common/          # guards (JwtAuthGuard, RolesGuard), decoradores, crypto
└── modules/         # auth, users, profile, upload, queues, privacy
    └── <modulo>/
        ├── <modulo>.module.ts
        ├── <modulo>.controller.ts
        ├── <modulo>.service.ts
        ├── dto/
        └── entities/
```

1. Un módulo por dominio, con su controlador, servicio, DTOs y entidades. Regístralo en `app.module.ts`.
2. Los controladores declaran la ruta completa con prefijo: `@Controller('api/usuarios')`. No hay `setGlobalPrefix`.
3. La lógica va en el **servicio**. El controlador solo valida, delega y responde.

## Seguridad

4. Toda ruta nueva va protegida con `@UseGuards(JwtAuthGuard)` salvo que sea pública a propósito (hoy solo `register` y `login`).
5. Para restringir por rol usa `RolesGuard` + `@Roles('admin')` de `common/`. No compruebes `user.role` a mano en el servicio.
6. Los datos personales sensibles (teléfono, dirección, documento) se cifran con `CryptoService` (AES-256-GCM) antes de guardarse, y se devuelven enmascarados donde corresponda. No añadas PII en claro a la base.
7. Toda acción sobre datos personales deja registro en `AuditLog` (módulo `privacy`).

## Validación

8. Todo body de entrada se tipa con un DTO en `dto/` y se valida con `class-validator`. El `ValidationPipe` global está en modo `whitelist`: lo que no esté en el DTO se descarta silenciosamente, así que si un campo "no llega", revisa el DTO antes que el frontend.

## Base de datos

9. `synchronize` de TypeORM está en `false` **a propósito**. No lo pongas en `true`.
10. Un cambio de esquema se escribe en **dos sitios**: `backend/schema.sql` (fuente de verdad, lo monta Postgres al crear el contenedor) y una migración nueva en `backend/src/migrations/`, registrada en el array `migrations` de `app.module.ts` (se ejecutan solas al arrancar: `migrationsRun: true`). Escríbela idempotente (`IF NOT EXISTS`), porque una base creada desde `schema.sql` ya tiene el cambio.
11. Las entidades nuevas se registran en el array `entities` de `app.module.ts`.

## Contratos con el frontend

12. Si cambias una respuesta o una ruta, actualiza en el mismo trabajo el `service` de la feature correspondiente del frontend y la tabla de endpoints de `AGENTS.md`.
13. La app móvil (`Movil/`, Expo) consume `auth`, `profile`, `privacy`, `upload` y `wardrobe`. Si cambias esos contratos, avisa o actualiza también sus `services`.

## Microservicio de IA (`backend/ai/`)

14. Es el único código con tests y CI: `pytest` en `.github/workflows/ai-models-ci-cd.yml`. Si tocas `backend/ai/**`, los tests tienen que pasar, porque el workflow despliega a AWS ECR/ECS.
15. Los endpoints viven en `app/api/v1/endpoints/` y se registran en `app/api/v1/router.py`.
