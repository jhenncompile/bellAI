import * as THREE from 'three';
import type { AvatarConfig, AvatarGarment, AvatarScanMesh } from '../api/types';

/**
 * HU-023: Renderizado, Rigging y Deformación del Avatar 3D femenino hiperrealista (Character Creator).
 *
 * Características:
 * 1. Malla anatómica Character Creator estanca (28.030 triángulos, ojos y boca anatómicos integrados).
 * 2. Rig y Esqueleto Óseo formal de Character Creator (THREE.Bone + THREE.Skeleton + THREE.SkeletonHelper).
 * 3. Articulaciones y Joints luminosos interactivos con modo de visualización del Rig (Ver Rig).
 * 4. Animaciones cinemáticas calculadas a través de la jerarquía esquelética (Respiración, Pasarela, Pausa).
 * 5. Deformación paramétrica en tiempo real (busto, cintura, caderas, complexión y estatura).
 * 6. Pedestal de estudio de pasarela con sombra de contacto y acabado PBR de alta fidelidad.
 * 7. Prendas del armario digital drapeadas limpiamente en capas continuas sobre las regiones anatómicas.
 */

/** Curva helicoidal 3D para modelar rizos/bucles elásticos naturales. */
class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    public radius: number = 0.018,
    public height: number = 0.25,
    public turns: number = 4.5,
    public taper: number = 0.85,
    public tiltX: number = 0.0,
    public tiltZ: number = 0.0,
  ) {
    super();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const angle = t * Math.PI * 2 * this.turns;
    const r = this.radius * (1 - (1 - this.taper) * t);
    const x = Math.cos(angle) * r + this.tiltX * t;
    const y = -t * this.height;
    const z = Math.sin(angle) * r + this.tiltZ * t;
    return optionalTarget.set(x, y, z);
  }
}

/** Curva ondulada 3D para mechones ondulados con caída natural. */
class WavyStrandCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    public height: number = 0.35,
    public waveAmplitude: number = 0.022,
    public waves: number = 2.5,
    public outwardSpread: number = 0.04,
  ) {
    super();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const y = -t * this.height;
    const x = Math.sin(t * Math.PI * 2 * this.waves) * this.waveAmplitude + this.outwardSpread * t;
    const z = Math.cos(t * Math.PI * 2 * this.waves * 0.7) * (this.waveAmplitude * 0.6);
    return optionalTarget.set(x, y, z);
  }
}

/** Definición formal del Rig y Esqueleto Óseo Character Creator en Three.js. */
export interface AvatarRig {
  root: THREE.Group;
  bones: {
    hips: THREE.Bone;
    spine: THREE.Bone;
    chest: THREE.Bone;
    neck: THREE.Bone;
    head: THREE.Bone;
    lClavicle: THREE.Bone;
    rClavicle: THREE.Bone;
    lUpperArm: THREE.Bone;
    rUpperArm: THREE.Bone;
    lForearm: THREE.Bone;
    rForearm: THREE.Bone;
    lHand: THREE.Bone;
    rHand: THREE.Bone;
    lThigh: THREE.Bone;
    rThigh: THREE.Bone;
    lCalf: THREE.Bone;
    rCalf: THREE.Bone;
    lFoot: THREE.Bone;
    rFoot: THREE.Bone;
  };
  skeleton: THREE.Skeleton;
  helper: THREE.SkeletonHelper;
  jointsGroup: THREE.Group;
  setVisible: (visible: boolean) => void;
  animate: (time: number, mode: 'idle' | 'runway' | 'pause') => void;
}

/**
 * Construye la jerarquía anatómica completa de huesos de Character Creator
 * posicionada con precisión biométrica según las regiones del modelo 3D.
 */
export function createCharacterCreatorRig(heightScale: number = 1.0): AvatarRig {
  const root = new THREE.Group();
  root.name = 'CC_Rig_Root';

  // 1. Cadena de la columna vertebral (Spine Chain)
  const hips = new THREE.Bone();
  hips.name = 'CC_Base_Hip';
  hips.position.set(0, 0.91 * heightScale, -0.02);

  const spine = new THREE.Bone();
  spine.name = 'CC_Base_Waist';
  spine.position.set(0, 0.14 * heightScale, 0.02);
  hips.add(spine);

  const chest = new THREE.Bone();
  chest.name = 'CC_Base_Chest';
  chest.position.set(0, 0.20 * heightScale, 0.02);
  spine.add(chest);

  const neck = new THREE.Bone();
  neck.name = 'CC_Base_Neck';
  neck.position.set(0, 0.15 * heightScale, -0.01);
  chest.add(neck);

  const head = new THREE.Bone();
  head.name = 'CC_Base_Head';
  head.position.set(0, 0.15 * heightScale, 0.01);
  neck.add(head);

  // 2. Extremidad Superior Izquierda (Left Arm Chain)
  const lClavicle = new THREE.Bone();
  lClavicle.name = 'CC_Base_L_Clavicle';
  lClavicle.position.set(0.08, 0.13 * heightScale, -0.01);
  chest.add(lClavicle);

  const lUpperArm = new THREE.Bone();
  lUpperArm.name = 'CC_Base_L_UpperArm';
  lUpperArm.position.set(0.10, -0.02 * heightScale, -0.02);
  lClavicle.add(lUpperArm);

  const lForearm = new THREE.Bone();
  lForearm.name = 'CC_Base_L_Forearm';
  lForearm.position.set(0.098, -0.26 * heightScale, -0.01);
  lUpperArm.add(lForearm);

  const lHand = new THREE.Bone();
  lHand.name = 'CC_Base_L_Hand';
  lHand.position.set(0.035, -0.24 * heightScale, 0.01);
  lForearm.add(lHand);

  // 3. Extremidad Superior Derecha (Right Arm Chain)
  const rClavicle = new THREE.Bone();
  rClavicle.name = 'CC_Base_R_Clavicle';
  rClavicle.position.set(-0.08, 0.13 * heightScale, -0.01);
  chest.add(rClavicle);

  const rUpperArm = new THREE.Bone();
  rUpperArm.name = 'CC_Base_R_UpperArm';
  rUpperArm.position.set(-0.10, -0.02 * heightScale, -0.02);
  rClavicle.add(rUpperArm);

  const rForearm = new THREE.Bone();
  rForearm.name = 'CC_Base_R_Forearm';
  rForearm.position.set(-0.098, -0.26 * heightScale, -0.01);
  rUpperArm.add(rForearm);

  const rHand = new THREE.Bone();
  rHand.name = 'CC_Base_R_Hand';
  rHand.position.set(-0.035, -0.24 * heightScale, 0.01);
  rForearm.add(rHand);

  // 4. Extremidad Inferior Izquierda (Left Leg Chain)
  const lThigh = new THREE.Bone();
  lThigh.name = 'CC_Base_L_Thigh';
  lThigh.position.set(0.092, -0.05 * heightScale, 0.01);
  hips.add(lThigh);

  const lCalf = new THREE.Bone();
  lCalf.name = 'CC_Base_L_Calf';
  lCalf.position.set(0.0, -0.38 * heightScale, -0.01);
  lThigh.add(lCalf);

  const lFoot = new THREE.Bone();
  lFoot.name = 'CC_Base_L_Foot';
  lFoot.position.set(0.0, -0.38 * heightScale, -0.01);
  lCalf.add(lFoot);

  // 5. Extremidad Inferior Derecha (Right Leg Chain)
  const rThigh = new THREE.Bone();
  rThigh.name = 'CC_Base_R_Thigh';
  rThigh.position.set(-0.092, -0.05 * heightScale, 0.01);
  hips.add(rThigh);

  const rCalf = new THREE.Bone();
  rCalf.name = 'CC_Base_R_Calf';
  rCalf.position.set(0.0, -0.38 * heightScale, -0.01);
  rThigh.add(rCalf);

  const rFoot = new THREE.Bone();
  rFoot.name = 'CC_Base_R_Foot';
  rFoot.position.set(0.0, -0.38 * heightScale, -0.01);
  rCalf.add(rFoot);

  root.add(hips);

  const allBones = [
    hips,
    spine,
    chest,
    neck,
    head,
    lClavicle,
    rClavicle,
    lUpperArm,
    rUpperArm,
    lForearm,
    rForearm,
    lHand,
    rHand,
    lThigh,
    rThigh,
    lCalf,
    rCalf,
    lFoot,
    rFoot,
  ];

  const skeleton = new THREE.Skeleton(allBones);

  // 6. Visualizador de Esqueleto 3D (SkeletonHelper con líneas de conexión anatómicas)
  const helper = new THREE.SkeletonHelper(root);
  (helper.material as THREE.LineBasicMaterial).color = new THREE.Color('#FF6B4A'); // Coral BellAI
  (helper.material as THREE.LineBasicMaterial).linewidth = 3;
  (helper.material as THREE.LineBasicMaterial).depthTest = false;
  helper.renderOrder = 999;
  helper.visible = false;
  root.add(helper);

  // 7. Gizmos / Esferas luminosas en cada articulación anatómica (Joints Visuales)
  const jointsGroup = new THREE.Group();
  jointsGroup.name = 'CC_Joints_Gizmos';
  jointsGroup.renderOrder = 1000;
  jointsGroup.visible = false;

  const jointGeo = new THREE.SphereGeometry(0.016, 12, 10);
  const jointGeoMajor = new THREE.SphereGeometry(0.024, 14, 12);

  const jointMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FF5722'),
    emissive: new THREE.Color('#FF7043'),
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.1,
    depthTest: false,
  });

  const majorJointMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FF9800'),
    emissive: new THREE.Color('#FFB74D'),
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.2,
    depthTest: false,
  });

  // Vincular un gizmo visual a cada hueso relevante
  const keyBones: { bone: THREE.Bone; isMajor: boolean }[] = [
    { bone: hips, isMajor: true },
    { bone: spine, isMajor: false },
    { bone: chest, isMajor: true },
    { bone: neck, isMajor: false },
    { bone: head, isMajor: true },
    { bone: lUpperArm, isMajor: true },
    { bone: rUpperArm, isMajor: true },
    { bone: lForearm, isMajor: false },
    { bone: rForearm, isMajor: false },
    { bone: lHand, isMajor: false },
    { bone: rHand, isMajor: false },
    { bone: lThigh, isMajor: true },
    { bone: rThigh, isMajor: true },
    { bone: lCalf, isMajor: false },
    { bone: rCalf, isMajor: false },
    { bone: lFoot, isMajor: false },
    { bone: rFoot, isMajor: false },
  ];

  keyBones.forEach(({ bone, isMajor }) => {
    const marker = new THREE.Mesh(isMajor ? jointGeoMajor : jointGeo, isMajor ? majorJointMat : jointMat);
    marker.renderOrder = 1001;
    bone.add(marker);
  });

  root.add(jointsGroup);

  // 8. Control de visibilidad del Rig completo
  const setVisible = (visible: boolean) => {
    helper.visible = visible;
    jointsGroup.visible = visible;
    keyBones.forEach(({ bone }) => {
      bone.children.forEach((child) => {
        if (child instanceof THREE.Mesh) child.visible = visible;
      });
    });
  };

  // 9. Motor de Animación Esquelética Cinemática
  const animate = (time: number, mode: 'idle' | 'runway' | 'pause') => {
    if (mode === 'pause') {
      chest.rotation.set(0, 0, 0);
      spine.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      hips.rotation.set(0, 0, 0);
      lUpperArm.rotation.set(0, 0, 0);
      rUpperArm.rotation.set(0, 0, 0);
      (helper as any).update?.();
      return;
    }

    if (mode === 'idle') {
      // Respiración orgánica: expansión del tórax y elevación sutil de clavículas
      const breath = Math.sin(time * 2.2);
      const microSway = Math.sin(time * 1.1);

      chest.rotation.x = breath * 0.024;
      chest.rotation.z = microSway * 0.008;
      spine.rotation.x = breath * 0.010;

      // Compensación natural de la cabeza y atención visual
      head.rotation.x = -breath * 0.016;
      head.rotation.y = Math.sin(time * 0.65) * 0.035;

      // Brazos relajados que acompañan la respiración
      lUpperArm.rotation.z = breath * 0.008;
      rUpperArm.rotation.z = -breath * 0.008;
      lUpperArm.rotation.x = microSway * 0.012;
      rUpperArm.rotation.x = -microSway * 0.012;

      (helper as any).update?.();
      return;
    }

    if (mode === 'runway') {
      // Modo Pasarela de Alta Moda: cadencia de paso, contoneo de cadera y torsión de hombros
      const cadence = time * 3.6;
      const hipSway = Math.sin(cadence);
      const armSwing = Math.sin(cadence);

      // Movimiento rítmico de caderas
      hips.rotation.y = hipSway * 0.085;
      hips.rotation.z = hipSway * 0.040;

      // Contra-rotación del torso (caja torácica) para balance corporal elegante
      chest.rotation.y = -hipSway * 0.055;
      chest.rotation.x = Math.sin(cadence * 2) * 0.018;

      // Balanceo fluido pendular de brazos
      lUpperArm.rotation.x = armSwing * 0.16;
      rUpperArm.rotation.x = -armSwing * 0.16;
      lForearm.rotation.x = Math.max(0, -armSwing * 0.08);
      rForearm.rotation.x = Math.max(0, armSwing * 0.08);

      // Cabeza erguida y centrada hacia la cámara
      head.rotation.y = -hipSway * 0.030;
      head.rotation.x = 0.02;

      (helper as any).update?.();
      return;
    }
  };

  return {
    root,
    bones: {
      hips,
      spine,
      chest,
      neck,
      head,
      lClavicle,
      rClavicle,
      lUpperArm,
      rUpperArm,
      lForearm,
      rForearm,
      lHand,
      rHand,
      lThigh,
      rThigh,
      lCalf,
      rCalf,
      lFoot,
      rFoot,
    },
    skeleton,
    helper,
    jointsGroup,
    setVisible,
    animate,
  };
}

type Levels = Record<
  'height' | 'chin_h' | 'shoulder_h' | 'chest_h' | 'waist_h' | 'hip_h' | 'crotch_h' | 'knee_h' | 'ankle_h',
  number
>;

/** Niveles anatómicos (m) de la malla, escalados por la vista previa de estatura. */
function scaledLevels(mesh: AvatarScanMesh, heightRatio: number): Levels {
  const L = mesh.levels || {};
  const h = (L.height ?? 1.68) * heightRatio;
  const k = h / 1.7337; // los niveles por defecto son los del modelo base (cm sobre 173,37)
  const pick = (key: keyof Levels, baseCm: number) => (L[key] !== undefined ? L[key] * heightRatio : baseCm * k * 0.01);
  return {
    height: h,
    chin_h: pick('chin_h', 152.6),
    shoulder_h: pick('shoulder_h', 140),
    chest_h: pick('chest_h', 124),
    waist_h: pick('waist_h', 109),
    hip_h: pick('hip_h', 87),
    crotch_h: pick('crotch_h', 78),
    knee_h: pick('knee_h', 48),
    ankle_h: pick('ankle_h', 9),
  };
}

const ratioOf = (current: number | undefined, applied: number | undefined, lo = 0.7, hi = 1.4) =>
  Math.min(hi, Math.max(lo, (current ?? 1) / (applied && applied > 0 ? applied : 1)));

/**
 * Centro de cada vértice (media de `values`) en tramos de `size` a lo largo de `key`, suavizado e
 * interpolado entre tramos para que la deformación no deje escalones. Igual que _bin_centers en la IA.
 */
function binCenters(key: Float32Array, values: Float32Array[], mask: Uint8Array, size: number): Float32Array[] {
  const n = key.length;
  const out = values.map(() => new Float32Array(n));
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) if (mask[i]) { lo = Math.min(lo, key[i]); hi = Math.max(hi, key[i]); }
  if (!Number.isFinite(lo)) return out;
  const bins = Math.floor((hi - lo) / size) + 1;
  const count = new Float32Array(bins);
  const sums = values.map(() => new Float32Array(bins));
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const b = Math.floor((key[i] - lo) / size);
    count[b]++;
    values.forEach((v, j) => { sums[j][b] += v[i]; });
  }
  const centers = values.map((_, j) => {
    const c = new Float32Array(bins);
    let last = -1;
    for (let b = 0; b < bins; b++) {
      if (count[b] > 0) { c[b] = sums[j][b] / count[b]; if (last < 0) for (let k = 0; k < b; k++) c[k] = c[b]; last = b; }
      else if (last >= 0) c[b] = c[last];
    }
    if (bins > 2) {
      const s = new Float32Array(bins);
      for (let b = 0; b < bins; b++) s[b] = (c[Math.max(0, b - 1)] + 2 * c[b] + c[Math.min(bins - 1, b + 1)]) / 4;
      return s;
    }
    return c;
  });
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const u = Math.min(bins - 1, Math.max(0, (key[i] - lo) / size - 0.5));
    const i0 = Math.floor(u);
    const i1 = Math.min(i0 + 1, bins - 1);
    const f = u - i0;
    centers.forEach((c, j) => { out[j][i] = c[i0] * (1 - f) + c[i1] * f; });
  }
  return out;
}

/**
 * Vista previa de los deslizadores sobre la malla ya deformada por el servidor. Cada parte crece
 * alrededor de su propio eje (tronco y cada pierna) y los brazos solo se desplazan con los hombros:
 * escalar todo alrededor del origen inflaba los muslos y movía las manos. Devuelve la razón de estatura.
 */
function applyLiveDeformation(pos: Float32Array, mesh: AvatarScanMesh, config?: AvatarConfig): number {
  const a = mesh.applied ?? {};
  const rb = ratioOf(config?.bustScale, a.bustScale);
  const rw = ratioOf(config?.waistScale, a.waistScale);
  const rhips = ratioOf(config?.hipsScale, a.hipsScale);
  const rc = ratioOf(config?.complexionScale, a.complexionScale);
  const rs = ratioOf(config?.shouldersScale, a.shouldersScale, 0.85, 1.2);
  const rh = ratioOf(config?.heightScale, a.heightScale, 0.8, 1.25);
  const near1 = (x: number) => Math.abs(x - 1) < 1e-3;
  if ([rb, rw, rhips, rc, rs, rh].every(near1)) return 1;

  const n = pos.length / 3;
  const L = scaledLevels(mesh, 1);
  const k = L.height / 1.7337; // metros del modelo por cm del modelo base
  const code = (name: string) => mesh.regionNames[name];
  const TRUNK = new Set([code('torso'), code('pelvis')]);
  const LEG = new Set([code('muslo'), code('pierna'), code('pie')]);
  const ARM = new Set([code('hombro'), code('brazo'), code('antebrazo'), code('mano')].filter((c) => c !== undefined));

  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const zs = new Float32Array(n);
  const lower = new Uint8Array(n);
  const legL = new Uint8Array(n);
  const legR = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = pos[i * 3]; ys[i] = pos[i * 3 + 1]; zs[i] = pos[i * 3 + 2];
    const r = mesh.regions[i];
    if (TRUNK.has(r) || LEG.has(r)) lower[i] = 1;
    if (LEG.has(r)) (xs[i] >= 0 ? legR : legL)[i] = 1;
  }
  const [trunkZc] = binCenters(ys, [zs], lower, 0.02 * k);
  const [lxc, lzc] = binCenters(ys, [xs, zs], legL, 0.02 * k);
  const [rxc, rzc] = binCenters(ys, [xs, zs], legR, 0.02 * k);

  const gauss = (y: number, c: number, s: number) => Math.exp(-((y - c) ** 2) / (2 * s * s));
  const comp = rc - 1;
  const shift = 0.185 * k * ((rs - 1) + comp * 0.35);
  const blend0 = 0.66 * k;
  const blend1 = 0.82 * k;
  const xzScale = rh ** 0.35;

  for (let i = 0; i < n; i++) {
    const r = mesh.regions[i];
    const y = ys[i];
    const wW = gauss(y, L.waist_h, 0.07 * k);
    const wH = gauss(y, L.hip_h, 0.09 * k);
    const wSh = Math.min(1, Math.max(0, (y - 1.28 * k) / (0.1 * k)));
    const fx = (1 + (rw - 1) * wW) * (1 + (rhips - 1) * wH) * (1 + (rs - 1) * wSh) * (1 + comp * 0.35);
    const fz = (1 + (rw - 1) * 0.8 * wW) * (1 + (rhips - 1) * 0.7 * wH) * (1 + comp * 0.4);
    let x = xs[i];
    let z = zs[i];
    if (TRUNK.has(r)) {
      const wB = zs[i] > trunkZc[i] + 0.02 * k ? gauss(y, L.chest_h, 0.06 * k) : 0;
      x = xs[i] * fx * (1 + (rb - 1) * 0.15 * wB);
      z = trunkZc[i] + (zs[i] - trunkZc[i]) * fz + (rb - 1) * 0.038 * k * wB;
    } else if (LEG.has(r)) {
      const right = xs[i] >= 0;
      const cx = right ? rxc[i] : lxc[i];
      const cz = right ? rzc[i] : lzc[i];
      const legX = cx * (1 + (rhips - 1) * 0.6 * wH + comp * 0.15) + (xs[i] - cx) * (1 + (rhips - 1) * 0.9 * wH) * (1 + comp * 0.3);
      const legZ = cz + (zs[i] - cz) * (1 + (rhips - 1) * 0.7 * wH) * (1 + comp * 0.3);
      const b = Math.min(1, Math.max(0, (y - blend0) / (blend1 - blend0)));
      x = legX * (1 - b) + xs[i] * fx * b;
      z = legZ * (1 - b) + (trunkZc[i] + (zs[i] - trunkZc[i]) * fz) * b;
    } else if (ARM.has(r)) {
      x = xs[i] + Math.sign(xs[i]) * shift;
    }
    pos[i * 3] = x * xzScale;
    pos[i * 3 + 1] = y * rh;
    pos[i * 3 + 2] = z * xzScale;
  }
  return rh;
}

interface GarmentSpec {
  /** Regiones ceñidas al cuerpo. */
  regionNames: string[];
  offset: number;
  /** Bajo y borde superior rectos (m): se descartan los triángulos fuera de ese tramo. */
  yMin?: number;
  yMax?: number;
  /** Pieza con vuelo que envuelve ambas piernas (faldas, vestidos y abrigos largos). */
  skirt?: { topY: number; hemY: number; flare: number };
}

/** Bajo de una falda o vestido según su largo. */
function hemFor(length: AvatarGarment['length'], L: Levels): number {
  if (length === 'corto') return L.crotch_h - (L.crotch_h - L.knee_h) * 0.45;
  if (length === 'rodilla') return L.knee_h + 0.02;
  return L.ankle_h + (L.knee_h - L.ankle_h) * 0.25;
}

/** Qué cubre cada prenda: regiones ceñidas, alturas del bajo y, si la tiene, la falda con vuelo. */
function garmentSpec(g: AvatarGarment, mesh: AvatarScanMesh, L: Levels, tucked = false): GarmentSpec | null {
  // Mallas antiguas sin «hombro»: la manga corta usa el brazo completo
  const shortSleeve = mesh.regionNames.hombro !== undefined ? ['hombro'] : ['brazo'];
  const longSleeve = mesh.regionNames.hombro !== undefined ? ['hombro', 'brazo', 'antebrazo'] : ['brazo', 'antebrazo'];
  // Escote: un poco sobre los hombros, para que ninguna prenda suba por el cuello
  const neckline = L.shoulder_h + (L.chin_h - L.shoulder_h) * 0.3;
  switch (g.slot) {
    case 'torso': {
      const sleeves = g.subcategory === 'tops' ? [] : g.subcategory === 'camisetas' ? shortSleeve : longSleeve;
      // La blusa o camiseta llega a la cadera alta, con el bajo recto; con falda va metida en la cintura
      // Metida: baja un poco de la cintura para solaparse con la pretina de la falda o del short
      const hem = tucked ? L.waist_h - 0.045 : L.hip_h + (L.waist_h - L.hip_h) * 0.35;
      return { offset: 0.005, regionNames: ['torso', 'pelvis', ...sleeves], yMin: hem, yMax: neckline };
    }
    case 'abrigo': {
      const hem = g.length === 'corto' ? L.hip_h - 0.02 : g.length === 'rodilla' ? L.knee_h + 0.04 : L.ankle_h + 0.18;
      return {
        offset: 0.014,
        regionNames: ['torso', 'pelvis', ...longSleeve],
        yMax: neckline + 0.02,
        // Con faldón, el cuerpo ceñido termina en la cintura y el faldón cae desde ahí sin escalón
        yMin: hem < L.hip_h - 0.03 ? L.waist_h - 0.01 : L.hip_h,
        skirt: hem < L.hip_h - 0.03 ? { topY: L.waist_h, hemY: hem, flare: 0.08 } : undefined,
      };
    }
    case 'vestido': {
      // El armario no guarda el largo de los vestidos (llegan como «largo»): se muestran a la rodilla
      const length = g.length === 'corto' ? 'corto' : 'rodilla';
      return {
        offset: 0.006,
        // Con la pelvis: en algunas mallas el tronco termina sobre la cintura y quedaría un hueco
        regionNames: ['torso', 'pelvis'],
        yMin: L.waist_h - 0.01,
        yMax: neckline,
        skirt: { topY: L.waist_h + 0.005, hemY: hemFor(length, L), flare: length === 'corto' ? 0.16 : 0.24 },
      };
    }
    case 'cadera':
    case 'piernas': {
      if (g.slot === 'cadera' && g.subcategory !== 'shorts') {
        const flare = g.length === 'largo' ? 0.28 : g.length === 'rodilla' ? 0.2 : 0.12;
        return { offset: 0.006, regionNames: [], skirt: { topY: L.waist_h, hemY: hemFor(g.length, L), flare } };
      }
      // Pantalones y shorts (los shorts llegan con la ranura «cadera», como las faldas)
      const isShort = g.subcategory === 'shorts';
      return {
        offset: 0.006,
        regionNames: ['pelvis', 'muslo', 'pierna'],
        yMax: L.waist_h + 0.01,
        yMin: isShort ? L.crotch_h - (L.crotch_h - L.knee_h) * 0.35 : L.ankle_h + 0.015,
      };
    }
    case 'pies':
      return { offset: 0.008, regionNames: ['pie'] };
    default:
      return null;
  }
}

/**
 * Falda que envuelve ambas piernas. Cada anillo sigue el contorno real del cuerpo (sin brazos) ángulo
 * a ángulo, así ningún muslo atraviesa la tela. Por debajo de la cadera la tela cae: el anillo nunca
 * es más estrecho que el de arriba y se abre con `flare` hacia el bajo.
 */
function buildSkirt(
  pos: Float32Array,
  mesh: AvatarScanMesh,
  L: Levels,
  topY: number,
  hemY: number,
  flare: number,
  ease: number,
): THREE.BufferGeometry | null {
  if (!(topY > hemY)) return null;
  const code = (name: string) => mesh.regionNames[name];
  const body = new Set([code('torso'), code('pelvis'), code('muslo'), code('pierna')]);
  const RINGS = 16;
  const SEG = 48;
  const band = Math.max(0.012, (topY - hemY) / RINGS);
  const nVerts = mesh.regions.length;

  // Centro del cuerpo (x, z) a la altura de la cadera: todos los anillos comparten eje vertical
  let sx = 0, sz = 0, sn = 0;
  for (let i = 0; i < nVerts; i++) {
    if (!body.has(mesh.regions[i]) || Math.abs(pos[i * 3 + 1] - L.hip_h) > 0.03) continue;
    sx += pos[i * 3]; sz += pos[i * 3 + 2]; sn++;
  }
  if (!sn) return null;
  const cx = sx / sn;
  const cz = sz / sn;

  let prev: Float32Array | null = null;
  const radii: Float32Array[] = [];
  const ys: number[] = [];
  for (let r = 0; r <= RINGS; r++) {
    const y = topY - (topY - hemY) * (r / RINGS);
    const rad = new Float32Array(SEG);
    let found = false;
    for (let i = 0; i < nVerts; i++) {
      if (!body.has(mesh.regions[i]) || Math.abs(pos[i * 3 + 1] - y) > band) continue;
      const dx = pos[i * 3] - cx;
      const dz = pos[i * 3 + 2] - cz;
      let a = Math.atan2(dz, dx);
      if (a < 0) a += Math.PI * 2;
      const s = Math.floor((a / (Math.PI * 2)) * SEG) % SEG;
      const d = Math.hypot(dx, dz);
      if (d > rad[s]) rad[s] = d;
      found = true;
    }
    if (!found && !prev) return null;
    // Sectores vacíos (entre las piernas) toman el máximo de sus vecinos; luego se suaviza el contorno
    for (let pass = 0; pass < 2; pass++) {
      for (let s = 0; s < SEG; s++) {
        if (rad[s] > 0) continue;
        rad[s] = Math.max(rad[(s + SEG - 1) % SEG], rad[(s + 1) % SEG]);
      }
    }
    const smooth = new Float32Array(SEG);
    for (let s = 0; s < SEG; s++) {
      smooth[s] = Math.max(rad[s], (rad[(s + SEG - 1) % SEG] + rad[(s + 1) % SEG]) / 2);
    }
    if (y < L.hip_h && prev) {
      const below = Math.min(1, (L.hip_h - y) / Math.max(0.05, L.hip_h - hemY));
      const open = 1 + flare * below ** 1.4;
      for (let s = 0; s < SEG; s++) smooth[s] = Math.max(smooth[s], prev[s]) * open;
    }
    // Lo que no se abre se guarda sin vuelo, para que el vuelo no se acumule anillo a anillo
    const base = new Float32Array(SEG);
    for (let s = 0; s < SEG; s++) base[s] = prev ? Math.max(rad[s], prev[s]) : rad[s];
    prev = found ? base : prev;
    radii.push(smooth);
    ys.push(y);
  }

  const verts = new Float32Array(radii.length * SEG * 3);
  radii.forEach((rad, r) => {
    for (let s = 0; s < SEG; s++) {
      const ang = ((s + 0.5) / SEG) * Math.PI * 2;
      const o = (r * SEG + s) * 3;
      verts[o] = cx + Math.cos(ang) * (rad[s] + ease);
      verts[o + 1] = ys[r];
      verts[o + 2] = cz + Math.sin(ang) * (rad[s] + ease);
    }
  });
  const index: number[] = [];
  for (let r = 0; r < radii.length - 1; r++) {
    for (let s = 0; s < SEG; s++) {
      const a = r * SEG + s;
      const b = r * SEG + ((s + 1) % SEG);
      const c = (r + 1) * SEG + s;
      const d = (r + 1) * SEG + ((s + 1) % SEG);
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

const ORDER: AvatarGarment['slot'][] = ['piernas', 'cadera', 'pies', 'torso', 'vestido', 'abrigo'];

export function buildScannedAvatar(
  mesh: AvatarScanMesh,
  garments: AvatarGarment[] = [],
  config?: AvatarConfig,
): THREE.Group {
  const group = new THREE.Group();
  const pos = new Float32Array(mesh.positions);
  const col = new Float32Array(mesh.colors.length);
  for (let i = 0; i < mesh.colors.length; i++) col[i] = mesh.colors[i] / 255;

  const nVerts = pos.length / 3;

  // 1. Vista previa en tiempo real de los deslizadores. La malla del servidor ya trae aplicados los
  // valores guardados (`mesh.applied`): aquí solo se aplica la diferencia, para no deformar dos veces.
  const heightRatio = applyLiveDeformation(pos, mesh, config);

  // 2. Tonalidad de Piel del Usuario (el maniquí es siempre blanco: no se tiñe)
  const mannequin = mesh.style === 'maniqui';
  if (!mannequin && config?.skinHex && /^#[0-9A-Fa-f]{6}$/.test(config.skinHex)) {
    const skinCol = new THREE.Color(config.skinHex);
    for (let i = 0; i < nVerts; i++) {
      const reg = mesh.regions[i];
      // Si es piel (cabeza, cuello, torso, pelvis, extremidades)
      if (reg !== 1) {
        col[i * 3] = skinCol.r;
        col[i * 3 + 1] = skinCol.g;
        col[i * 3 + 2] = skinCol.b;
      }
    }
  }

  // 3. Malla del cuerpo con normales suaves y materiales estancos PBR
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  body.setAttribute('color', new THREE.BufferAttribute(col, 3));
  body.setIndex(mesh.indices);
  body.computeVertexNormals();

  const skinMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: mannequin ? 0.32 : 0.58, // maniquí satinado
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const bodyMesh = new THREE.Mesh(body, skinMaterial);
  group.add(bodyMesh);

  // 4. Integración del Rig y Esqueleto Óseo Character Creator
  // El rig está medido sobre la malla base de 1,68 m: se escala a la estatura real de esta malla
  const levels = scaledLevels(mesh, heightRatio);
  const h = levels.height;
  const rig = createCharacterCreatorRig(h / 1.68);
  group.add(rig.root);
  (group as any).userData.rig = rig;

  // 5. Peinados 3D volumétricos (limpios, sin casquete invasivo)
  const chinY = levels.chin_h;
  const headH = Math.max(0.18, h - chinY);
  const headR = headH * 0.44;
  const headY = chinY + headH * 0.65;
  const torsoLen = h * 0.3;
  const hairMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config?.hairHex || '#3B2A20'),
    roughness: 0.78,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });

  // El maniquí trae su cabello en la malla (mechones generados en el servidor)
  if (!mannequin) build3DHair(group, config || ({} as AvatarConfig), headR, headY, torsoLen, hairMat);

  // 6a. Prendas generadas en el servidor para el maniquí (o la ropa genérica)
  for (const g of mesh.garments ?? []) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.positions), 3));
    geo.setIndex(g.indices);
    geo.computeVertexNormals();
    const [r, gg, b] = g.color;
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: new THREE.Color(r / 255, gg / 255, b / 255),
      roughness: 0.85,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })));
  }

  // 6b. Ropa y Prendas del Armario adaptadas a las regiones anatómicas (modelos sin prendas del servidor)
  const normals = body.getAttribute('normal') as THREE.BufferAttribute;
  const idx = mesh.indices;
  const sorted = mesh.garments ? [] : [...garments].sort((a, b) => ORDER.indexOf(a.slot) - ORDER.indexOf(b.slot));

  // Con falda o shorts (ranura «cadera»), la parte de arriba va metida en la cintura
  const tucked = sorted.some((g) => g.slot === 'cadera');
  sorted.forEach((g, layer) => {
    const def = garmentSpec(g, mesh, levels, tucked);
    if (!def) return;

    const color = new THREE.Color(g.colorHex && /^#[0-9A-Fa-f]{6}$/.test(g.colorHex) ? g.colorHex : '#8C7B70');
    const clothMat = new THREE.MeshStandardMaterial({
      color,
      roughness: g.slot === 'pies' ? 0.45 : 0.82,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const off = def.offset + layer * 0.0025;

    // a) Parte ceñida: los triángulos del cuerpo de esas regiones, con el bajo recto a la altura indicada
    if (def.regionNames.length) {
      const allowed = new Set(def.regionNames.map((name) => mesh.regionNames[name]).filter((code) => code !== undefined));
      // El bajo recto solo corta tronco y piernas: con los brazos caídos, las manos quedan bajo la cintura
      const arms = new Set(['hombro', 'brazo', 'antebrazo', 'mano'].map((name) => mesh.regionNames[name]));
      const inside = (i: number) =>
        allowed.has(mesh.regions[i]) &&
        (arms.has(mesh.regions[i]) ||
          ((def.yMin === undefined || pos[i * 3 + 1] >= def.yMin) && (def.yMax === undefined || pos[i * 3 + 1] <= def.yMax)));
      const tris: number[] = [];
      for (let t = 0; t < idx.length; t += 3) {
        if (inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2])) tris.push(idx[t], idx[t + 1], idx[t + 2]);
      }
      if (tris.length) {
        const clothPos = new Float32Array(pos.length);
        for (let v = 0; v < nVerts; v++) {
          clothPos[v * 3] = pos[v * 3] + normals.getX(v) * off;
          clothPos[v * 3 + 1] = pos[v * 3 + 1] + normals.getY(v) * off;
          clothPos[v * 3 + 2] = pos[v * 3 + 2] + normals.getZ(v) * off;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(clothPos, 3));
        geo.setIndex(tris);
        geo.computeVertexNormals();
        group.add(new THREE.Mesh(geo, clothMat));
      }
    }

    // b) Falda, vuelo del vestido o faldón del abrigo: una pieza que envuelve ambas piernas y cae con vuelo
    if (def.skirt) {
      const skirt = buildSkirt(pos, mesh, levels, def.skirt.topY, def.skirt.hemY, def.skirt.flare, off + 0.006);
      if (skirt) group.add(new THREE.Mesh(skirt, clothMat));
    }
  });

  // 7. Pedestal de Estudio de Moda y Sombra de Contacto
  const platform = new THREE.Group();
  platform.name = 'Fashion_Studio_Platform';

  // Disco pedestal biselado
  const pedestalGeo = new THREE.CylinderGeometry(0.54, 0.58, 0.024, 36);
  const pedestalMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FAF8F5'),
    roughness: 0.70,
    metalness: 0.05,
  });
  const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestalMesh.position.y = -0.012;
  platform.add(pedestalMesh);

  // Anillo de acento metálico sutil
  const ringGeo = new THREE.TorusGeometry(0.56, 0.006, 12, 36);
  const ringMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E07A5F'),
    roughness: 0.35,
    metalness: 0.4,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  platform.add(ringMesh);

  // Sombra de contacto difusa
  const shadowGeo = new THREE.RingGeometry(0.0, 0.52, 32);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#1E1B18'),
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = Math.PI / 2;
  shadowMesh.position.y = 0.001;
  platform.add(shadowMesh);

  group.add(platform);

  // Centrado vertical armónico
  group.position.y = -h / 2;
  return group;
}

/** Sistema de Peinados 3D volumétricos sin casquete artificial invasivo. */
function build3DHair(
  group: THREE.Group,
  config: AvatarConfig,
  headR: number,
  headY: number,
  torsoLen: number,
  hairMat: THREE.Material,
) {
  const style = config.hairStyle || 'Liso';
  const lenType = config.hairLength || 'Medio';

  if (style === 'Afro') {
    const afroVolume = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.35, 24, 20), hairMat);
    afroVolume.scale.set(1.02, 1.10, 1.04);
    afroVolume.position.set(0, headY + headR * 0.38, -headR * 0.06);
    group.add(afroVolume);

    for (let i = 0; i < 20; i++) {
      const theta = (i / 20) * Math.PI * 2;
      const phi = Math.PI * 0.22 + ((i % 5) / 5) * (Math.PI * 0.55);
      const puffR = headR * (0.24 + 0.05 * (i % 3));
      const puff = new THREE.Mesh(new THREE.SphereGeometry(puffR, 10, 8), hairMat);
      const dist = headR * 1.32;
      puff.position.set(
        Math.sin(phi) * Math.cos(theta) * dist * 0.98,
        headY + headR * 0.35 + Math.cos(phi) * dist * 1.05,
        Math.sin(phi) * Math.sin(theta) * dist * 0.95 - headR * 0.06,
      );
      group.add(puff);
    }
    return;
  }

  if (style === 'Rizado') {
    const strandLen = lenType === 'Largo' ? torsoLen * 0.75 : lenType === 'Medio' ? torsoLen * 0.42 : torsoLen * 0.22;
    const strandRadius = headR * 0.032;
    const numCurls = lenType === 'Largo' ? 20 : lenType === 'Medio' ? 14 : 9;

    for (let i = 0; i < numCurls; i++) {
      const angle = (i / numCurls) * Math.PI * 1.6 + Math.PI * 0.7;
      const startX = Math.cos(angle) * headR * 1.02;
      const startZ = Math.sin(angle) * headR * 0.92;
      const startY = headY + headR * 0.22 - (i % 4) * 0.02;

      const curlCurve = new HelixCurve(
        headR * 0.12,
        strandLen * (0.8 + 0.4 * ((i % 3) / 2)),
        lenType === 'Largo' ? 6.0 : 4.0,
        0.88,
        startX * 0.2,
        startZ * 0.2,
      );

      const curlMesh = new THREE.Mesh(new THREE.TubeGeometry(curlCurve, 32, strandRadius, 8, false), hairMat);
      curlMesh.position.set(startX, startY, startZ);
      group.add(curlMesh);
    }

    for (const side of [-1, 1]) {
      const frontCurl = new HelixCurve(headR * 0.08, headR * 0.35, 3.0, 0.82, side * 0.01, 0.01);
      const m = new THREE.Mesh(new THREE.TubeGeometry(frontCurl, 22, headR * 0.022, 7, false), hairMat);
      m.position.set(side * headR * 0.65, headY + headR * 0.25, headR * 0.65);
      group.add(m);
    }
    return;
  }

  if (style === 'Ondulado') {
    const strandLen = lenType === 'Largo' ? torsoLen * 0.80 : lenType === 'Medio' ? torsoLen * 0.45 : torsoLen * 0.24;
    const numStrands = 14;

    for (let i = 0; i < numStrands; i++) {
      const angle = (i / numStrands) * Math.PI * 1.5 + Math.PI * 0.75;
      const startX = Math.cos(angle) * headR * 1.04;
      const startZ = Math.sin(angle) * headR * 0.96;
      const startY = headY + headR * 0.22 - (i % 3) * 0.015;

      const wavyCurve = new WavyStrandCurve(strandLen * (0.85 + 0.3 * ((i % 4) / 3)), headR * 0.11, 2.2, startX * 0.28);
      const strand = new THREE.Mesh(new THREE.TubeGeometry(wavyCurve, 28, headR * 0.045, 8, false), hairMat);
      strand.position.set(startX, startY, startZ);
      group.add(strand);
    }

    for (const side of [-1, 1]) {
      const frontWave = new WavyStrandCurve(headR * 0.52, headR * 0.07, 1.8, side * 0.03);
      const m = new THREE.Mesh(new THREE.TubeGeometry(frontWave, 22, headR * 0.035, 7, false), hairMat);
      m.position.set(side * headR * 0.70, headY + headR * 0.18, headR * 0.55);
      group.add(m);
    }
    return;
  }

  if (style === 'Bob') {
    const bobLen = headR * 1.20;
    const bobBack = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 1.05, headR * 1.22, bobLen, 24, 1, true, Math.PI * 0.50, Math.PI * 1.00),
      hairMat,
    );
    bobBack.position.set(0, headY - bobLen * 0.25, -headR * 0.08);
    (bobBack.material as THREE.Material).side = THREE.DoubleSide;
    group.add(bobBack);

    for (const side of [-1, 1]) {
      const sideFlap = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.10, bobLen * 0.92, headR * 0.40), hairMat);
      sideFlap.position.set(side * headR * 0.88, headY - bobLen * 0.26, headR * 0.22);
      sideFlap.rotation.y = side * 0.25;
      sideFlap.rotation.z = -side * 0.1;
      group.add(sideFlap);
    }
    return;
  }

  if (style === 'Pixie') {
    const pixieTop = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.08, 18, 14), hairMat);
    pixieTop.scale.set(0.95, 0.68, 1.02);
    pixieTop.position.set(0, headY + headR * 0.40, -headR * 0.02);
    group.add(pixieTop);

    const fringe = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.16, headR * 0.32, headR * 0.38, 12), hairMat);
    fringe.rotation.z = Math.PI * 0.35;
    fringe.position.set(headR * 0.30, headY + headR * 0.50, headR * 0.68);
    group.add(fringe);
    return;
  }

  if (style === 'Recogido') {
    const bun = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.26, headR * 0.15, 14, 24), hairMat);
    bun.rotation.x = Math.PI * 0.5;
    bun.position.set(0, headY + headR * 1.12, -headR * 0.18);
    group.add(bun);

    const bunCore = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.24, 14, 12), hairMat);
    bunCore.position.set(0, headY + headR * 1.12, -headR * 0.18);
    group.add(bunCore);

    for (const side of [-1, 1]) {
      const tendril = new WavyStrandCurve(headR * 0.60, headR * 0.035, 1.5, side * 0.02);
      const m = new THREE.Mesh(new THREE.TubeGeometry(tendril, 16, headR * 0.016, 6, false), hairMat);
      m.position.set(side * headR * 0.80, headY + headR * 0.14, headR * 0.42);
      group.add(m);
    }
    return;
  }

  if (style === 'Coleta') {
    const tie = new THREE.Mesh(
      new THREE.TorusGeometry(headR * 0.14, headR * 0.04, 10, 18),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#C2410C'), roughness: 0.6 }),
    );
    tie.position.set(0, headY + headR * 0.72, -headR * 0.85);
    tie.rotation.x = Math.PI * 0.3;
    group.add(tie);

    const tailLen = lenType === 'Largo' ? torsoLen * 0.82 : torsoLen * 0.48;
    const tailCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, headY + headR * 0.72, -headR * 0.85),
      new THREE.Vector3(0, headY + headR * 0.42, -headR * 1.30),
      new THREE.Vector3(0, headY + headR * 0.72 - tailLen, -headR * 0.90),
    );
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 26, headR * 0.11, 10, false), hairMat);
    group.add(tail);
    return;
  }

  // Liso (Straight)
  if (lenType !== 'Corto') {
    const len = lenType === 'Largo' ? torsoLen * 0.80 : lenType === 'Medio' ? torsoLen * 0.42 : torsoLen * 0.24;

    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 1.02, headR * 1.15, len, 24, 1, true, Math.PI * 0.50, Math.PI * 1.00),
      hairMat,
    );
    back.position.set(0, headY - len / 2 + headR * 0.25, -headR * 0.14);
    (back.material as THREE.Material).side = THREE.DoubleSide;
    group.add(back);

    for (const side of [-1, 1]) {
      const strandLen = len * 0.82;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.16, headR * 0.12, strandLen, 12), hairMat);
      strand.position.set(side * headR * 0.76, headY - strandLen / 2 + headR * 0.08, headR * 0.32);
      strand.rotation.z = -side * 0.05;
      strand.scale.set(0.65, 1.0, 1.0);
      group.add(strand);
    }
  }
}
