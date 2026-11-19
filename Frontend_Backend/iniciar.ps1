# ===============================================================================
# SISTEMA BELLIA - PANEL DE CONTROL POWERSHELL
# NestJS + React 19 + PostgreSQL 17 (bellia) + Sharp + GDPR + Docker
# ===============================================================================

$Host.UI.RawUI.WindowTitle = "SISTEMA BELLIA - CONTROL PRINCIPAL"

function Show-Menu {
    Clear-Host
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host "               SISTEMA BELLIA - PANEL DE CONTROL PRINCIPAL                    " -ForegroundColor Yellow
    Write-Host "       NestJS + React 19 + PostgreSQL 17 (bellia) + Sharp + GDPR + Docker      " -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] Iniciar Servidor Backend NestJS (Puerto 8000)" -ForegroundColor White
    Write-Host "  [2] Iniciar Servidor Frontend React (Puerto 5173 - Acceso Web y Celulares)" -ForegroundColor White
    Write-Host "  [3] Aplicar Esquema a PostgreSQL 17 (Base de Datos: bellia)" -ForegroundColor White
    Write-Host "  [4] Levantar Todo con Docker Compose (Postgres, Redis, Backend, Frontend)" -ForegroundColor White
    Write-Host "  [5] Ver Documentacion Tecnica y Resumen de Archivos" -ForegroundColor White
    Write-Host "  [6] Salir" -ForegroundColor White
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Cyan
}

do {
    Show-Menu
    $opcion = Read-Host "Selecciona una opcion (1-6)"

    switch ($opcion) {
        "1" {
            Clear-Host
            Write-Host "=== INICIANDO BACKEND NESTJS (PUERTO 8000) ===" -ForegroundColor Green
            Write-Host "Conectando a PostgreSQL 17 en localhost:5432 - DB: bellia (usuario: valeria)..." -ForegroundColor Yellow
            Set-Location "$PSScriptRoot\backend"
            npm run dev
            Pause
        }
        "2" {
            Clear-Host
            Write-Host "=== INICIANDO FRONTEND REACT (PUERTO 5173) ===" -ForegroundColor Green
            Write-Host "Soporte responsivo para Android. Puedes abrir la URL 'Network' en tu telefono..." -ForegroundColor Yellow
            Set-Location "$PSScriptRoot\Frontend"
            npm run dev
            Pause
        }
        "3" {
            Clear-Host
            Write-Host "=== MIGRACIONES TYPEORM Y BASE DE DATOS (DB: bellia) ===" -ForegroundColor Yellow
            Write-Host "  [1] Ejecutar Migraciones Oficiales TypeORM (npm run migration:run)" -ForegroundColor White
            Write-Host "  [2] Aplicar Respaldo DDL Directo (schema.sql via psql)" -ForegroundColor White
            Write-Host "  [3] Ver Estado de Migraciones (npm run migration:show)" -ForegroundColor White
            $subOpt = Read-Host "Selecciona una opcion (1-3)"

            if ($subOpt -eq "1") {
                Set-Location "$PSScriptRoot\backend"
                npm run migration:run
            } elseif ($subOpt -eq "2") {
                $psqlPath = if (Test-Path "C:\Program Files\PostgreSQL\18\bin\psql.exe") { "C:\Program Files\PostgreSQL\18\bin\psql.exe" } else { "C:\Program Files\PostgreSQL\17\bin\psql.exe" }
                & $psqlPath -U postgres -d bellia -h localhost -p 5432 -f "$PSScriptRoot\backend\schema.sql"
                Write-Host "`nRespaldo SQL aplicado exitosamente a PostgreSQL!" -ForegroundColor Green
            } elseif ($subOpt -eq "3") {
                Set-Location "$PSScriptRoot\backend"
                npm run migration:show
            }
            Pause
        }
        "4" {
            Clear-Host
            Write-Host "=== LEVANTANDO ENTORNO CON DOCKER COMPOSE ===" -ForegroundColor Cyan
            Set-Location "$PSScriptRoot"
            docker-compose up --build
            Pause
        }
        "5" {
            Clear-Host
            Write-Host "===============================================================================" -ForegroundColor Cyan
            Write-Host "             RESUMEN TECNICO Y ARQUITECTURA DE ARCHIVOS IMPLEMENTADOS           " -ForegroundColor Yellow
            Write-Host "===============================================================================" -ForegroundColor Cyan
            Write-Host "`n1. BACKEND (NestJS Modular Enterprise - /backend):" -ForegroundColor White
            Write-Host "   - src/app.module.ts: Modulo raiz con TypeORM, Throttler, Cache y Rutas."
            Write-Host "   - src/main.ts: Bootstrap con Helmet, validacion class-validator y CORS movil."
            Write-Host "   - src/common/crypto/crypto.service.ts: Cifrado AES-256-GCM y ofuscacion PII."
            Write-Host "   - src/common/guards/jwt-auth.guard.ts: Guardia JWT Bearer para endpoints protegidos."
            Write-Host "   - src/common/guards/roles.guard.ts: Control de acceso RBAC por roles."
            Write-Host "   - src/modules/auth/: Autenticacion, login, registro con bcrypt y JWT."
            Write-Host "   - src/modules/users/: Mapeo de la tabla users y administracion."
            Write-Host "   - src/modules/profile/: CRUD de perfil y preferencias con cache e invalidacion."
            Write-Host "   - src/modules/storage/: Servicio S3 y CDN (AWS S3, MinIO, URLs prefirmadas Direct-to-S3)."
            Write-Host "   - src/modules/media/: Gestion de Fotografias, Modelos 3D (.glb/.gltf) y Texturas PBR."
            Write-Host "   - src/modules/upload/: Preprocesamiento de imagenes Sharp y subida a CDN."
            Write-Host "   - src/modules/queues/: Colas asincronas para tareas pesadas y auditoria."
            Write-Host "   - src/modules/privacy/: Panel GDPR (Portabilidad Art. 20, Derecho al Olvido Art. 17)."

            Write-Host "`n2. FRONTEND (React 19 + Tailwind v4 - /Frontend):" -ForegroundColor White
            Write-Host "   - src/pages/media/MediaPage.tsx: Panel Multimedia S3, inspeccion CDN y visor 3D/texturas."
            Write-Host "   - src/pages/profile/ProfilePage.tsx: Edicion de perfil, carga de avatar WebP en CDN."
            Write-Host "   - src/pages/preferences/PreferencesPage.tsx: Tema (Dark/Light/System) y notificaciones."
            Write-Host "   - src/pages/privacy/PrivacyPage.tsx: Exportacion JSON de datos y derecho al olvido."
            Write-Host "   - src/components/layout/Sidebar.tsx: Menu Drawer adaptable para moviles Android."
            Write-Host "   - src/components/layout/Topbar.tsx: Barra superior con menu hamburguesa."

            Write-Host "`n3. BASE DE DATOS (PostgreSQL 17):" -ForegroundColor White
            Write-Host "   - backend/schema.sql: DDL users, profiles, preferences, media_assets (HU-033), gdpr."
            Write-Host "   - Usuario admin inicial: valeria@bellia.com / 123456789."

            Write-Host "`n4. DOCKER & DESPLIEGUE:" -ForegroundColor White
            Write-Host "   - docker-compose.yml: Postgres 17, Redis 7, MinIO S3 + CDN, Backend NestJS, Frontend."
            Write-Host "   - backend/Dockerfile: Imagen Docker Node 22 para NestJS."
            Write-Host "   - Frontend/Dockerfile: Imagen multi-stage con Nginx para React."
            Write-Host "===============================================================================`n" -ForegroundColor Cyan
            Pause
        }
    }
} while ($opcion -ne "6")
