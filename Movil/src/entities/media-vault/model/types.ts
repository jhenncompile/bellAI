export type VaultFolderType = 'rostro' | 'cuerpo' | 'armario';

export interface VaultItem {
  id: string;
  folder: VaultFolderType;
  fileName: string;
  localUri: string;
  timestamp: string;
  dateLabel: string;
  summary: string;
  faceShape?: string;
  season?: string;
  score?: number;
  tags: string[];
}

export interface VaultStats {
  rostroCount: number;
  cuerpoCount: number;
  armarioCount: number;
  totalSizeMb: number;
}
