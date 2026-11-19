import * as THREE from 'three';
import type { AvatarConfig, AvatarGarment, AvatarScanMesh } from '../api/types';
import baseMeshFemale from './baseMeshFemale.json';
import { buildScannedAvatar } from './scannedAvatar';

/**
 * HU-023: Maniquí 3D hiperrealista basado en el modelo femenino Character Creator.
 *
 * Elimina por completo los maniquíes procedurales sintéticos de cilindros.
 * Utiliza la malla anatómica base con deformaciones en tiempo real para silueta,
 * colorimetría de piel, ojos con iris reflectante y peinados 3D volumétricos.
 */
export function buildAvatar(config: AvatarConfig, garments: AvatarGarment[] = []): THREE.Group {
  return buildScannedAvatar(baseMeshFemale as unknown as AvatarScanMesh, garments, config);
}
