import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LucideIcon } from 'lucide-react-native';
import { Footprints, RotateCw, ScanFace, Shirt, Smartphone, Sun, Volume2, X } from 'lucide-react-native';
import { Banner, InputText } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralScreen,
  CoralTitle,
  Mascot,
  coralFonts,
  coralText,
  useCoral,
  useCoralFieldStyles,
} from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { hapticFeedback } from '@/shared/lib/haptics';
import { voice } from '@/shared/lib/speech';
import { avatarApi, consentApi, waitForTask } from '@/features/bellai/api/bellaiApi';

/**
 * HU-023: escaneo guiado para el avatar 3D. El teléfono solo hace fotos con indicaciones en voz,
 * texto y vibración; el servidor mide el cuerpo y arma la malla:
 * 1. cara con el teléfono en la mano: de frente, a cada lado, arriba y abajo;
 * 2. teléfono apoyado y la persona a unos 2,5 m: pose T;
 * 3. una vuelta despacio sobre sí misma mientras la cámara toma fotos.
 */

type Phase = 'cara' | 'apoyar' | 'pose' | 'giro';
interface Step {
  id: string;
  phase: Phase;
  title: string;
  say: string;
  /** Segundos de cuenta atrás antes de la foto (o de espera en «apoyar»). */
  wait: number;
  field?: string;
}

const STEPS: Step[] = [
  { id: 'frente', phase: 'cara', field: 'face_frente', wait: 4, title: 'Mira de frente al teléfono', say: 'Sostén el teléfono frente a tu cara, con el brazo estirado, y mira a la cámara.' },
  { id: 'tres_cuartos_izq', phase: 'cara', field: 'face_tres_cuartos_izq', wait: 3, title: 'Gira 45° a tu izquierda', say: 'Gira la cabeza ligeramente a tu izquierda, mostrando el pómulo.' },
  { id: 'perfil_izq', phase: 'cara', field: 'face_perfil_izq', wait: 3, title: 'Perfil izquierdo completo', say: 'Gira la cabeza completamente a tu izquierda para capturar tu perfil.' },
  { id: 'tres_cuartos_der', phase: 'cara', field: 'face_tres_cuartos_der', wait: 3, title: 'Gira 45° a tu derecha', say: 'Ahora gira la cabeza a tu derecha en tres cuartos.' },
  { id: 'perfil_der', phase: 'cara', field: 'face_perfil_der', wait: 3, title: 'Perfil derecho completo', say: 'Gira la cabeza completamente a tu derecha para tu perfil.' },
  { id: 'arriba', phase: 'cara', field: 'face_arriba', wait: 3, title: 'Sube un poco la barbilla', say: 'Mira al frente y sube un poco la barbilla para mapear el cuello.' },
  { id: 'abajo', phase: 'cara', field: 'face_abajo', wait: 3, title: 'Baja un poco la barbilla', say: 'Ahora baja un poco la barbilla para la frente.' },
  { id: 'apoyar', phase: 'apoyar', wait: 15, title: 'Apoya el teléfono y aléjate', say: 'Excelente. Apoya el teléfono de pie sobre una mesa, con la pantalla hacia ti, y aléjate unos dos metros y medio, hasta que se vea todo tu cuerpo.' },
  { id: 'pose', phase: 'pose', field: 'tpose', wait: 5, title: 'Abre los brazos en T', say: 'Abre los brazos en cruz, como una letra T, y quédate quieta.' },
  { id: 'giro', phase: 'giro', wait: 3, title: 'Gira despacio sobre tu sitio', say: 'Baja los brazos, un poco separados del cuerpo, y da una vuelta completa despacio sobre tu sitio.' },
];

const TURN_SECONDS = 16;
const TURN_MAX_FRAMES = 16;
const TURN_MIN_GAP_MS = 700;
const HEIGHT_KEY = 'bellai.avatar.estatura';

const TIPS: { Icon: LucideIcon; text: string }[] = [
  { Icon: Sun, text: 'Un lugar con buena luz y fondo despejado' },
  { Icon: Shirt, text: 'Ropa ajustada y el cabello recogido detrás de los hombros' },
  { Icon: Smartphone, text: 'Una mesa o repisa para apoyar el teléfono de pie' },
  { Icon: Footprints, text: 'Unos 2,5 metros libres delante del teléfono' },
  { Icon: Volume2, text: 'Sube el volumen: te iremos diciendo qué hacer' },
];

type Mode = 'intro' | 'capture' | 'subiendo' | 'procesando' | 'error';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shrink = async (uri: string, width: number) =>
  (await manipulateAsync(uri, [{ resize: { width } }], { compress: 0.8, format: SaveFormat.JPEG })).uri;
/** Intentos de encuadre antes de seguir igual (el servidor tiene respaldo con las fotos del giro). */
const FRAMING_TRIES = 5;
const TPOSE_TRIES = 3;

export const AvatarScanScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { iconColor: _iconColor, ...field } = useCoralFieldStyles();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [mode, setMode] = useState<Mode>('intro');
  const [height, setHeight] = useState('');
  const [heightError, setHeightError] = useState<string | undefined>();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [turnShots, setTurnShots] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  // Indicación del encuadre («se te cortan los pies…») y si se está comprobando
  const [hint, setHint] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const cancelled = useRef(false);
  const [flash] = useState(() => new Animated.Value(0));
  useKeepAwake();

  useEffect(() => {
    AsyncStorage.getItem(HEIGHT_KEY).then((v) => v && setHeight(v)).catch(() => {});
    consentApi.current('photo_analysis').then(setConsent).catch(() => setConsent(false));
    return () => {
      cancelled.current = true;
      voice.stop();
    };
  }, []);

  const shoot = useCallback(async (): Promise<string | null> => {
    if (!camera.current) return null;
    const shot = await camera.current.takePictureAsync({ quality: 0.7, shutterSound: false });
    flash.setValue(0.7);
    Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    return shot?.uri ?? null;
  }, [flash]);

  /** Cuenta atrás con vibración en cada segundo. Devuelve false si se canceló. */
  const countdown = useCallback(async (seconds: number) => {
    for (let s = seconds; s > 0; s--) {
      if (cancelled.current) return false;
      setCount(s);
      if (s <= 3) void hapticFeedback.light();
      await sleep(1000);
    }
    setCount(null);
    return !cancelled.current;
  }, []);


  const upload = useCallback(async (shots: { field: string; uri: string }[], heightCm: number) => {
    setMode('subiendo');
    setProgress(0);
    try {
      const photos = [];
      for (const s of shots) photos.push({ field: s.field, uri: await shrink(s.uri, s.field.startsWith('turn_') ? 720 : 960) });
      const task = await avatarApi.scan(photos, heightCm);
      setMode('procesando');
      voice.say('Listo. Ya puedes tomar el teléfono. Estamos armando tu avatar.');
      const done = await waitForTask(task, setProgress, 300000);
      if (cancelled.current) return;
      if (done.status !== 'completada') throw new Error(done.error || 'No pudimos armar tu avatar. Repite el escaneo.');
      void hapticFeedback.success();
      voice.say('Tu avatar está listo.');
      router.replace({ pathname: '/avatar', params: { escaneado: '1' } } as any);
    } catch (err) {
      if (cancelled.current) return;
      setError(friendlyMessage(err, err instanceof Error ? err.message : 'No pudimos armar tu avatar.'));
      setMode('error');
    }
  }, [router]);

  /** Comprueba en el servidor si se ve el cuerpo entero. null si no se pudo comprobar (se sigue igual). */
  const checkFrame = useCallback(async (uri: string) => {
    setChecking(true);
    try {
      return await avatarApi.checkBody(await shrink(uri, 720));
    } catch {
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  /** Al acabar de colocarse: foto de prueba y, si no se ve entera, la indicación en voz hasta que sí. */
  const frameLoop = useCallback(async () => {
    for (let t = 0; t < FRAMING_TRIES; t++) {
      const uri = await shoot().catch(() => null);
      if (!uri || cancelled.current) return !cancelled.current;
      const r = await checkFrame(uri);
      if (cancelled.current) return false;
      if (!r || r.ok) {
        setHint(null);
        if (r) voice.say('Perfecto, te vemos entera.');
        return true;
      }
      setHint(r.message);
      voice.say(r.message);
      void hapticFeedback.medium();
      await sleep(5000);
      if (!(await countdown(3))) return false;
    }
    setHint(null);
    return true;
  }, [shoot, checkFrame, countdown]);

  /** Foto en pose T comprobada: si se corta el cuerpo o no se ven los brazos en T, se repite. */
  const tposeShot = useCallback(async (): Promise<string | null> => {
    let uri: string | null = null;
    for (let t = 0; t < TPOSE_TRIES; t++) {
      uri = await shoot().catch(() => null);
      if (!uri || cancelled.current) return uri;
      const r = await checkFrame(uri);
      if (cancelled.current) return null;
      if (!r || (r.ok && r.tpose)) break;
      if (t === TPOSE_TRIES - 1) break;
      const msg = r.ok ? 'Abre más los brazos, rectos a la altura de los hombros, como una T.' : r.message;
      setHint(msg);
      voice.say(`${msg} Otra vez.`);
      await sleep(4500);
      if (!(await countdown(3))) return null;
    }
    setHint(null);
    return uri;
  }, [shoot, checkFrame, countdown]);

  const run = useCallback(async (heightCm: number) => {
    cancelled.current = false;
    setMode('capture');
    const shots: { field: string; uri: string }[] = [];
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      setStepIndex(i);
      voice.say(step.say);
      void hapticFeedback.medium();
      // Margen para escuchar la indicación antes de la cuenta atrás
      await sleep(step.phase === 'cara' ? 1800 : 2600);
      if (!(await countdown(step.wait))) return;
      if (step.phase === 'apoyar' && !(await frameLoop())) return;
      if (step.field) {
        const uri = step.field === 'tpose' ? await tposeShot() : await shoot().catch(() => null);
        if (cancelled.current) return;
        if (!uri) {
          setError('No pudimos usar la cámara. Ciérrala en otras apps e inténtalo de nuevo.');
          setMode('error');
          return;
        }
        shots.push({ field: step.field, uri });
        void hapticFeedback.success();
      }
      if (step.phase === 'giro') {
        voice.say('Gira ahora, despacio.');
        const start = Date.now();
        let n = 0;
        let half = false;
        while (Date.now() - start < TURN_SECONDS * 1000 && n < TURN_MAX_FRAMES) {
          if (cancelled.current) return;
          const t0 = Date.now();
          const uri = await shoot().catch(() => null);
          if (uri) {
            shots.push({ field: `turn_${n}`, uri });
            n += 1;
            setTurnShots(n);
          }
          if (!half && Date.now() - start > (TURN_SECONDS * 1000) / 2) {
            half = true;
            voice.say('Vas por la mitad. Sigue girando.');
          }
          const gap = TURN_MIN_GAP_MS - (Date.now() - t0);
          if (gap > 0) await sleep(gap);
        }
        void hapticFeedback.success();
      }
    }
    if (!cancelled.current) await upload(shots, heightCm);
  }, [countdown, shoot, upload, frameLoop, tposeShot]);

  const start = async () => {
    const h = Number(height.replace(',', '.'));
    if (!Number.isFinite(h) || h < 120 || h > 220) {
      setHeightError('Escribe tu estatura en centímetros, por ejemplo 162.');
      return;
    }
    setHeightError(undefined);
    await AsyncStorage.setItem(HEIGHT_KEY, String(Math.round(h))).catch(() => {});
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setError(null);
    setTurnShots(0);
    setCameraReady(false);
    void run(h);
  };

  const cancel = () => {
    cancelled.current = true;
    voice.stop();
    setCount(null);
    setMode('intro');
  };

  const allowPhotos = async () => {
    try {
      await consentApi.set('photo_analysis', true);
      setConsent(true);
    } catch (err) {
      setError(friendlyMessage(err, 'No pudimos guardar tu autorización.'));
    }
  };

  // ------------------------------------------------ Captura (pantalla completa, letras grandes: se lee a 2,5 m)
  if (mode === 'capture') {
    const step = STEPS[stepIndex];
    const faceSteps = STEPS.filter((s) => s.phase === 'cara').length;
    const label = step.phase === 'cara'
      ? `Cara · ${stepIndex + 1} de ${faceSteps}`
      : step.phase === 'apoyar' ? 'Cuerpo · prepárate' : step.phase === 'pose' ? 'Cuerpo · pose T' : `Cuerpo · giro${turnShots ? ` · ${turnShots} fotos` : ''}`;
    return (
      <View style={styles.dark}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" onCameraReady={() => setCameraReady(true)} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: flash }]} />
        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar el escaneo" onPress={cancel} style={styles.roundDark}>
            <X size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.dots} accessibilityLabel={`Paso ${stepIndex + 1} de ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <View key={s.id} style={[styles.dot, { backgroundColor: i <= stepIndex ? c.accent : 'rgba(255,255,255,0.35)', width: i === stepIndex ? 18 : 8 }]} />
            ))}
          </View>
          <View style={styles.roundSpacer} />
        </View>

        <View style={[styles.instruction, { top: insets.top + 70 }]} accessibilityLiveRegion="assertive">
          <Text style={[coralText.caption, styles.center, { color: '#FFD5A1', fontFamily: coralFonts.extrabold }]}>{label}</Text>
          <Text style={[styles.bigText, step.phase === 'cara' ? null : styles.hugeText]}>{step.title}</Text>
          {!cameraReady ? <ActivityIndicator color="#FFFFFF" accessibilityLabel="Abriendo la cámara" /> : null}
          {hint ? <Text style={[styles.hint, { color: '#FFD5A1' }]}>{hint}</Text> : null}
          {checking ? <Text style={[coralText.caption, styles.center, { color: '#FFFFFF' }]}>Comprobando que te vemos entera…</Text> : null}
        </View>

        {count !== null ? (
          <View style={styles.countWrap} pointerEvents="none">
            <Text style={styles.count} accessibilityLabel={`${count} segundos`}>{count}</Text>
          </View>
        ) : step.phase === 'giro' && turnShots > 0 ? (
          <View style={styles.countWrap} pointerEvents="none">
            <RotateCw size={96} color="#FFFFFF" />
          </View>
        ) : null}

        {step.phase === 'pose' || step.phase === 'apoyar' ? (
          <View pointerEvents="none" style={[styles.frame, { top: insets.top + 190, bottom: insets.bottom + 40 }]} />
        ) : null}
        {step.phase === 'cara' ? <View pointerEvents="none" style={[styles.oval, { top: insets.top + 200 }]} /> : null}
      </View>
    );
  }

  // ------------------------------------------------ Introducción, subida y resultado
  return (
    <CoralScreen keyboard contentStyle={styles.content}>
      <View style={styles.header}>
        <CoralBackButton onPress={() => { cancel(); router.back(); }} disabled={mode === 'subiendo'} />
        <View style={styles.flex}>
          <CoralTitle prefix="Escanea tu " accent="cuerpo" size={28} />
        </View>
      </View>

      {mode === 'subiendo' || mode === 'procesando' ? (
        <Appear>
          <CoralCard radius={24} style={styles.processing}>
            <Mascot pose="pensando" height={150} float />
            <Text accessibilityRole="header" style={[coralText.section, styles.center, { color: c.ink }]}>
              {mode === 'subiendo' ? 'Subiendo tus fotos…' : 'Armando tu avatar con tus medidas…'}
            </Text>
            <Text style={[coralText.small, styles.center, { color: c.ink2 }]}>
              {mode === 'subiendo'
                ? 'No cierres la app hasta que termine la subida.'
                : 'Tarda menos de un minuto. Puedes salir de la app: te avisamos cuando esté listo.'}
            </Text>
            {mode === 'procesando' ? (
              <View style={[styles.bar, { backgroundColor: c.field }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }}>
                <View style={[styles.barFill, { width: `${Math.max(6, progress)}%`, backgroundColor: c.accent }]} />
              </View>
            ) : (
              <ActivityIndicator color={c.accent} />
            )}
          </CoralCard>
        </Appear>
      ) : (
        <>
          {mode === 'error' && error ? <Banner kind="error" title="No pudimos terminar el escaneo" description={error} /> : null}

          <Appear>
            <CoralCard radius={24} style={styles.gap}>
              <Text style={[coralText.body, { color: c.ink }]}>
                Te guiaremos con la voz en tres partes: tu cara con el teléfono en la mano, una pose T con el teléfono apoyado y una vuelta despacio. Dura un minuto.
              </Text>
              {TIPS.map(({ Icon, text }) => (
                <View key={text} style={styles.tip}>
                  <Icon size={20} color={c.accent} strokeWidth={2.2} />
                  <Text style={[coralText.label, styles.flex, { color: c.ink }]}>{text}</Text>
                </View>
              ))}
            </CoralCard>
          </Appear>

          <Appear delay={100}>
            <CoralCard radius={24} style={styles.gap}>
              <InputText
                {...field}
                label="Tu estatura (cm)"
                value={height}
                onChangeText={(t) => { setHeight(t.replace(/[^0-9,.]/g, '')); setHeightError(undefined); }}
                keyboardType="numeric"
                maxLength={5}
                placeholder="Ej. 162"
                errorText={heightError}
              />
              <Text style={[coralText.caption, { color: c.ink2 }]}>
                Con tu estatura pasamos las fotos a centímetros reales. Las fotos se borran al terminar; solo guardamos el modelo 3D y tus medidas.
              </Text>
            </CoralCard>
          </Appear>

          {consent === false ? (
            <Banner
              kind="info"
              title="Necesitamos tu autorización para analizar tus fotos"
              description="Solo se usan para medir tu cuerpo y armar tu avatar."
              actionLabel="Autorizar"
              onAction={() => void allowPhotos()}
            />
          ) : null}

          {permission && !permission.granted && !permission.canAskAgain ? (
            <Banner kind="info" title="Activa la cámara para BellAI en los ajustes del teléfono" actionLabel="Abrir ajustes" onAction={() => void Linking.openSettings()} />
          ) : null}

          <CoralButton
            title={mode === 'error' ? 'Repetir el escaneo' : 'Empezar el escaneo'}
            onPress={() => void start()}
            disabled={consent !== true}
            leftIcon={<ScanFace size={20} color={c.onPrimary} />}
            fullWidth
          />
          {!voice.available() ? (
            <Text style={[coralText.caption, styles.center, { color: c.ink2 }]}>
              Esta versión de la app no tiene voz: sigue las indicaciones en pantalla y la vibración.
            </Text>
          ) : null}
        </>
      )}
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 14 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  gap: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  processing: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  bar: { width: '100%', height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  dark: { flex: 1, backgroundColor: '#1C0F0D' },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundDark: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.16)', alignItems: 'center', justifyContent: 'center' },
  roundSpacer: { width: 44 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  instruction: { position: 'absolute', left: 20, right: 20, alignItems: 'center', gap: 6, backgroundColor: 'rgba(28, 15, 13, 0.55)', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16 },
  bigText: { fontFamily: coralFonts.title, fontSize: 26, lineHeight: 30, color: '#FFFFFF', textAlign: 'center' },
  hugeText: { fontSize: 36, lineHeight: 40 },
  hint: { fontFamily: coralFonts.extrabold, fontSize: 22, lineHeight: 27, textAlign: 'center' },
  countWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: coralFonts.title, fontSize: 140, lineHeight: 150, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 12 },
  frame: { position: 'absolute', left: '18%', right: '18%', borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 28, borderStyle: 'dashed' },
  oval: { position: 'absolute', alignSelf: 'center', width: 230, height: 300, borderRadius: 150, borderWidth: 3, borderColor: 'rgba(255,255,255,0.75)' },
});
