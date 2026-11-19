import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Suscripciones simples (plan Gratis / Premium mensual), pagos con pasarela y
 * contadores de uso por periodo. Idempotente: el mismo SQL está en schema.sql.
 */
export const SUBSCRIPTIONS_SQL = `
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
`;

export class CreateSubscriptions1700000000014 implements MigrationInterface {
  name = 'CreateSubscriptions1700000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(SUBSCRIPTIONS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS usage_counters;
      DROP TABLE IF EXISTS payments;
      ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_plan;
      ALTER TABLE users DROP COLUMN IF EXISTS plan_expires_at;
      ALTER TABLE users DROP COLUMN IF EXISTS plan;
    `);
  }
}
