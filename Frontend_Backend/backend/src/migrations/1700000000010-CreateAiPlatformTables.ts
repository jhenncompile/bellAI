import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tablas para tareas asíncronas (HU-041), registro de modelos de IA (HU-032),
 * incidencias (HU-031), Style DNA (HU-007/008), retroalimentación (HU-018/039)
 * y outfits sobre el armario real (HU-015/016). Idempotente: el mismo SQL está en schema.sql.
 */
export const AI_PLATFORM_SQL = `
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
`;

export class CreateAiPlatformTables1700000000010 implements MigrationInterface {
  name = 'CreateAiPlatformTables1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(AI_PLATFORM_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS outfit_item;
      DROP TABLE IF EXISTS retroalimentacion;
      DROP TABLE IF EXISTS perfil_dna_historial;
      DROP TABLE IF EXISTS perfil_dna;
      DROP TABLE IF EXISTS incidencia;
      DROP TABLE IF EXISTS modelo_ia;
      DROP TABLE IF EXISTS tarea;
      ALTER TABLE usuario DROP CONSTRAINT IF EXISTS fk_usuario_users;
    `);
  }
}
