import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Núcleo relacional de BellAI. Es idempotente porque `schema.sql` se monta al
 * inicializar PostgreSQL en Docker y esta migración también debe servir para
 * instalaciones creadas exclusivamente mediante TypeORM.
 */
export class CreateBellaiBusinessSchema1700000000009 implements MigrationInterface {
  name = 'CreateBellaiBusinessSchema1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
      CREATE TABLE IF NOT EXISTS perfil_estilo (
        usuario_id UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
        presupuesto NUMERIC(12,2) CHECK (presupuesto > 0), estilo_predominante_id INTEGER REFERENCES estilo(id) ON DELETE SET NULL,
        descripcion TEXT, actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS usuario_estilo (usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, estilo_id INTEGER NOT NULL REFERENCES estilo(id), PRIMARY KEY (usuario_id, estilo_id));
      CREATE TABLE IF NOT EXISTS usuario_color (usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, color_id INTEGER NOT NULL REFERENCES color(id), preferencia VARCHAR(12) NOT NULL CHECK (preferencia IN ('preferido','evitar')), PRIMARY KEY (usuario_id, color_id));
      CREATE TABLE IF NOT EXISTS usuario_ocasion (usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, ocasion_id INTEGER NOT NULL REFERENCES ocasion(id), PRIMARY KEY (usuario_id, ocasion_id));

      CREATE TABLE IF NOT EXISTS consentimiento_fotografia (
        usuario_id UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE, autorizado BOOLEAN NOT NULL DEFAULT FALSE,
        version_politica VARCHAR(30) NOT NULL, actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS fotografia (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
        tipo VARCHAR(25) NOT NULL CHECK (tipo IN ('rostro','cuerpo','prenda','simulacion','avatar')),
        clave_archivo TEXT NOT NULL UNIQUE, mime VARCHAR(60) NOT NULL, tamano_bytes BIGINT NOT NULL CHECK (tamano_bytes >= 0),
        creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (id, usuario_id)
      );
      CREATE TABLE IF NOT EXISTS diagnostico (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
        foto_rostro_id UUID, foto_cuerpo_id UUID, forma_rostro VARCHAR(80), tono_piel VARCHAR(80), subtono_piel VARCHAR(80),
        proporciones JSONB, caracteristicas_cabello JSONB, paleta_estacional VARCHAR(80), puntuacion_general NUMERIC(5,2) CHECK (puntuacion_general BETWEEN 0 AND 100),
        resumen TEXT, resultado_detallado JSONB NOT NULL DEFAULT '{}'::jsonb, creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (id, usuario_id), FOREIGN KEY (foto_rostro_id, usuario_id) REFERENCES fotografia(id, usuario_id),
        FOREIGN KEY (foto_cuerpo_id, usuario_id) REFERENCES fotografia(id, usuario_id)
      );
      CREATE TABLE IF NOT EXISTS diagnostico_color (diagnostico_id UUID NOT NULL REFERENCES diagnostico(id) ON DELETE CASCADE, color_id INTEGER NOT NULL REFERENCES color(id), PRIMARY KEY (diagnostico_id, color_id));

      CREATE TABLE IF NOT EXISTS categoria_prenda (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE, grupo VARCHAR(15) NOT NULL CHECK (grupo IN ('superior','inferior','entera','calzado','accesorio','abrigo')));
      CREATE TABLE IF NOT EXISTS prenda (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
        categoria_id INTEGER NOT NULL REFERENCES categoria_prenda(id), color_id INTEGER REFERENCES color(id), fotografia_id UUID,
        nombre VARCHAR(120), descripcion TEXT, disponible BOOLEAN NOT NULL DEFAULT TRUE, subcategoria VARCHAR(50), temporada VARCHAR(30), talla_aproximada VARCHAR(20),
        origen_captura VARCHAR(20), estado VARCHAR(20) NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('borrador','procesando','confirmada','error_carga')),
        ultimo_uso_en TIMESTAMPTZ, cantidad_usos INTEGER NOT NULL DEFAULT 0, metadatos_ia JSONB NOT NULL DEFAULT '{}'::jsonb,
        registrada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, actualizada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (id, usuario_id), FOREIGN KEY (fotografia_id, usuario_id) REFERENCES fotografia(id, usuario_id)
      );
      CREATE TABLE IF NOT EXISTS prenda_fotografia (prenda_id UUID NOT NULL REFERENCES prenda(id) ON DELETE CASCADE, fotografia_id UUID NOT NULL REFERENCES fotografia(id) ON DELETE CASCADE, rol VARCHAR(12) NOT NULL CHECK (rol IN ('original','mejorada')), PRIMARY KEY (prenda_id, fotografia_id), UNIQUE (prenda_id, rol));
      CREATE TABLE IF NOT EXISTS prenda_ocasion (prenda_id UUID NOT NULL REFERENCES prenda(id) ON DELETE CASCADE, ocasion_id INTEGER NOT NULL REFERENCES ocasion(id), PRIMARY KEY (prenda_id, ocasion_id));

      CREATE TABLE IF NOT EXISTS outfit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, ocasion_id INTEGER REFERENCES ocasion(id),
        titulo VARCHAR(120), explicacion TEXT, clima_resumen VARCHAR(120), temperatura_c NUMERIC(5,2), guardado BOOLEAN NOT NULL DEFAULT FALSE,
        favorito BOOLEAN NOT NULL DEFAULT FALSE, valoracion VARCHAR(15) CHECK (valoracion IN ('agradable','neutral','no_agradable')),
        creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (id, usuario_id), CHECK (NOT favorito OR guardado)
      );
      CREATE TABLE IF NOT EXISTS outfit_prenda (usuario_id UUID NOT NULL, outfit_id UUID NOT NULL, prenda_id UUID NOT NULL, PRIMARY KEY (outfit_id, prenda_id), FOREIGN KEY (outfit_id, usuario_id) REFERENCES outfit(id, usuario_id) ON DELETE CASCADE, FOREIGN KEY (prenda_id, usuario_id) REFERENCES prenda(id, usuario_id));
      CREATE TABLE IF NOT EXISTS recomendacion (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, diagnostico_id UUID, tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('color','corte','accesorio','maquillaje','outfit','otro')), contenido TEXT NOT NULL, explicacion TEXT NOT NULL, creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (diagnostico_id, usuario_id) REFERENCES diagnostico(id, usuario_id));

      CREATE TABLE IF NOT EXISTS conversacion (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, titulo VARCHAR(160), creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS mensaje (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversacion_id UUID NOT NULL REFERENCES conversacion(id) ON DELETE CASCADE, emisor VARCHAR(12) NOT NULL CHECK (emisor IN ('usuaria','asistente')), contenido TEXT NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS simulacion (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, fotografia_original_id UUID NOT NULL, fotografia_resultado_id UUID NOT NULL, tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('corte_cabello','color_cabello','maquillaje','unas')), opciones JSONB, creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (fotografia_original_id, usuario_id) REFERENCES fotografia(id, usuario_id), FOREIGN KEY (fotografia_resultado_id, usuario_id) REFERENCES fotografia(id, usuario_id), CHECK (fotografia_original_id <> fotografia_resultado_id));
      CREATE TABLE IF NOT EXISTS avatar (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL UNIQUE REFERENCES usuario(id) ON DELETE CASCADE, clave_modelo_3d TEXT NOT NULL UNIQUE, configuracion JSONB, actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS reto_semanal (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), titulo VARCHAR(140) NOT NULL, descripcion TEXT, inicio DATE NOT NULL, fin DATE NOT NULL, CHECK (fin >= inicio));
      CREATE TABLE IF NOT EXISTS reto_tarea (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reto_id UUID NOT NULL REFERENCES reto_semanal(id) ON DELETE CASCADE, titulo VARCHAR(180) NOT NULL, orden INTEGER NOT NULL CHECK (orden > 0), UNIQUE (reto_id, orden));
      CREATE TABLE IF NOT EXISTS reto_progreso (usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE, tarea_id UUID NOT NULL REFERENCES reto_tarea(id) ON DELETE CASCADE, completada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (usuario_id, tarea_id));

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
    `);
  }

  public async down(): Promise<void> {
    // El esquema se instala como línea base y no se revierte de forma destructiva.
  }
}
