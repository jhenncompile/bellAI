import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableCheck,
} from 'typeorm';

export class CreateUsersAndProfiles1700000000001 implements MigrationInterface {
  name = 'CreateUsersAndProfiles1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabla: users
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '150',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'varchar',
            length: '50',
            default: "'user'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        checks: [
          new TableCheck({
            name: 'chk_users_role',
            expression: `"role" IN ('admin', 'manager', 'user')`,
          }),
          new TableCheck({
            name: 'chk_users_status',
            expression: `"status" IN ('active', 'inactive', 'suspended')`,
          }),
        ],
      }),
      true,
    );

    // 2. Tabla: profiles
    await queryRunner.createTable(
      new Table({
        name: 'profiles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'bio',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'phone_encrypted',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'phone_masked',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'avatar_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'birth_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'address_encrypted',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    );

    // schema.sql puede haber creado estos índices al inicializar PostgreSQL en Docker.
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_profiles_user_id" ON "profiles" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('profiles', true);
    await queryRunner.dropTable('users', true);
  }
}
