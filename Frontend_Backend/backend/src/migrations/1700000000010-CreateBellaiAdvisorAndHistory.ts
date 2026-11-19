import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBellaiAdvisorAndHistory1700000000010
  implements MigrationInterface
{
  name = 'CreateBellaiAdvisorAndHistory1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bellai_diagnostics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        face_shape VARCHAR(60) NOT NULL,
        skin_tone VARCHAR(80) NOT NULL,
        undertone VARCHAR(40) NOT NULL,
        seasonal_palette VARCHAR(80) NOT NULL,
        summary TEXT,
        proportions JSONB NOT NULL DEFAULT '{}'::jsonb,
        hair_features JSONB NOT NULL DEFAULT '{}'::jsonb,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bellai_diagnostics_user_created
      ON bellai_diagnostics (user_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bellai_outfits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(160) NOT NULL,
        occasion VARCHAR(60),
        season VARCHAR(60),
        garment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        color_harmony VARCHAR(120),
        reason_summary TEXT,
        considered_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bellai_outfits_user_created
      ON bellai_outfits (user_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bellai_conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(160) NOT NULL DEFAULT 'Asesora personal BellAI',
        context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bellai_conversations_user_updated
      ON bellai_conversations (user_id, updated_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bellai_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES bellai_conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bellai_messages_conversation_created
      ON bellai_messages (conversation_id, created_at ASC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS bellai_messages;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bellai_conversations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bellai_outfits;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bellai_diagnostics;`);
  }
}
