import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { User } from '../modules/users/entities/user.entity';
import { Profile } from '../modules/profile/entities/profile.entity';
import { Preferences } from '../modules/profile/entities/preferences.entity';
import { GdprConsent } from '../modules/privacy/entities/gdpr-consent.entity';
import { AuditLog } from '../modules/privacy/entities/audit-log.entity';
import { MediaAsset } from '../modules/media/entities/media-asset.entity';
import { WardrobeItem } from '../modules/wardrobe/entities/wardrobe-item.entity';
import { PlatformSetting } from '../modules/admin/entities/platform-setting.entity';
import { BellaiDiagnostic } from '../modules/bellai/entities/bellai-diagnostic.entity';
import { BellaiOutfit } from '../modules/bellai/entities/bellai-outfit.entity';
import { BellaiConversation } from '../modules/bellai/entities/bellai-conversation.entity';
import { BellaiMessage } from '../modules/bellai/entities/bellai-message.entity';

import { CreateUsersAndProfiles1700000000001 } from '../migrations/1700000000001-CreateUsersAndProfiles';
import { CreatePreferencesAndGdpr1700000000002 } from '../migrations/1700000000002-CreatePreferencesAndGdpr';
import { CreateMediaAssets1700000000003 } from '../migrations/1700000000003-CreateMediaAssets';
import { SeedInitialData1700000000004 } from '../migrations/1700000000004-SeedInitialData';
import { CreatePlatformSettings1700000000005 } from '../migrations/1700000000005-CreatePlatformSettings';
import { AddOccasionAndAccessoriesToWardrobe1700000000006 } from '../migrations/1700000000006-AddOccasionAndAccessoriesToWardrobe';
import { AddStylePreferences1700000000007 } from '../migrations/1700000000007-AddStylePreferences';
import { ReconcileLegacyModuleSchema1700000000008 } from '../migrations/1700000000008-ReconcileLegacyModuleSchema';
import { AddWardrobeSyncPreferences1700000000009 } from '../migrations/1700000000009-AddWardrobeSyncPreferences';
import { CreateBellaiAdvisorAndHistory1700000000010 } from '../migrations/1700000000010-CreateBellaiAdvisorAndHistory';
import { CreateBellaiBusinessSchema1700000000009 } from '../migrations/1700000000009-CreateBellaiBusinessSchema';
import { CreateAiPlatformTables1700000000010 } from '../migrations/1700000000010-CreateAiPlatformTables';
import { AddWeeklyChallengeTasks1700000000011 } from '../migrations/1700000000011-AddWeeklyChallengeTasks';
import { AddUserLastSeen1700000000012 } from '../migrations/1700000000012-AddUserLastSeen';
import { CreatePushTokens1700000000013 } from '../migrations/1700000000013-CreatePushTokens';
import { CreateSubscriptions1700000000014 } from '../migrations/1700000000014-CreateSubscriptions';

// Cargar variables de entorno desde el archivo .env
dotenv.config({ path: path.join(process.cwd(), '.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
    CreateBellaiBusinessSchema1700000000009, CreateAiPlatformTables1700000000010,
    AddWeeklyChallengeTasks1700000000011,
    AddUserLastSeen1700000000012,
    CreatePushTokens1700000000013,
    CreateSubscriptions1700000000014,
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(dataSourceOptions);
