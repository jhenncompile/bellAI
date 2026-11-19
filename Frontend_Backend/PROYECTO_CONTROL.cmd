@echo off
rem ===============================================================================
rem SISTEMA BELLIA - PANEL DE CONTROL (NestJS + React + PostgreSQL 17 + Docker)
rem ===============================================================================

:MENU
cls
echo ===============================================================================
echo                SISTEMA BELLIA - PANEL DE CONTROL PRINCIPAL
echo        NestJS + React 19 + PostgreSQL 17 (bellia) + Sharp + GDPR + Docker
echo ===============================================================================
echo.
echo   [1] Iniciar Servidor Backend NestJS (Puerto 8000)
echo   [2] Iniciar Servidor Frontend React (Puerto 5173 - Acceso Web y Celulares)
echo   [3] Aplicar Esquema a PostgreSQL 17 (Base de Datos: bellia)
echo   [4] Levantar Todo con Docker Compose (Postgres, Redis, Backend, Frontend)
echo   [5] Ver Documentacion Tecnica y Resumen de Archivos
echo   [6] Salir
echo.
echo ===============================================================================
set /p OPT="Selecciona una opcion (1-6): "

if "%OPT%"=="1" goto BACKEND
if "%OPT%"=="2" goto FRONTEND
if "%OPT%"=="3" goto DATABASE
if "%OPT%"=="4" goto DOCKER
if "%OPT%"=="5" goto DOCS
if "%OPT%"=="6" goto SALIR

echo Opcion no valida.
timeout /t 2 > nul
goto MENU

:BACKEND
cls
echo ===============================================================================
echo                    INICIANDO BACKEND NESTJS (PUERTO 8000)
echo ===============================================================================
echo Conectando a PostgreSQL 17 en localhost:5432 - DB: bellia (usuario: valeria)
echo Seguridad activa: Helmet, Rate Limit, AES-256-GCM, Cache y GDPR
echo.
cd /d "%~dp0backend"
npm run dev
pause
goto MENU

:FRONTEND
cls
echo ===============================================================================
echo                    INICIANDO FRONTEND REACT (PUERTO 5173)
echo ===============================================================================
echo Interfaz moderna con TailwindCSS v4 y soporte responsivo para Android.
echo Para abrir desde tu telefono Android en la misma red Wi-Fi:
echo Usa la direccion que aparece abajo en 'Network:' (ejemplo: http://192.168.1.X:5173)
echo.
cd /d "%~dp0Frontend"
npm run dev
pause
goto MENU

:DATABASE
cls
echo ===============================================================================
echo       MIGRACIONES TYPEORM Y BASE DE DATOS POSTGRESQL 17 (DB: bellia)
echo ===============================================================================
echo.
echo   [1] Ejecutar Migraciones Oficiales de TypeORM (npm run migration:run)
echo   [2] Aplicar Respaldo DDL Directo (schema.sql via psql)
echo   [3] Ver Estado de Migraciones (npm run migration:show)
echo   [4] Volver al Menu Principal
echo.
set /p DB_OPT="Selecciona una opcion (1-4): "

if "%DB_OPT%"=="1" goto RUN_MIGRATIONS
if "%DB_OPT%"=="2" goto RUN_SQL_BACKUP
if "%DB_OPT%"=="3" goto SHOW_MIGRATIONS
goto MENU

:RUN_MIGRATIONS
echo.
echo Ejecutando migraciones TypeORM en backend...
cd /d "%~dp0backend"
call npm run migration:run
echo.
pause
goto MENU

:RUN_SQL_BACKUP
echo.
echo Aplicando respaldo DDL schema.sql a PostgreSQL 17...
set PGPASSWORD=123456789
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U valeria -d bellia -h localhost -p 5432 -f "%~dp0backend\schema.sql"
echo.
echo Respaldo SQL aplicado con exito.
pause
goto MENU

:SHOW_MIGRATIONS
echo.
echo Mostrando estado de migraciones...
cd /d "%~dp0backend"
call npm run migration:show
echo.
pause
goto MENU

:DOCKER
cls
echo ===============================================================================
echo              LEVANTANDO CONTENEDORES CON DOCKER COMPOSE
echo ===============================================================================
echo Servicios: PostgreSQL 17, Redis 7 Alpine, Backend NestJS y Frontend Nginx
echo.
cd /d "%~dp0"
docker-compose up --build
pause
goto MENU

:DOCS
cls
echo ===============================================================================
echo              RESUMEN TECNICO Y ARQUITECTURA DE ARCHIVOS IMPLEMENTADOS
echo ===============================================================================
echo.
echo 1. BACKEND (NestJS Modular Enterprise - /backend):
echo    - src/app.module.ts: Modulo raiz con TypeORM, Throttler, CacheModule y Rutas.
echo    - src/main.ts: Bootstrap con Helmet, validacion class-validator y CORS.
echo    - src/common/crypto/crypto.service.ts: Cifrado AES-256-GCM y ofuscacion de PII.
echo    - src/common/guards/jwt-auth.guard.ts: Guardia JWT Bearer para endpoints protegidos.
echo    - src/common/guards/roles.guard.ts: Control de acceso RBAC por roles.
echo    - src/modules/auth/: Autenticacion, login, registro con bcrypt y JWT.
echo    - src/modules/users/: Mapeo de la tabla users y administracion.
echo    - src/modules/profile/: CRUD de perfil y preferencias, persistencia y cache.
echo    - src/modules/storage/: Servicio S3 y CDN (AWS S3, MinIO, URLs prefirmadas Direct-to-S3).
echo    - src/modules/media/: Gestion de Fotografias, Modelos 3D (.glb/.gltf) y Texturas PBR.
echo    - src/modules/upload/: Preprocesamiento de imagenes Sharp y subida a CDN.
echo    - src/modules/queues/: Colas asincronas para tareas pesadas y auditoria.
echo    - src/modules/privacy/: Panel GDPR (Portabilidad Art. 20, Derecho al Olvido Art. 17).
echo.
echo 2. FRONTEND (React 19 + Tailwind v4 - /Frontend):
echo    - src/pages/media/MediaPage.tsx: Panel Multimedia S3, inspeccion CDN y visor 3D/texturas.
echo    - src/pages/profile/ProfilePage.tsx: Edicion de perfil, carga de avatar WebP en CDN.
echo    - src/pages/preferences/PreferencesPage.tsx: Tema (Dark/Light/System) y notificaciones.
echo    - src/pages/privacy/PrivacyPage.tsx: Exportacion JSON de datos y derecho al olvido.
echo    - src/components/layout/Sidebar.tsx: Menu Drawer adaptable para moviles Android.
echo    - src/components/layout/Topbar.tsx: Barra superior con menu hamburguesa.
echo.
echo 3. BASE DE DATOS (PostgreSQL 17):
echo    - backend/schema.sql: Esquema DDL con pgcrypto, users, profiles, preferences,
echo      media_assets (HU-033), gdpr_consents, audit_logs y activos demo.
echo.
echo 4. DOCKER & DESPLIEGUE:
echo    - docker-compose.yml: Orquestacion (Postgres 17, Redis, MinIO S3, Backend, Frontend).
echo    - backend/Dockerfile: Imagen Docker Node 22 para NestJS.
echo    - Frontend/Dockerfile: Imagen multi-stage con Nginx para React.
echo ===============================================================================
echo.
pause
goto MENU

:SALIR
exit
