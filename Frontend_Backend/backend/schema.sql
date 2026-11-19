-- ===============================================================================
-- SISTEMA BELLIA - RESPALDO MAESTRO DDL SQL (POSTGRESQL 17)
-- ===============================================================================
-- NOTA IMPORTANTE:
-- Este archivo es el RESPALDO SQL estático del esquema de base de datos.
-- La gestión operativa de evolución y versionado se realiza a través de las
-- MIGRACIONES OFICIALES DE TYPEORM ubicadas en: backend/src/migrations/
-- 
-- Para ejecutar las migraciones automáticamente con TypeORM:
--   npm run migration:run
-- Para revertir la última migración:
--   npm run migration:revert
--
-- Al iniciar la aplicación NestJS, las migraciones pendientes se aplican
-- automáticamente gracias a la configuración de 'migrationsRun: true'.
-- ===============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- HU-30: última actividad (inicio de sesión o petición autenticada) para contar usuarias activas
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users (last_seen_at);

-- 2. TABLA: PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    phone_encrypted TEXT,
    phone_masked VARCHAR(50),
    avatar_url VARCHAR(500),
    birth_date DATE,
    address_encrypted TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: PREFERENCES
CREATE TABLE IF NOT EXISTS preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    language VARCHAR(10) NOT NULL DEFAULT 'es',
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    tracking_consent BOOLEAN NOT NULL DEFAULT FALSE,
    auto_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    offline_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    style_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA: GDPR_CONSENTS
CREATE TABLE IF NOT EXISTS gdpr_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL,
    accepted BOOLEAN NOT NULL,
    policy_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    ip_hash VARCHAR(128),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA: AUDIT_LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    details JSONB,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA: MEDIA_ASSETS (HU-033: Supervisión de Recursos Multimedia y Modelos)
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    s3_key VARCHAR(500) UNIQUE NOT NULL,
    s3_bucket VARCHAR(150) NOT NULL,
    s3_url TEXT NOT NULL,
    cdn_url TEXT NOT NULL,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('photo', 'garment', 'model_3d', 'ai_component', 'texture', 'avatar')),
    system_function VARCHAR(100) NOT NULL DEFAULT 'general' CHECK (system_function IN ('catalogo_prendas', 'probador_virtual_3d', 'motor_inferencia_ia', 'perfil_usuario', 'galeria_marketing', 'general')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    used_by_components JSONB DEFAULT '[]',
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'maintenance')),
    mime_type VARCHAR(150) NOT NULL,
    extension VARCHAR(20) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user_id ON gdpr_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_s3_key ON media_assets(s3_key);
CREATE INDEX IF NOT EXISTS idx_media_assets_media_type ON media_assets(media_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_system_function ON media_assets(system_function);
CREATE INDEX IF NOT EXISTS idx_media_assets_is_active ON media_assets(is_active);


-- 7. TABLA: WARDROBE_ITEMS (HU-009, HU-011 y HU-040: Armario Digital Inteligente)
CREATE TABLE IF NOT EXISTS wardrobe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150),
    category VARCHAR(30) NOT NULL CHECK (
        category IN ('superior', 'inferior', 'calzado', 'abrigo', 'accesorio')
    ),
    subcategory VARCHAR(50) NOT NULL DEFAULT 'otros' CHECK (
        subcategory IN (
            'blusas', 'camisas', 'camisetas', 'tops', 'vestidos',
            'pantalones', 'jeans', 'faldas', 'shorts',
            'chaquetas', 'abrigos', 'sueteres', 'blazers',
            'zapatillas', 'tacones', 'botas', 'sandalias', 'bolsos', 'cinturones', 'joyeria', 'sombreros', 'bufandas', 'lentes', 'relojes', 'otros'
        )
    ),
    color VARCHAR(60),
    color_hex VARCHAR(7),
    approximate_size VARCHAR(20),
    season VARCHAR(30) CHECK (
        season IN ('primavera', 'verano', 'otono', 'invierno', 'todo_el_ano')
    ),
    occasion VARCHAR(30) CHECK (
        occasion IN ('casual', 'formal', 'fiesta', 'deporte', 'trabajo', 'playa', 'gala')
    ),
    capture_source VARCHAR(20) NOT NULL DEFAULT 'camera' CHECK (
        capture_source IN ('camera', 'gallery')
    ),
    original_image_url VARCHAR(500),
    enhanced_image_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (
        status IN ('draft', 'processing', 'confirmed', 'upload_failed')
    ),
    last_worn_at TIMESTAMP WITH TIME ZONE,
    wear_count INTEGER NOT NULL DEFAULT 0,
    ai_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_user_id ON wardrobe_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_user_category ON wardrobe_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_wardrobe_user_subcategory ON wardrobe_items(user_id, subcategory);
CREATE INDEX IF NOT EXISTS idx_wardrobe_user_status ON wardrobe_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wardrobe_user_occasion ON wardrobe_items(user_id, occasion);

-- INSERCIÓN DE USUARIO ADMINISTRADOR DEMO
-- Hash bcrypt para '123456789'
DO $$
DECLARE
    admin_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'valeria@bellia.com') THEN
        INSERT INTO users (id, name, email, password, role, status)
        VALUES (
            admin_id,
            'Valeria Administradora',
            'valeria@bellia.com',
            '$2b$10$QjOBbkasXIRQc63uMLtd0eri372yvi0oEe2f7lh9bxxLYCmwkbFb2', -- Hash bcrypt para '123456789'
            'admin',
            'active'
        );

        INSERT INTO profiles (user_id, bio, phone_masked, avatar_url)
        VALUES (
            admin_id,
            'Administradora principal del Sistema Bellia',
            '+591 7***89',
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
        );

        INSERT INTO preferences (user_id, theme, language, email_notifications, push_notifications, marketing_consent, tracking_consent)
        VALUES (
            admin_id,
            'system',
            'es',
            TRUE,
            TRUE,
            TRUE,
            TRUE
        );

        INSERT INTO gdpr_consents (user_id, consent_type, accepted, policy_version)
        VALUES 
            (admin_id, 'terms_of_service', TRUE, 'v1.0'),
            (admin_id, 'privacy_policy', TRUE, 'v1.0'),
            (admin_id, 'data_processing', TRUE, 'v1.0');

        -- Activos multimedia y modelos supervisados (Fotografías, Prendas, Modelos 3D, Componentes IA)
        INSERT INTO media_assets (id, user_id, title, original_filename, s3_key, s3_bucket, s3_url, cdn_url, media_type, system_function, is_active, used_by_components, status, mime_type, extension, size_bytes, metadata)
        VALUES 
            (
                '22222222-2222-2222-2222-222222222221'::UUID,
                admin_id,
                'Modelo 3D Casco Cyberpunk Sci-Fi (Probador Virtual)',
                'cyberpunk_helmet.glb',
                'models-3d/demo_cyberpunk_helmet.glb',
                'bellia-media',
                'https://bellia-media.s3.us-east-1.amazonaws.com/models-3d/demo_cyberpunk_helmet.glb',
                'https://cdn.bellia.tech/models-3d/demo_cyberpunk_helmet.glb',
                'model_3d',
                'probador_virtual_3d',
                TRUE,
                '["Módulo Probador Virtual 3D WebGL", "Lienzo Three.js Móvil"]'::JSONB,
                'active',
                'model/gltf-binary',
                '.glb',
                12845600,
                '{"format": "glTF 2.0 Binary", "readyForWebGL": true, "supportsThreeJS": true, "polygonCount": 48200}'
            ),
            (
                '22222222-2222-2222-2222-222222222222'::UUID,
                admin_id,
                'Prenda Digital: Chaqueta Cuero Urbana Colección 2026',
                'chaqueta_cuero_urbana.glb',
                'garments/demo_chaqueta_cuero_urbana.glb',
                'bellia-media',
                'https://bellia-media.s3.us-east-1.amazonaws.com/garments/demo_chaqueta_cuero_urbana.glb',
                'https://cdn.bellia.tech/garments/demo_chaqueta_cuero_urbana.glb',
                'garment',
                'catalogo_prendas',
                TRUE,
                '["Catálogo de Prendas Bellia", "Recomendador de Tallas IA"]'::JSONB,
                'active',
                'model/gltf-binary',
                '.glb',
                8450120,
                '{"category": "abrigos", "clothType": "leather", "gender": "unisex", "resolution": "4K PBR"}'
            ),
            (
                '22222222-2222-2222-2222-222222222223'::UUID,
                admin_id,
                'Red Neuronal PyTorch - Visión Computacional (HU-032)',
                'cnn_vision_model_v1.pt',
                'ai-models/demo_cnn_vision_model_v1.pt',
                'bellia-media',
                'https://bellia-media.s3.us-east-1.amazonaws.com/ai-models/demo_cnn_vision_model_v1.pt',
                'https://cdn.bellia.tech/ai-models/demo_cnn_vision_model_v1.pt',
                'ai_component',
                'motor_inferencia_ia',
                TRUE,
                '["Microservicio FastAPI IA (backend/ai)", "Pipeline CI/CD AWS ECS"]'::JSONB,
                'active',
                'application/octet-stream',
                '.pt',
                45200300,
                '{"framework": "PyTorch 2.2", "architecture": "ResNet50-Custom", "inputShape": [1, 3, 224, 224], "accuracy": "96.4%"}'
            ),
            (
                '22222222-2222-2222-2222-222222222224'::UUID,
                admin_id,
                'Fotografía de Estudio - Producto Lookbook 4K',
                'studio_product_shot.webp',
                'photos/demo_studio_product_shot.webp',
                'bellia-media',
                'https://bellia-media.s3.us-east-1.amazonaws.com/photos/demo_studio_product_shot.webp',
                'https://cdn.bellia.tech/photos/demo_studio_product_shot.webp',
                'photo',
                'galeria_marketing',
                TRUE,
                '["Banner Principal Ecommerce", "App Móvil Android Splash"]'::JSONB,
                'active',
                'image/webp',
                '.webp',
                845200,
                '{"width": 3840, "height": 2160, "format": "webp", "aspectRatio": "1.78", "exifStripped": true, "optimizedTo": "webp"}'
            );
    END IF;
END $$;

-- 8. TABLA: PLATFORM_SETTINGS (HU-030: Configuración y Políticas Operativas)
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_updated_by ON platform_settings(updated_by);

INSERT INTO platform_settings (key, value)
VALUES
    ('maintenance_mode', 'false'::jsonb),
    ('user_creation_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- 9. TABLAS: BELLAI (HU-18 Motivo, HU-25 Asesora Virtual, HU-26 Historial Unificado)
CREATE TABLE IF NOT EXISTS bellai_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    face_shape VARCHAR(60) NOT NULL,
    skin_tone VARCHAR(80) NOT NULL,
    undertone VARCHAR(40) NOT NULL,
    seasonal_palette VARCHAR(80) NOT NULL,
    summary TEXT,
    proportions JSONB NOT NULL DEFAULT '{}'::jsonb,
    hair_features JSONB NOT NULL DEFAULT '{}'::jsonb,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bellai_diagnostics_user_created ON bellai_diagnostics(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bellai_outfits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    occasion VARCHAR(60),
    season VARCHAR(60),
    garment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    color_harmony VARCHAR(120),
    reason_summary TEXT,
    considered_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bellai_outfits_user_created ON bellai_outfits(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bellai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL DEFAULT 'Asesora personal BellAI',
    context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bellai_conversations_user_updated ON bellai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS bellai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES bellai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bellai_messages_conversation_created ON bellai_messages(conversation_id, created_at ASC);
-- 9. NÚCLEO DE NEGOCIO BellAI. Estas tablas conviven temporalmente con las
-- tablas operativas del panel para preservar los contratos de administración.
CREATE TABLE IF NOT EXISTS usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(120) NOT NULL,
    correo VARCHAR(254) NOT NULL,
    contrasena_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'usuaria' CHECK (rol IN ('usuaria','gestor','administrador')),
    suspendido BOOLEAN NOT NULL DEFAULT FALSE,
    estado VARCHAR(15) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','suspendido')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_correo_normalizado ON usuario (LOWER(correo));
CREATE TABLE IF NOT EXISTS estilo (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS color (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nombre VARCHAR(70) NOT NULL UNIQUE, codigo_hex CHAR(7) UNIQUE CHECK (codigo_hex ~ '^#[0-9A-Fa-f]{6}$'));
CREATE TABLE IF NOT EXISTS ocasion (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS perfil_estilo (usuario_id UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE, presupuesto NUMERIC(12,2) CHECK (presupuesto > 0), estilo_predominante_id INTEGER REFERENCES estilo(id) ON DELETE SET NULL, descripcion TEXT, actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS usuario_estilo (usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, estilo_id INTEGER NOT NULL REFERENCES estilo(id), PRIMARY KEY (usuario_id, estilo_id));
CREATE TABLE IF NOT EXISTS usuario_color (usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, color_id INTEGER NOT NULL REFERENCES color(id), preferencia VARCHAR(12) NOT NULL CHECK (preferencia IN ('preferido','evitar')), PRIMARY KEY (usuario_id, color_id));
CREATE TABLE IF NOT EXISTS usuario_ocasion (usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, ocasion_id INTEGER NOT NULL REFERENCES ocasion(id), PRIMARY KEY (usuario_id, ocasion_id));
CREATE TABLE IF NOT EXISTS consentimiento_fotografia (usuario_id UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE, autorizado BOOLEAN NOT NULL DEFAULT FALSE, version_politica VARCHAR(30) NOT NULL, actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS fotografia (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, tipo VARCHAR(25) NOT NULL CHECK (tipo IN ('rostro','cuerpo','prenda','simulacion','avatar')), clave_archivo TEXT NOT NULL UNIQUE, mime VARCHAR(60) NOT NULL, tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes >= 0), creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (id, usuario_id));
CREATE TABLE IF NOT EXISTS diagnostico (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, foto_rostro_id UUID, foto_cuerpo_id UUID, forma_rostro VARCHAR(80), tono_piel VARCHAR(80), subtono_piel VARCHAR(80), proporciones JSONB, caracteristicas_cabello JSONB, paleta_estacional VARCHAR(80), puntuacion_general NUMERIC(5,2) CHECK (puntuacion_general BETWEEN 0 AND 100), resumen TEXT, resultado_detallado JSONB NOT NULL DEFAULT '{}'::jsonb, creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (id, usuario_id), FOREIGN KEY (foto_rostro_id, usuario_id) REFERENCES fotografia(id, usuario_id), FOREIGN KEY (foto_cuerpo_id, usuario_id) REFERENCES fotografia(id, usuario_id));
CREATE TABLE IF NOT EXISTS diagnostico_color (diagnostico_id UUID NOT NULL REFERENCES diagnostico(id) ON DELETE CASCADE, color_id INTEGER NOT NULL REFERENCES color(id), PRIMARY KEY (diagnostico_id, color_id));
CREATE TABLE IF NOT EXISTS categoria_prenda (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE, grupo VARCHAR(15) NOT NULL CHECK (grupo IN ('superior','inferior','entera','calzado','accesorio','abrigo')));
CREATE TABLE IF NOT EXISTS prenda (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, categoria_id INTEGER NOT NULL REFERENCES categoria_prenda(id), color_id INTEGER REFERENCES color(id), fotografia_id UUID, nombre VARCHAR(120), descripcion TEXT, disponible BOOLEAN NOT NULL DEFAULT TRUE, subcategoria VARCHAR(50), temporada VARCHAR(30), talla_aproximada VARCHAR(20), origen_captura VARCHAR(20), estado VARCHAR(20) NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('borrador','procesando','confirmada','error_carga')), ultimo_uso_en TIMESTAMPTZ, cantidad_usos INTEGER NOT NULL DEFAULT 0, metadatos_ia JSONB NOT NULL DEFAULT '{}'::jsonb, registrada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, actualizada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (id, usuario_id), FOREIGN KEY (fotografia_id, usuario_id) REFERENCES fotografia(id, usuario_id));
CREATE TABLE IF NOT EXISTS prenda_fotografia (prenda_id UUID NOT NULL REFERENCES prenda(id) ON DELETE CASCADE, fotografia_id UUID NOT NULL REFERENCES fotografia(id) ON DELETE CASCADE, rol VARCHAR(12) NOT NULL CHECK (rol IN ('original','mejorada')), PRIMARY KEY (prenda_id, fotografia_id), UNIQUE (prenda_id, rol));
CREATE TABLE IF NOT EXISTS prenda_ocasion (prenda_id UUID NOT NULL REFERENCES prenda(id) ON DELETE CASCADE, ocasion_id INTEGER NOT NULL REFERENCES ocasion(id), PRIMARY KEY (prenda_id, ocasion_id));
CREATE TABLE IF NOT EXISTS outfit (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, ocasion_id INTEGER REFERENCES ocasion(id), titulo VARCHAR(120), explicacion TEXT, clima_resumen VARCHAR(120), temperatura_c NUMERIC(5,2), guardado BOOLEAN NOT NULL DEFAULT FALSE, favorito BOOLEAN NOT NULL DEFAULT FALSE, valoracion VARCHAR(15) CHECK (valoracion IN ('agradable','neutral','no_agradable')), creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (id, usuario_id), CHECK (NOT favorito OR guardado));
CREATE TABLE IF NOT EXISTS outfit_prenda (usuario_id UUID NOT NULL, outfit_id UUID NOT NULL, prenda_id UUID NOT NULL, PRIMARY KEY (outfit_id, prenda_id), FOREIGN KEY (outfit_id, usuario_id) REFERENCES outfit(id, usuario_id) ON DELETE CASCADE, FOREIGN KEY (prenda_id, usuario_id) REFERENCES prenda(id, usuario_id));
CREATE TABLE IF NOT EXISTS recomendacion (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, diagnostico_id UUID, tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('color','corte','accesorio','maquillaje','outfit','otro')), contenido TEXT NOT NULL, explicacion TEXT NOT NULL, creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (diagnostico_id, usuario_id) REFERENCES diagnostico(id, usuario_id));
CREATE TABLE IF NOT EXISTS conversacion (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, titulo VARCHAR(160), creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS mensaje (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversacion_id UUID NOT NULL REFERENCES conversacion(id) ON DELETE CASCADE, emisor VARCHAR(12) NOT NULL CHECK (emisor IN ('usuaria','asistente')), contenido TEXT NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS simulacion (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, fotografia_original_id UUID NOT NULL, fotografia_resultado_id UUID NOT NULL, tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('corte_cabello','color_cabello','maquillaje','unas')), opciones JSONB, creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (fotografia_original_id, usuario_id) REFERENCES fotografia(id, usuario_id), FOREIGN KEY (fotografia_resultado_id, usuario_id) REFERENCES fotografia(id, usuario_id), CHECK (fotografia_original_id <> fotografia_resultado_id));
CREATE TABLE IF NOT EXISTS avatar (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL UNIQUE REFERENCES usuario(id) ON DELETE CASCADE, clave_modelo_3d TEXT NOT NULL UNIQUE, configuracion JSONB, actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reto_semanal (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), titulo VARCHAR(140) NOT NULL, descripcion TEXT, inicio DATE NOT NULL, fin DATE NOT NULL, CHECK (fin >= inicio));
CREATE TABLE IF NOT EXISTS reto_tarea (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reto_id UUID NOT NULL REFERENCES reto_semanal(id) ON DELETE CASCADE, titulo VARCHAR(180) NOT NULL, orden INTEGER NOT NULL CHECK (orden > 0), UNIQUE (reto_id, orden));
CREATE TABLE IF NOT EXISTS reto_progreso (usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, tarea_id UUID NOT NULL REFERENCES reto_tarea(id) ON DELETE CASCADE, completada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (usuario_id, tarea_id));
-- HU-28: descripción y pantalla de cada tarea; un solo reto por semana (migración 1700000000011)
ALTER TABLE reto_tarea ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE reto_tarea ADD COLUMN IF NOT EXISTS accion VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS ux_reto_semanal_inicio ON reto_semanal (inicio);
CREATE INDEX IF NOT EXISTS ix_fotografia_usuario_fecha ON fotografia (usuario_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS ix_diagnostico_usuario_fecha ON diagnostico (usuario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_prenda_usuario_categoria ON prenda (usuario_id, categoria_id);
CREATE INDEX IF NOT EXISTS ix_outfit_usuario_fecha ON outfit (usuario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS ix_conversacion_usuario_fecha ON conversacion (usuario_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS ix_mensaje_conversacion_fecha ON mensaje (conversacion_id, creado_en);
INSERT INTO estilo (nombre) VALUES ('Clásico'), ('Casual'), ('Minimalista'), ('Romántico'), ('Creativo') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO color (nombre, codigo_hex) VALUES ('Negro', '#000000'), ('Blanco', '#FFFFFF'), ('Azul marino', '#1F3A5F'), ('Beige', '#D8C3A5'), ('Rojo', '#B3261E') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO ocasion (nombre) VALUES ('Casual'), ('Trabajo'), ('Formal'), ('Fiesta'), ('Deporte'), ('Playa'), ('Gala') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO categoria_prenda (nombre, grupo) VALUES ('Blusas', 'superior'), ('Pantalones', 'inferior'), ('Vestidos', 'entera'), ('Calzado', 'calzado'), ('Abrigos', 'abrigo'), ('Accesorios', 'accesorio') ON CONFLICT (nombre) DO NOTHING;


-- ============================================================
-- 10. Plataforma de IA: tareas, modelos, incidencias, Style DNA, feedback (migración 010)
-- ============================================================
-- El espejo de dominio se elimina junto con la cuenta (HU-029: derecho al olvido completo)
DELETE FROM usuario WHERE id NOT IN (SELECT id FROM users);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_usuario_users') THEN
    ALTER TABLE usuario ADD CONSTRAINT fk_usuario_users FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tarea (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','procesando','completada','fallida')),
    progreso SMALLINT NOT NULL DEFAULT 0 CHECK (progreso BETWEEN 0 AND 100),
    hash_entrada VARCHAR(64),
    entrada JSONB NOT NULL DEFAULT '{}'::jsonb,
    resultado JSONB,
    error TEXT,
    intentos SMALLINT NOT NULL DEFAULT 0,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizada_en TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_tarea_usuario_fecha ON tarea (usuario_id, creada_en DESC);
CREATE INDEX IF NOT EXISTS ix_tarea_activa ON tarea (usuario_id, tipo, hash_entrada) WHERE estado IN ('pendiente','procesando');

CREATE TABLE IF NOT EXISTS modelo_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(80) NOT NULL,
    tarea VARCHAR(40) NOT NULL,
    version VARCHAR(40) NOT NULL,
    entorno VARCHAR(15) NOT NULL DEFAULT 'desarrollo' CHECK (entorno IN ('desarrollo','pruebas','produccion')),
    estado VARCHAR(15) NOT NULL DEFAULT 'registrado' CHECK (estado IN ('registrado','activo','inactivo','fallido')),
    descripcion TEXT,
    artefacto_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    metricas JSONB NOT NULL DEFAULT '{}'::jsonb,
    ultimo_chequeo JSONB,
    registrado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    activado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    activado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (nombre, version, entorno)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_modelo_ia_activo ON modelo_ia (nombre, entorno) WHERE estado = 'activo';

CREATE TABLE IF NOT EXISTS incidencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'otro' CHECK (tipo IN ('error','analisis','armario','cuenta','privacidad','sugerencia','otro')),
    titulo VARCHAR(140) NOT NULL,
    descripcion TEXT NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','en_proceso','resuelta','cerrada')),
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta')),
    contexto JSONB NOT NULL DEFAULT '{}'::jsonb,
    respuesta TEXT,
    atendida_por UUID REFERENCES users(id) ON DELETE SET NULL,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resuelta_en TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_incidencia_estado_fecha ON incidencia (estado, creada_en DESC);

CREATE TABLE IF NOT EXISTS perfil_dna (
    usuario_id UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
    dimensiones JSONB NOT NULL,
    fuentes JSONB NOT NULL DEFAULT '{}'::jsonb,
    interacciones INTEGER NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS perfil_dna_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    dimensiones JSONB NOT NULL,
    motivo VARCHAR(60) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_dna_historial_usuario ON perfil_dna_historial (usuario_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS retroalimentacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    objetivo_tipo VARCHAR(20) NOT NULL CHECK (objetivo_tipo IN ('recomendacion','outfit','prenda','simulacion','color','estilo','compatibilidad')),
    objetivo_id VARCHAR(120) NOT NULL,
    valor VARCHAR(15) NOT NULL CHECK (valor IN ('me_gusta','neutral','no_me_gusta')),
    atributos JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, objetivo_tipo, objetivo_id)
);

ALTER TABLE diagnostico ADD COLUMN IF NOT EXISTS tipo_cuerpo VARCHAR(60);
ALTER TABLE diagnostico ADD COLUMN IF NOT EXISTS confianza JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE diagnostico ADD COLUMN IF NOT EXISTS versiones_modelo JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE outfit ADD COLUMN IF NOT EXISTS puntuacion NUMERIC(5,2);
ALTER TABLE outfit ADD COLUMN IF NOT EXISTS detalles JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS outfit_item (
    outfit_id UUID NOT NULL REFERENCES outfit(id) ON DELETE CASCADE,
    wardrobe_item_id UUID NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
    rol VARCHAR(20) NOT NULL DEFAULT 'prenda',
    PRIMARY KEY (outfit_id, wardrobe_item_id)
);

ALTER TABLE simulacion DROP CONSTRAINT IF EXISTS simulacion_tipo_check;
ALTER TABLE simulacion ADD CONSTRAINT simulacion_tipo_check CHECK (tipo IN ('corte_cabello','color_cabello','maquillaje','unas','gafas','prenda'));

-- Notificaciones push: tokens de Expo de cada teléfono (migración 1700000000013)
CREATE TABLE IF NOT EXISTS push_token (
    token VARCHAR(255) PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plataforma VARCHAR(10) NOT NULL DEFAULT 'android' CHECK (plataforma IN ('android', 'ios')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_push_token_usuario ON push_token (usuario_id);

-- Suscripciones (migración 1700000000014): plan Gratis / Premium, pagos con pasarela y contadores de uso
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_plan') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_plan CHECK (plan IN ('free','premium'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL DEFAULT 'stripe',
    provider_session_id VARCHAR(255) UNIQUE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired')),
    paid_at TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_payments_user_created ON payments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS usage_counters (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(40) NOT NULL,
    period_key VARCHAR(10) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, feature, period_key)
);
