import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';

import { User } from './modules/users/entities/user.entity';
import { Profile } from './modules/profile/entities/profile.entity';
import { Preferences } from './modules/profile/entities/preferences.entity';
import { GdprConsent } from './modules/privacy/entities/gdpr-consent.entity';
import { AuditLog } from './modules/privacy/entities/audit-log.entity';
import { MediaAsset } from './modules/media/entities/media-asset.entity';
import { WardrobeItem } from './modules/wardrobe/entities/wardrobe-item.entity';
import { PlatformSetting } from './modules/admin/entities/platform-setting.entity';
import { BellaiDiagnostic } from './modules/bellai/entities/bellai-diagnostic.entity';
import { BellaiOutfit } from './modules/bellai/entities/bellai-outfit.entity';
import { BellaiConversation } from './modules/bellai/entities/bellai-conversation.entity';
import { BellaiMessage } from './modules/bellai/entities/bellai-message.entity';
import { CreateUsersAndProfiles1700000000001 } from './migrations/1700000000001-CreateUsersAndProfiles';
import { CreatePreferencesAndGdpr1700000000002 } from './migrations/1700000000002-CreatePreferencesAndGdpr';
import { CreateMediaAssets1700000000003 } from './migrations/1700000000003-CreateMediaAssets';
import { SeedInitialData1700000000004 } from './migrations/1700000000004-SeedInitialData';
import { CreatePlatformSettings1700000000005 } from './migrations/1700000000005-CreatePlatformSettings';
import { AddOccasionAndAccessoriesToWardrobe1700000000006 } from './migrations/1700000000006-AddOccasionAndAccessoriesToWardrobe';
import { AddStylePreferences1700000000007 } from './migrations/1700000000007-AddStylePreferences';
import { ReconcileLegacyModuleSchema1700000000008 } from './migrations/1700000000008-ReconcileLegacyModuleSchema';
import { AddWardrobeSyncPreferences1700000000009 } from './migrations/1700000000009-AddWardrobeSyncPreferences';
import { CreateBellaiAdvisorAndHistory1700000000010 } from './migrations/1700000000010-CreateBellaiAdvisorAndHistory';
import { parseMigrationsRun } from './config/typeorm-migrations-run';
import { CreateBellaiBusinessSchema1700000000009 } from './migrations/1700000000009-CreateBellaiBusinessSchema';
import { CreateAiPlatformTables1700000000010 } from './migrations/1700000000010-CreateAiPlatformTables';
import { AddWeeklyChallengeTasks1700000000011 } from './migrations/1700000000011-AddWeeklyChallengeTasks';
import { AddUserLastSeen1700000000012 } from './migrations/1700000000012-AddUserLastSeen';
import { CreatePushTokens1700000000013 } from './migrations/1700000000013-CreatePushTokens';
import { CreateSubscriptions1700000000014 } from './migrations/1700000000014-CreateSubscriptions';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfileModule } from './modules/profile/profile.module';
import { StorageModule } from './modules/storage/storage.module';
import { MediaModule } from './modules/media/media.module';
import { UploadModule } from './modules/upload/upload.module';
import { QueuesModule } from './modules/queues/queues.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { WardrobeModule } from './modules/wardrobe/wardrobe.module';
import { AdminModule } from './modules/admin/admin.module';
import { BellaiModule } from './modules/bellai/bellai.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DiagnosisModule } from './modules/diagnosis/diagnosis.module';
import { AiModelsModule } from './modules/ai-models/ai-models.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { StyleModule } from './modules/style/style.module';
import { WeatherModule } from './modules/weather/weather.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OutfitsModule } from './modules/outfits/outfits.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { CompatibilityModule } from './modules/compatibility/compatibility.module';
import { SimulationsModule } from './modules/simulations/simulations.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    // Configuración de variables de entorno (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Caché Global en memoria (con soporte Redis)
    CacheModule.register({
      isGlobal: true,
      ttl: parseInt(process.env.CACHE_TTL || '300000', 10), // 5 min
    }),

    // Rate Limiting (Protección contra fuerza bruta y DoS)
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '120', 10),
      },
    ]),

    // Conexión central TypeORM con PostgreSQL 17 (bellia)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME', 'bellia'),
        entities: [
          User,
          Profile,
          Preferences,
          GdprConsent,
          AuditLog,
          MediaAsset,
          WardrobeItem,
          PlatformSetting,
          BellaiDiagnostic,
          BellaiOutfit,
          BellaiConversation,
          BellaiMessage,
        ],
        migrations: [
          CreateUsersAndProfiles1700000000001,
          CreatePreferencesAndGdpr1700000000002,
          CreateMediaAssets1700000000003,
          SeedInitialData1700000000004,
          CreatePlatformSettings1700000000005,
          AddOccasionAndAccessoriesToWardrobe1700000000006,
          AddStylePreferences1700000000007,
          ReconcileLegacyModuleSchema1700000000008,
          AddWardrobeSyncPreferences1700000000009,
          CreateBellaiAdvisorAndHistory1700000000010,
          CreateBellaiBusinessSchema1700000000009,
          CreateAiPlatformTables1700000000010,
          AddWeeklyChallengeTasks1700000000011,
          AddUserLastSeen1700000000012,
          CreatePushTokens1700000000013,
          CreateSubscriptions1700000000014,
        ],
        migrationsRun: parseMigrationsRun(config.get<string>('TYPEORM_MIGRATIONS_RUN')),
        synchronize: false,
        logging: false,
      }),
    }),

    // Módulos funcionales de la aplicación
    AuthModule,
    UsersModule,
    ProfileModule,
    StorageModule,
    MediaModule,
    UploadModule,
    QueuesModule,
    PrivacyModule,
    WardrobeModule,
    AdminModule,
    BellaiModule,
    AiGatewayModule,
    TasksModule,
    DiagnosisModule,
    AiModelsModule,
    IncidentsModule,
    StyleModule,
    WeatherModule,
    NotificationsModule,
    OutfitsModule,
    AssistantModule,
    CompatibilityModule,
    SimulationsModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
