import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, Camera, Eye, Palette, Pause, Play, RotateCw, Scan, ScanFace, Scissors, Shirt, Sparkles, Trash2, User } from 'lucide-react-native';

import { Banner, Chip, ContentState } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralScreen,
  CoralTitle,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { avatarApi, outfitsApi } from '@/features/bellai/api/bellaiApi';
import type {
  AvatarConfig,
  AvatarPreset,
  AvatarGarment,
  AvatarMeasurements,
  AvatarScanMesh,
  SavedOutfit,
} from '@/features/bellai/api/types';
import { buildAvatar } from '@/features/bellai/ui/avatarBuilder';
import { buildScannedAvatar, type AvatarRig } from '@/features/bellai/ui/scannedAvatar';
import baseMeshFemale from '@/features/bellai/ui/baseMeshFemale.json';
import { BodyShapeIcon, PRESET_LABELS } from '@/features/bellai/ui/BodyShapeIcon';
import { serverGarments } from '@/features/bellai/ui/garmentKinds';

const DEFAULT_CONFIG: AvatarConfig = {
  version: '1.0',
  source: 'predeterminado',
  scan: null,
  bodyType: null,
  skinHex: '#C99A7A',
  hairHex: '#3B2A20',
  hairStyle: 'Liso',
  hairLength: 'Medio',
  eyeColorHex: '#5D4037',
  complexion: 'Equilibrada',
  complexionScale: 1.0,
  heightScale: 1.0,
  bustScale: 1.0,
  waistScale: 1.0,
  hipsScale: 1.0,
  shouldersScale: 1.0,
  hasBodyAnalysis: false,
  diagnosisInfo: null,
  hint: null,
  proportions: { shoulder: 1.0, waist: 0.75, hip: 1.0, legToBody: 0.58 },
};

/** Medidas del escaneo que se muestran, en orden. */
const MEASURES: { key: keyof AvatarMeasurements; label: string }[] = [
  { key: 'estaturaCm', label: 'Estatura' },
  { key: 'pechoCm', label: 'Pecho' },
  { key: 'cinturaCm', label: 'Cintura' },
  { key: 'caderaCm', label: 'Cadera' },
  { key: 'anchoHombrosCm', label: 'Hombros' },
  { key: 'largoBrazoCm', label: 'Largo de brazo' },
  { key: 'entrepiernaCm', label: 'Entrepierna' },
  { key: 'musloCm', label: 'Muslo' },
];

/** Tonos de piel con nombre. */
const SKINS: { hex: string; name: string }[] = [
  { hex: '#F3D3C0', name: 'Muy claro' },
  { hex: '#E6B89C', name: 'Claro' },
  { hex: '#C99A7A', name: 'Medio' },
  { hex: '#A8754F', name: 'Trigueño' },
  { hex: '#7A5236', name: 'Oscuro' },
  { hex: '#4E3324', name: 'Profundo' },
];

/** Colores de Iris / Ojos con brillo natural. */
const EYE_COLORS: { hex: string; name: string }[] = [
  { hex: '#3E2723', name: 'Marrón café' },
  { hex: '#5D4037', name: 'Avellana' },
  { hex: '#B5651D', name: 'Miel ámbar' },
  { hex: '#2E7D32', name: 'Verde esmeralda' },
  { hex: '#1565C0', name: 'Azul zafiro' },
  { hex: '#78909C', name: 'Gris tormenta' },
];

/** Estilos y texturas tridimensionales de cabello. */
const HAIR_STYLES: { id: NonNullable<AvatarConfig['hairStyle']>; label: string; desc: string }[] = [
  { id: 'Liso', label: 'Lacio', desc: 'Caída limpia y pulida' },
  { id: 'Ondulado', label: 'Ondulado', desc: 'Ondas con movimiento' },
];

/** HU-023: siluetas base del maniquí (la usuaria elige; la IA recomienda). */
const PRESETS: AvatarPreset[] = ['rectangulo', 'pera', 'reloj', 'triangulo_invertido', 'redondo'];

/** Colores de cabello naturales y de tendencia. */
const HAIR_COLORS: { hex: string; name: string }[] = [
  { hex: '#1C1917', name: 'Negro' },
  { hex: '#3B2A20', name: 'Castaño oscuro' },
  { hex: '#6D4C41', name: 'Castaño claro' },
  { hex: '#CA8A04', name: 'Rubio dorado' },
  { hex: '#C2410C', name: 'Cobrizo' },
  { hex: '#E2D9C8', name: 'Platino' },
  { hex: '#831843', name: 'Borgoña' },
];

const HEIGHTS: { value: number; label: string }[] = [
  { value: 0.92, label: 'Menuda' },
  { value: 1.0, label: 'Media' },
  { value: 1.08, label: 'Espigada' },
];

const BUST_MODS: { value: number; label: string }[] = [
  { value: 0.90, label: 'Sutil' },
  { value: 1.0, label: 'Natural' },
  { value: 1.16, label: 'Realzado' },
];

const WAIST_MODS: { value: number; label: string }[] = [
  { value: 0.88, label: 'Entallada' },
  { value: 1.0, label: 'Natural' },
  { value: 1.12, label: 'Suave' },
];

const HIPS_MODS: { value: number; label: string }[] = [
  { value: 0.92, label: 'Suave' },
  { value: 1.0, label: 'Equilibrada' },
  { value: 1.15, label: 'Curvilínea' },
];

type CustomTab = 'silueta' | 'rostro' | 'cabello' | 'outfits';

/** Malla del servidor que se puede usar: el maniquí o una malla densa (escaneo / modelo anterior). */
const usableMesh = (m: AvatarScanMesh | null | undefined): m is AvatarScanMesh =>
  Boolean(m && m.indices && (m.style === 'maniqui' || m.indices.length >= 80000));

/** HU-022 / HU-023: avatar 3D anatómico y personalizable, vestido con tu armario. */
export const AvatarScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const params = useLocalSearchParams<{ outfitId?: string }>();
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_CONFIG);
  const [garments, setGarments] = useState<AvatarGarment[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [outfitId, setOutfitId] = useState<string | undefined>(params.outfitId);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomTab>('silueta');

  // Malla anatómica Character Creator femenina
  const [mesh, setMesh] = useState<AvatarScanMesh>(baseMeshFemale as unknown as AvatarScanMesh);
  const [removing, setRemoving] = useState(false);
  const [animMode, setAnimMode] = useState<'idle' | 'runway' | 'pause'>('idle');
  const animModeRef = useRef<'idle' | 'runway' | 'pause'>('idle');

  // Control del Rig y Esqueleto Óseo Character Creator
  const [showRig, setShowRig] = useState(false);
  const showRigRef = useRef(false);
  const toggleRig = () => {
    setShowRig((prev) => {
      const next = !prev;
      showRigRef.current = next;
      return next;
    });
  };

  // Control de Encuadres de Cámara Cinemática (Cuerpo entero, Busto/Torso, Rostro)
  const [cameraView, setCameraView] = useState<'full' | 'torso' | 'face'>('full');
  const targetCameraPos = useRef(new THREE.Vector3(0, 0.05, 3.6));
  const targetCameraLook = useRef(new THREE.Vector3(0, 0.0, 0));

  const switchCameraView = (view: 'full' | 'torso' | 'face') => {
    setCameraView(view);
    if (view === 'full') {
      targetCameraPos.current.set(0, 0.05, 3.6);
      targetCameraLook.current.set(0, 0.0, 0);
    } else if (view === 'torso') {
      targetCameraPos.current.set(0, 0.28, 1.85);
      targetCameraLook.current.set(0, 0.22, 0);
    } else if (view === 'face') {
      targetCameraPos.current.set(0, 0.65, 1.15);
      targetCameraLook.current.set(0, 0.62, 0);
    }
  };

  const switchAnim = (mode: 'idle' | 'runway' | 'pause') => {
    setAnimMode(mode);
    animModeRef.current = mode;
  };

  const scene = useRef<{ root: THREE.Group | null; scene: THREE.Scene | null }>({ root: null, scene: null });
  const [motion] = useState(() => ({ rotation: 0, drag: 0 }));
  const frame = useRef<number | null>(null);

  const load = useCallback(
    () =>
      Promise.all([avatarApi.get().catch(() => null), outfitsApi.list().catch(() => [] as SavedOutfit[])])
        .then(async ([cfg, list]) => {
          if (cfg) setConfig((prev) => ({ ...prev, ...cfg }));
          setOutfits(list);
          const scanned = await avatarApi.mesh().catch(() => null);
          if (usableMesh(scanned)) setMesh(scanned);
        })
        .catch((err) => setError(friendlyMessage(err, 'No pudimos preparar tu avatar.'))),
    [],
  );

  useEffect(() => {
    void load();
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [load]);

  useEffect(() => {
    if (!outfitId) return;
    avatarApi
      .dress(outfitId)
      .then((r) => setGarments(r.items))
      .catch((err) => setActionError(friendlyMessage(err, 'No pudimos vestir tu avatar con ese outfit.')));
  }, [outfitId]);

  const shown = useMemo(() => (outfitId ? garments : []), [outfitId, garments]);
  const garmentKey = useMemo(() => serverGarments(shown), [shown]);

  // El maniquí se viste en el servidor: al cambiar de outfit se pide la malla con esas prendas
  const firstGarmentKey = useRef(true);
  useEffect(() => {
    if (firstGarmentKey.current) {
      firstGarmentKey.current = false;
      return;
    }
    avatarApi
      .mesh(garmentKey || undefined)
      .then((m) => {
        if (usableMesh(m)) setMesh(m);
      })
      .catch(() => undefined);
  }, [garmentKey]);

  // Reconstruye el avatar cuando cambian medidas, rasgos o prendas
  useEffect(() => {
    const s = scene.current;
    if (!s.scene || !config) return;
    if (s.root) s.scene.remove(s.root);
    s.root = buildScannedAvatar(mesh, shown, config);
    s.scene.add(s.root);
  }, [config, shown, mesh]);

  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderMove: (_, g) => {
        motion.drag = g.dx / 120;
      },
      onPanResponderRelease: () => {
        motion.rotation += motion.drag;
        motion.drag = 0;
      },
    }),
  );

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const canvas = {
      width: w,
      height: h,
      style: {},
      clientHeight: h,
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => gl,
    } as any;
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl as any, antialias: true });
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const s = new THREE.Scene();

    // Iluminación de estudio de moda tridimensional con Rim Light
    s.add(new THREE.HemisphereLight(0xffffff, 0x5c4d42, 1.25));

    // Luz principal (Key Light frontal-superior derecha cálida)
    const key = new THREE.DirectionalLight(0xfff7f0, 1.6);
    key.position.set(1.6, 2.4, 2.2);
    s.add(key);

    // Luz de relleno (Fill Light frontal izquierda suave)
    const fill = new THREE.DirectionalLight(0xe5f0ff, 0.70);
    fill.position.set(-1.6, 1.2, 1.6);
    s.add(fill);

    // Luz de contorno / recorte trasera (Rim Light que resalta silueta y cabello)
    const rim = new THREE.DirectionalLight(0xffe2d2, 1.4);
    rim.position.set(0.0, 2.2, -2.6);
    rim.target.position.set(0, 1.2, 0);
    s.add(rim);
    s.add(rim.target);

    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 50);
    camera.position.set(0, 0.05, 3.6);
    scene.current.scene = s;
    if (config) {
      scene.current.root = buildScannedAvatar(mesh, shown, config);
      s.add(scene.current.root);
    }

    const currentLook = new THREE.Vector3(0, 0, 0);

    const render = () => {
      const st = scene.current;
      const t = Date.now() * 0.0018;

      // Interpolación suave y cinematográfica de la cámara
      camera.position.lerp(targetCameraPos.current, 0.08);
      currentLook.lerp(targetCameraLook.current, 0.08);
      camera.lookAt(currentLook);

      if (st.root) {
        if (animModeRef.current === 'runway') {
          if (!motion.drag) motion.rotation += 0.010;
        } else if (animModeRef.current === 'idle') {
          if (!motion.drag) motion.rotation += 0.0018;
        }
        st.root.rotation.y = motion.rotation + motion.drag;

        // Actualizar y animar el Rig de Character Creator en tiempo real
        const rig = (st.root as any).userData?.rig as AvatarRig | undefined;
        if (rig) {
          rig.setVisible(showRigRef.current);
          rig.animate(t, animModeRef.current);
        }

        // Animación complementaria de respiración y presencia viva
        if (animModeRef.current !== 'pause') {
          const breath = Math.sin(t * 2.2);
          const sway = Math.sin(t * 1.1);
          st.root.position.y = (-1.68 / 2) + breath * 0.003;
          st.root.rotation.z = sway * 0.008;
          st.root.rotation.x = breath * 0.005;
        }
      }
      renderer.render(s, camera);
      gl.endFrameEXP();
      frame.current = requestAnimationFrame(render);
    };
    render();
  };

  const customize = async (
    patch: Partial<
      Pick<
        AvatarConfig,
        | 'skinHex'
        | 'hairHex'
        | 'hairLength'
        | 'hairStyle'
        | 'eyeColorHex'
        | 'complexion'
        | 'complexionScale'
        | 'heightScale'
        | 'bustScale'
        | 'waistScale'
        | 'hipsScale'
        | 'shouldersScale'
        | 'preset'
        | 'hairFringe'
      >
    >,
  ) => {
    if (!config) return;
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    setActionError(null);
    try {
      const saved = await avatarApi.save({
        skinHex: next.skinHex,
        hairHex: next.hairHex,
        hairLength: next.hairLength,
        hairStyle: next.hairStyle,
        eyeColorHex: next.eyeColorHex,
        complexion: next.complexion,
        complexionScale: next.complexionScale,
        heightScale: next.heightScale,
        bustScale: next.bustScale,
        waistScale: next.waistScale,
        hipsScale: next.hipsScale,
        shouldersScale: next.shouldersScale,
        preset: next.preset,
        hairFringe: next.hairFringe,
      });
      setConfig(saved);
      const updatedMesh = await avatarApi.mesh(garmentKey || undefined).catch(() => null);
      if (usableMesh(updatedMesh)) setMesh(updatedMesh);
    } catch (err) {
      setActionError(friendlyMessage(err, 'No pudimos guardar tus cambios.'));
    } finally {
      setSaving(false);
    }
  };

  const skins =
    config && !SKINS.some((s) => s.hex.toLowerCase() === config.skinHex.toLowerCase())
      ? [
          {
            hex: config.skinHex,
            name: config.diagnosisInfo?.skinTone ? `Detectado (${config.diagnosisInfo.skinTone})` : 'Tu tono detectado',
          },
          ...SKINS.slice(0, 5),
        ]
      : SKINS;

  const eyes =
    config?.eyeColorHex && !EYE_COLORS.some((e) => e.hex.toLowerCase() === config.eyeColorHex!.toLowerCase())
      ? [{ hex: config.eyeColorHex, name: 'Tu iris detectado' }, ...EYE_COLORS.slice(0, 5)]
      : EYE_COLORS;

  const hairColors =
    config?.hairHex && !HAIR_COLORS.some((hc) => hc.hex.toLowerCase() === config.hairHex.toLowerCase())
      ? [
          {
            hex: config.hairHex,
            name: config.diagnosisInfo?.hairColor ? `Detectado (${config.diagnosisInfo.hairColor})` : 'Tu color detectado',
          },
          ...HAIR_COLORS.slice(0, 6),
        ]
      : HAIR_COLORS;

  const goToBodyCapture = () => router.push({ pathname: '/', params: { capture: 'body' } });
  const goToScan = () => router.push('/avatar-scan' as any);

  const removeScan = async () => {
    setRemoving(true);
    setActionError(null);
    try {
      await avatarApi.removeScan();
      setMesh(baseMeshFemale as unknown as AvatarScanMesh);
      setConfig(await avatarApi.get());
    } catch (err) {
      setActionError(friendlyMessage(err, 'No pudimos borrar tu escaneo.'));
    } finally {
      setRemoving(false);
    }
  };

  const chooseOutfit = (id?: string) => {
    setActionError(null);
    setOutfitId(id);
  };

  return (
    <CoralScreen withTabBar contentStyle={styles.content}>
      <View style={styles.header}>
        <CoralBackButton onPress={() => router.back()} />
        <View style={styles.flex}>
          <CoralTitle prefix="Mi " accent="avatar" size={28} />
        </View>
      </View>
      <Text style={[coralText.small, { color: c.ink2 }]}>
        Gira tu avatar 3D para inspeccionar proporciones y vestirlo con combinaciones de tu armario.
      </Text>

      {error && !config ? (
        <ContentState
          kind="error"
          title="No pudimos cargar tu avatar"
          description={error}
          actionLabel="Reintentar"
          onAction={() => {
            setError(null);
            void load();
          }}
        />
      ) : null}

      {!config && !error ? <ContentState kind="loading" loading title="Preparando tu avatar 3D" /> : null}

      {config ? (
        <>
          <Appear>
            <CoralCard radius={24} padding={0} style={styles.stageCard}>
              <View
                {...pan.panHandlers}
                style={styles.stage}
                accessible
                accessibilityRole="image"
                accessibilityLabel={`Avatar 3D interactivo${
                  config.bodyType ? `, silueta ${config.bodyType}` : ''
                }${shown.length ? `, vestido con ${shown.map((g) => g.name ?? g.subcategory).join(', ')}` : ''}. Desliza hacia los lados para rotar.`}
              >
                <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

                {/* Barra superior de herramientas 3D: Rig Toggle y Encuadre de Cámara */}
                <View style={styles.topControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showRig ? 'Ocultar esqueleto y articulaciones del rig 3D' : 'Visualizar esqueleto y articulaciones del rig 3D'}
                    onPress={toggleRig}
                    style={[styles.rigToggleBtn, showRig && styles.rigToggleBtnActive]}
                  >
                    <Activity size={13} color={showRig ? '#FFF' : c.ink} />
                    <Text style={[styles.rigToggleText, showRig ? styles.textWhite : { color: c.ink }]}>
                      {showRig ? 'Rig 3D: Activo' : 'Ver Rig 3D'}
                    </Text>
                  </Pressable>

                  <View style={styles.camControls}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Encuadre cuerpo entero"
                      onPress={() => switchCameraView('full')}
                      style={[styles.camBtn, cameraView === 'full' && { backgroundColor: c.accent }]}
                    >
                      <Text style={[styles.camBtnText, cameraView === 'full' ? styles.textWhite : { color: c.ink }]}>Cuerpo</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Encuadre busto y torso"
                      onPress={() => switchCameraView('torso')}
                      style={[styles.camBtn, cameraView === 'torso' && { backgroundColor: c.accent }]}
                    >
                      <Text style={[styles.camBtnText, cameraView === 'torso' ? styles.textWhite : { color: c.ink }]}>Torso</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Encuadre rostro y facciones"
                      onPress={() => switchCameraView('face')}
                      style={[styles.camBtn, cameraView === 'face' && { backgroundColor: c.accent }]}
                    >
                      <Text style={[styles.camBtnText, cameraView === 'face' ? styles.textWhite : { color: c.ink }]}>Rostro</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Barra inferior de controles de animación */}
                <View style={styles.animControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Animación de respiración orgánica"
                    onPress={() => switchAnim('idle')}
                    style={[styles.animBtn, animMode === 'idle' && { backgroundColor: c.accent }]}
                  >
                    <Sparkles size={12} color={animMode === 'idle' ? '#FFF' : c.ink} />
                    <Text style={[styles.animBtnText, animMode === 'idle' ? { color: '#FFF' } : { color: c.ink }]}>Respirar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Modo pasarela giro continuo"
                    onPress={() => switchAnim('runway')}
                    style={[styles.animBtn, animMode === 'runway' && { backgroundColor: c.accent }]}
                  >
                    <RotateCw size={12} color={animMode === 'runway' ? '#FFF' : c.ink} />
                    <Text style={[styles.animBtnText, animMode === 'runway' ? { color: '#FFF' } : { color: c.ink }]}>Pasarela</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pausar animación"
                    onPress={() => switchAnim('pause')}
                    style={[styles.animBtn, animMode === 'pause' && { backgroundColor: c.accent }]}
                  >
                    <Pause size={12} color={animMode === 'pause' ? '#FFF' : c.ink} />
                    <Text style={[styles.animBtnText, animMode === 'pause' ? { color: '#FFF' } : { color: c.ink }]}>Pausa</Text>
                  </Pressable>
                </View>
              </View>
            </CoralCard>
          </Appear>

          {!config.scan ? (
            <Banner
              kind="info"
              title="Escanea tu silueta para un modelo con tus medidas biométricas"
              description="Te guiamos con la voz: tu rostro, pose T y un giro completo de 360°."
              actionLabel="Escanear"
              onAction={goToScan}
            />
          ) : null}

          {actionError ? (
            <Banner kind="error" title={actionError} description="Vuelve a intentarlo en un momento." />
          ) : null}

          {/* Selector de pestañas para personalizar */}
          <View style={styles.tabRow} accessibilityRole="tablist">
            {(
              [
                { id: 'silueta', label: 'Silueta', icon: <User size={15} color={activeTab === 'silueta' ? '#FFF' : c.ink} /> },
                { id: 'rostro', label: 'Rostro y Ojos', icon: <Eye size={15} color={activeTab === 'rostro' ? '#FFF' : c.ink} /> },
                { id: 'cabello', label: 'Cabello', icon: <Scissors size={15} color={activeTab === 'cabello' ? '#FFF' : c.ink} /> },
                { id: 'outfits', label: 'Armario', icon: <Shirt size={15} color={activeTab === 'outfits' ? '#FFF' : c.ink} /> },
              ] as const
            ).map((t) => {
              const active = activeTab === t.id;
              return (
                <Pressable
                  key={t.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Pestaña ${t.label}`}
                  onPress={() => setActiveTab(t.id)}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: active ? c.accent : c.field,
                      borderColor: active ? c.accent : c.fieldStroke,
                    },
                  ]}
                >
                  {t.icon}
                  <Text
                    style={[
                      coralText.caption,
                      {
                        color: active ? '#FFFFFF' : c.ink,
                        fontFamily: active ? coralFonts.extrabold : coralFonts.semibold,
                      },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* PESTAÑA: SILUETA Y COMPLEXIÓN */}
          {activeTab === 'silueta' ? (
            <Appear delay={50}>
              <CoralCard radius={24} style={styles.gap}>
                <View style={styles.cardHead}>
                  <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>
                    Constitución y Proporciones
                  </Text>
                  {saving ? (
                    <Text accessibilityLiveRegion="polite" style={[coralText.caption, { color: c.ink2 }]}>
                      Guardando…
                    </Text>
                  ) : null}
                </View>

                {config.bodyType ? (
                  <View style={[styles.diagnosisBadge, { backgroundColor: c.chip, borderColor: c.fieldStroke }]}>
                    <Text style={[coralText.caption, { color: c.ink, fontFamily: coralFonts.semibold }]}>
                      Silueta identificada en análisis: {config.bodyType}
                    </Text>
                  </View>
                ) : null}

                {config.recommendation ? (
                  <View style={[styles.recoCard, { backgroundColor: c.chip, borderColor: c.fieldStroke }]}>
                    <BodyShapeIcon preset={config.recommendation.preset} size={34} color={c.accent} />
                    <View style={styles.recoText}>
                      <Text style={[coralText.strong, { color: c.ink }]}>
                        BellAI te recomienda: {PRESET_LABELS[config.recommendation.preset]}
                      </Text>
                      <Text style={[coralText.caption, { color: c.ink2 }]}>{config.recommendation.reason}</Text>
                    </View>
                    {config.preset !== config.recommendation.preset ? (
                      <Chip
                        label="Aplicar"
                        active
                        disabled={saving}
                        onPress={() => void customize({ preset: config.recommendation!.preset })}
                      />
                    ) : null}
                  </View>
                ) : null}

                <Text style={[coralText.strong, { color: c.ink }]}>Silueta base</Text>
                <View style={styles.presetRow} accessibilityRole="radiogroup" accessibilityLabel="Silueta base">
                  {PRESETS.map((id) => {
                    const active = (config.preset ?? 'reloj') === id;
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active, disabled: saving }}
                        accessibilityLabel={PRESET_LABELS[id]}
                        disabled={saving}
                        onPress={() => void customize({ preset: id })}
                        style={[
                          styles.presetIcon,
                          { backgroundColor: active ? c.chip : c.field, borderColor: active ? c.accent : c.fieldStroke },
                        ]}
                      >
                        <BodyShapeIcon preset={id} size={34} color={active ? c.accent : c.ink2} />
                        <Text numberOfLines={1} style={[coralText.caption, { color: active ? c.accent : c.ink, fontSize: 10 }]}>
                          {PRESET_LABELS[id].split(' ')[0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[coralText.strong, { color: c.ink, marginTop: 4 }]}>Estatura relativa</Text>
                <View style={styles.wrap}>
                  {HEIGHTS.map((h) => (
                    <Chip
                      key={h.label}
                      label={h.label}
                      active={Math.abs(config.heightScale - h.value) < 0.02}
                      disabled={saving}
                      onPress={() => void customize({ heightScale: h.value })}
                    />
                  ))}
                </View>

                <Text style={[coralText.strong, { color: c.ink, marginTop: 6 }]}>Busto y Torso</Text>
                <View style={styles.wrap}>
                  {BUST_MODS.map((b) => (
                    <Chip
                      key={b.label}
                      label={b.label}
                      active={Math.abs((config.bustScale ?? 1.0) - b.value) < 0.03}
                      disabled={saving}
                      onPress={() => void customize({ bustScale: b.value })}
                    />
                  ))}
                </View>

                <Text style={[coralText.strong, { color: c.ink, marginTop: 6 }]}>Entalle de Cintura</Text>
                <View style={styles.wrap}>
                  {WAIST_MODS.map((w) => (
                    <Chip
                      key={w.label}
                      label={w.label}
                      active={Math.abs((config.waistScale ?? 1.0) - w.value) < 0.03}
                      disabled={saving}
                      onPress={() => void customize({ waistScale: w.value })}
                    />
                  ))}
                </View>

                <Text style={[coralText.strong, { color: c.ink, marginTop: 6 }]}>Curvatura de Caderas</Text>
                <View style={styles.wrap}>
                  {HIPS_MODS.map((hp) => (
                    <Chip
                      key={hp.label}
                      label={hp.label}
                      active={Math.abs((config.hipsScale ?? 1.0) - hp.value) < 0.03}
                      disabled={saving}
                      onPress={() => void customize({ hipsScale: hp.value })}
                    />
                  ))}
                </View>
              </CoralCard>
            </Appear>
          ) : null}

          {/* PESTAÑA: ROSTRO Y OJOS */}
          {activeTab === 'rostro' ? (
            <Appear delay={50}>
              <CoralCard radius={24} style={styles.gap}>
                <View style={styles.cardHead}>
                  <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>
                    Rasgos Faciales y Mirada
                  </Text>
                  {saving ? (
                    <Text accessibilityLiveRegion="polite" style={[coralText.caption, { color: c.ink2 }]}>
                      Guardando…
                    </Text>
                  ) : null}
                </View>

                <Text style={[coralText.strong, { color: c.ink }]}>Color de Iris y Ojos</Text>
                <Text style={[coralText.caption, { color: c.ink2 }]}>
                  Define el tono del iris, brillo especular y profundidad de la mirada.
                </Text>
                <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Color de iris">
                  {eyes.map((e) => {
                    const active = (config.eyeColorHex || '#5D4037').toLowerCase() === e.hex.toLowerCase();
                    return (
                      <Pressable
                        key={e.hex}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active, disabled: saving }}
                        accessibilityLabel={`Ojos tono ${e.name}`}
                        disabled={saving}
                        onPress={() => void customize({ eyeColorHex: e.hex })}
                        style={({ pressed }) => [styles.skinCell, pressed && { opacity: 0.7 }]}
                      >
                        <View style={[styles.skinRing, { borderColor: active ? c.accent : 'transparent' }]}>
                          <View style={[styles.eyePreview, { backgroundColor: e.hex, borderColor: c.fieldStroke }]}>
                            <View style={styles.pupilPreview} />
                            <View style={styles.glintPreview} />
                          </View>
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            coralText.caption,
                            styles.center,
                            {
                              color: active ? c.ink : c.ink2,
                              fontFamily: active ? coralFonts.extrabold : coralFonts.semibold,
                            },
                          ]}
                        >
                          {e.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[coralText.strong, { color: c.ink, marginTop: 6 }]}>Tono de piel</Text>
                <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Tono de piel">
                  {skins.map((s) => {
                    const on = s.hex.toLowerCase() === config.skinHex.toLowerCase();
                    return (
                      <Pressable
                        key={s.hex}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: saving }}
                        accessibilityLabel={`Tono de piel ${s.name}`}
                        disabled={saving}
                        onPress={() => void customize({ skinHex: s.hex })}
                        style={({ pressed }) => [styles.skinCell, pressed && { opacity: 0.7 }]}
                      >
                        <View style={[styles.skinRing, { borderColor: on ? c.accent : 'transparent' }]}>
                          <View style={[styles.skin, { backgroundColor: s.hex, borderColor: c.fieldStroke }]} />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            coralText.caption,
                            styles.center,
                            {
                              color: on ? c.ink : c.ink2,
                              fontFamily: on ? coralFonts.extrabold : coralFonts.semibold,
                            },
                          ]}
                        >
                          {s.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </CoralCard>
            </Appear>
          ) : null}

          {/* PESTAÑA: CABELLO, RIZOS Y COLOR */}
          {activeTab === 'cabello' ? (
            <Appear delay={50}>
              <CoralCard radius={24} style={styles.gap}>
                <View style={styles.cardHead}>
                  <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>
                    Peinado y Textura 3D
                  </Text>
                  {saving ? (
                    <Text accessibilityLiveRegion="polite" style={[coralText.caption, { color: c.ink2 }]}>
                      Guardando…
                    </Text>
                  ) : null}
                </View>

                <Text style={[coralText.strong, { color: c.ink }]}>Estilo y Textura</Text>
                <Text style={[coralText.caption, { color: c.ink2 }]}>
                  Modelado tridimensional en bucles espirales, ondas o liso pulido.
                </Text>
                <View style={styles.wrap}>
                  {HAIR_STYLES.map((st) => (
                    <Chip
                      key={st.id}
                      label={st.label}
                      active={(config.hairStyle || 'Liso') === st.id}
                      disabled={saving}
                      onPress={() => void customize({ hairStyle: st.id })}
                    />
                  ))}
                </View>

                <Text style={[coralText.strong, { color: c.ink, marginTop: 4 }]}>Longitud de melena</Text>
                <View style={styles.wrap}>
                  {(['Corto', 'Medio', 'Largo'] as const).map((l) => (
                    <Chip
                      key={l}
                      label={l}
                      active={config.hairLength === l}
                      disabled={saving}
                      onPress={() => void customize({ hairLength: l })}
                    />
                  ))}
                </View>

                <Text style={[coralText.strong, { color: c.ink, marginTop: 4 }]}>Flequillo</Text>
                <View style={styles.wrap}>
                  {([false, true] as const).map((f) => (
                    <Chip
                      key={String(f)}
                      label={f ? 'Con flequillo' : 'Sin flequillo'}
                      active={Boolean(config.hairFringe) === f}
                      disabled={saving}
                      onPress={() => void customize({ hairFringe: f })}
                    />
                  ))}
                </View>

                <Text style={[coralText.strong, { color: c.ink, marginTop: 4 }]}>Color de cabello</Text>
                <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Color de cabello">
                  {hairColors.map((hc) => {
                    const on = hc.hex.toLowerCase() === config.hairHex.toLowerCase();
                    return (
                      <Pressable
                        key={hc.hex}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: saving }}
                        accessibilityLabel={`Color de cabello ${hc.name}`}
                        disabled={saving}
                        onPress={() => void customize({ hairHex: hc.hex })}
                        style={({ pressed }) => [styles.skinCell, pressed && { opacity: 0.7 }]}
                      >
                        <View style={[styles.skinRing, { borderColor: on ? c.accent : 'transparent' }]}>
                          <View style={[styles.hairPreview, { backgroundColor: hc.hex, borderColor: c.fieldStroke }]} />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            coralText.caption,
                            styles.center,
                            {
                              color: on ? c.ink : c.ink2,
                              fontFamily: on ? coralFonts.extrabold : coralFonts.semibold,
                            },
                          ]}
                        >
                          {hc.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </CoralCard>
            </Appear>
          ) : null}

          {/* PESTAÑA: OUTFITS DEL ARMARIO */}
          {activeTab === 'outfits' ? (
            <Appear delay={50}>
              <CoralCard radius={24} style={styles.gap}>
                <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>
                  Probar Prendas de tu Armario
                </Text>
                {outfits.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                    <Chip label="Sin ropa" active={!outfitId} onPress={() => chooseOutfit(undefined)} />
                    {outfits.map((o) => (
                      <Chip
                        key={o.id}
                        label={o.title || 'Outfit guardado'}
                        active={outfitId === o.id}
                        onPress={() => chooseOutfit(o.id)}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <>
                    <Text style={[coralText.small, { color: c.ink2 }]}>
                      Genera combinaciones con tus prendas escaneadas para probárselas a tu avatar 3D en tiempo real.
                    </Text>
                    <CoralButton
                      title="Crear outfits con mi armario"
                      variant="secondary"
                      height={44}
                      onPress={() => router.push('/outfits' as any)}
                      leftIcon={<Shirt size={18} color={c.ink} />}
                      fullWidth
                    />
                  </>
                )}
              </CoralCard>
            </Appear>
          ) : null}

          {/* MEDIDAS BIOMÉTRICAS (SI HAY ESCANEO ACTIVO) */}
          {config.scan ? (
            <Appear delay={200}>
              <CoralCard radius={24} style={styles.gap}>
                <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>
                  Medidas Corporales Reales
                </Text>
                <View style={styles.measures}>
                  {MEASURES.map((m) => (
                    <View key={m.key} style={[styles.measure, { backgroundColor: c.field }]}>
                      <Text style={[coralText.caption, { color: c.ink2 }]}>{m.label}</Text>
                      <Text style={[coralText.strong, { color: c.ink }]}>
                        {Math.round(config.scan!.measurements[m.key])} cm
                      </Text>
                    </View>
                  ))}
                </View>
                {config.scan.quality.warnings.length ? (
                  <Text style={[coralText.caption, { color: c.ink2 }]}>
                    {config.scan.quality.warnings.join(' ')}
                  </Text>
                ) : null}
                <CoralButton
                  title="Repetir escaneo guiado"
                  variant="secondary"
                  height={44}
                  onPress={goToScan}
                  leftIcon={<ScanFace size={18} color={c.ink} />}
                  fullWidth
                />
                <CoralButton
                  title={removing ? 'Eliminando…' : 'Borrar datos de escaneo'}
                  variant="light"
                  height={44}
                  disabled={removing}
                  onPress={() => void removeScan()}
                  leftIcon={<Trash2 size={18} color={c.ink} />}
                  fullWidth
                />
              </CoralCard>
            </Appear>
          ) : null}

          {!config.scan && config.hasBodyAnalysis ? (
            <CoralButton
              title="Actualizar fotografía de cuerpo"
              variant="secondary"
              height={44}
              onPress={goToBodyCapture}
              leftIcon={<Camera size={18} color={c.ink} />}
              fullWidth
            />
          ) : null}
        </>
      ) : null}
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 24 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  gap: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stageCard: { overflow: 'hidden' },
  stage: { width: '100%', height: 420 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  diagnosisBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  recoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10 },
  recoText: { flex: 1, gap: 2 },
  presetRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  presetIcon: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, minHeight: 64 },
  complexionChip: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 2,
  },
  skinCell: { width: 66, alignItems: 'center', gap: 4, minHeight: 48 },
  skinRing: { padding: 3, borderRadius: 28, borderWidth: 2 },
  skin: { width: 44, height: 44, borderRadius: 22, borderWidth: 1 },
  hairPreview: { width: 44, height: 44, borderRadius: 22, borderWidth: 1 },
  eyePreview: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pupilPreview: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#0B0B0B' },
  glintPreview: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 10,
    right: 12,
  },
  measures: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  measure: { flexGrow: 1, flexBasis: '45%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  topControls: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  rigToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  rigToggleBtnActive: {
    backgroundColor: '#FF5722',
    borderColor: '#FF5722',
  },
  rigToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  camControls: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 18,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  camBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 15,
  },
  camBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  animControls: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  animBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  animBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
