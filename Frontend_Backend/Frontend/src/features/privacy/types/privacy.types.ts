export interface ConsentRecord {
  id: string;
  consentType: string;
  accepted: boolean;
  policyVersion: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  details: unknown;
  createdAt: string;
}

export interface RightToBeForgottenResponse {
  message: string;
  status: string;
}

export interface PrivacyDataSummary {
  account: { name: string; email: string; memberSince: string };
  profile: {
    bio: string;
    phone: string;
    address: string;
    birthDate: string;
    avatarUrl: string;
  };
  preferences: Record<string, unknown>;
  wardrobe: {
    itemCount: number;
    items: { name: string; category: string; addedAt: string }[];
  };
  photos: { wardrobeCount: number; mediaCount: number; totalCount: number };
  consents: { recordCount: number };
}
