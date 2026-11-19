import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LucideIcon } from 'lucide-react-native';
import { Camera, CircleCheck, Flashlight, FlashlightOff, Glasses, Image as ImageIcon, ScanFace, Shirt, Sun, SwitchCamera, UserRound, X } from 'lucide-react-native';
import { hapticFeedback } from '@/shared/lib/haptics';
import { CoralButton, CoralLink, CoralTitle, Mascot, coralFonts, coralText, useCoral } from '@/shared/ui/coral';
import { NoticeOutlet } from '@/shared/ui/Notice';

const { width, height } = Dimensions.get('window');

/** Clave para mostrar «Antes de la foto» solo la primera vez (Penpot A2). */
const TIPS_SEEN_KEY = 'bellai.photoTips.seen';

export interface GuidedCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string, mode?: 'face' | 'body') => void;
  initialMode?: 'face' | 'body';
  /** Fuerza los consejos al abrir (por ejemplo, después de un análisis fallido). */
  showTips?: boolean;
}

const TIPS: Record<'face' | 'body', { Icon: LucideIcon; text: string }[]> = {
  face: [
    { Icon: Sun, text: 'Busca luz natural, de frente' },
    { Icon: Glasses, text: 'Quítate lentes y gorra' },
    { Icon: UserRound, text: 'Cara despejada y sin filtros' },
    { Icon: ScanFace, text: 'Mira a la cámara, sin sonreír' },
  ],
  body: [
    { Icon: Sun, text: 'Busca un lugar bien iluminado' },
    { Icon: UserRound, text: 'De pie, de frente, todo el cuerpo' },
    { Icon: Shirt, text: 'Ropa ajustada o de una sola pieza' },
    { Icon: Camera, text: 'Apoya el teléfono a 2 o 3 metros' },
  ],
};

const REVIEW_CHECKS: Record<'face' | 'body', string[]> = {
  face: ['Tu cara se ve completa y centrada', 'Hay buena luz, sin sombras fuertes', 'La foto no está movida'],
  body: ['Se ve tu cuerpo completo, de pies a cabeza', 'Estás de frente y derecha', 'La foto no está movida'],
};

/**
 * Captura guiada (Penpot «Flujo 02 · Análisis (P1)»): A2 antes de la foto, A3 cámara y A4 revisar.
 * Las comprobaciones de la cámara son recordatorios: la validación real la hace el servidor (HU-035).
 */
export const GuidedCameraModal: React.FC<GuidedCameraModalProps> = ({ visible, onClose, onCapture, initialMode = 'face', showTips = false }) => {
  const c = useCoral();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [mode, setMode] = useState<'face' | 'body'>(initialMode);
  const [torch, setTorch] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [tips, setTips] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [flash] = useState(() => new Animated.Value(0));

  // Al abrir: reinicia el estado durante el render (sin efecto) y luego decide si mostrar los consejos.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPhoto(null);
      setTorch(false);
      setMode(initialMode);
      setTips(showTips);
    }
  }
  useEffect(() => {
    if (!visible || showTips) return;
    let alive = true;
    AsyncStorage.getItem(TIPS_SEEN_KEY).then((seen) => { if (alive && !seen) setTips(true); }).catch(() => undefined);
    return () => { alive = false; };
  }, [visible, showTips]);

  // Del Líder («fix models»): pedir el permiso de cámara al abrir el visor.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch((err) => console.warn('[GuidedCamera] No se pudo pedir el permiso:', err));
    }
  }, [visible, permission, requestPermission]);

  // Si el sistema ya no deja volver a preguntar, el permiso se da desde los ajustes del teléfono.
  const askPermission = () => {
    hapticFeedback.light();
    if (permission && !permission.canAskAgain) void Linking.openSettings();
    else void requestPermission();
  };

  // Del Líder: elegir una foto de la galería; pasa por «Revisa tu foto» igual que una de la cámara.
  const pickFromGallery = async () => {
    hapticFeedback.light();
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
      if (!res.canceled && res.assets?.[0]?.uri) setPhoto(res.assets[0].uri);
    } catch (e) {
      console.warn('[GuidedCamera] No se pudo abrir la galería:', e);
    }
  };

  const closeTips = (remember: boolean) => {
    hapticFeedback.light();
    setTips(false);
    if (remember) AsyncStorage.setItem(TIPS_SEEN_KEY, '1').catch(() => undefined);
  };

  const snap = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    hapticFeedback.heavy();
    flash.setValue(0.85);
    Animated.timing(flash, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (shot?.uri) setPhoto(shot.uri);
    } catch (error) {
      console.error('[GuidedCamera] Error al capturar:', error);
    } finally {
      setCapturing(false);
    }
  };

  const confirm = () => {
    if (!photo) return;
    hapticFeedback.success();
    onCapture(photo, mode);
    setPhoto(null);
    onClose();
  };

  if (!visible) return null;

  const top = insets.top + 12;
  const ovalW = Math.min(width * 0.6, 240);
  const ovalH = ovalW * 1.32;
  const ovalCy = height * 0.4;
  const boxW = Math.min(width * 0.62, 250);
  const boxH = Math.min(height * 0.56, 440);
  const boxY = height * 0.15;
  const guideBottom = mode === 'face' ? ovalCy + ovalH / 2 : boxY + boxH;

  // ---------------------------------------------------------------- A4 · Revisar la foto
  if (photo) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => setPhoto(null)}>
        <View style={[styles.light, { backgroundColor: c.background[0], paddingTop: top, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.reviewHead}>
            <CoralTitle prefix="Revisa tu " accent="foto" size={30} />
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={[styles.roundLight, { backgroundColor: '#FFFFFF' }]}>
              <X size={22} color={c.ink} />
            </Pressable>
          </View>
          <Image source={{ uri: photo }} style={styles.reviewPhoto} resizeMode="cover" accessibilityLabel="Foto que acabas de tomar" />
          <View style={[styles.checks, { backgroundColor: '#FFFFFF' }]}>
            <Text style={[coralText.strong, { color: c.ink }]}>Antes de seguir, revisa que:</Text>
            {REVIEW_CHECKS[mode].map((t) => (
              <View key={t} style={styles.checkRow}>
                <CircleCheck size={20} color="#2F6B3F" strokeWidth={2.3} />
                <Text style={[coralText.label, styles.flex, { color: c.ink }]}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={styles.reviewActions}>
            <CoralButton title="Usar esta foto" onPress={confirm} fullWidth />
            <CoralButton title="Tomar otra" variant="secondary" height={44} onPress={() => { hapticFeedback.medium(); setPhoto(null); }} leftIcon={<Camera size={18} color={c.ink} />} fullWidth />
          </View>
        </View>
        <NoticeOutlet />
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.dark}>
        {permission?.granted ? (
          <>
            {/* ------------------------------------------------ A3 · Cámara guiada */}
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} enableTorch={torch && facing === 'back'} />
            <Svg height={height} width={width} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <Mask id="guia">
                  <Rect x="0" y="0" width={width} height={height} fill="white" />
                  {mode === 'face'
                    ? <Ellipse cx={width / 2} cy={ovalCy} rx={ovalW / 2} ry={ovalH / 2} fill="black" />
                    : <Rect x={(width - boxW) / 2} y={boxY} width={boxW} height={boxH} rx={28} ry={28} fill="black" />}
                </Mask>
              </Defs>
              <Rect x="0" y="0" width={width} height={height} fill="rgba(28, 15, 13, 0.55)" mask="url(#guia)" />
              {mode === 'face'
                ? <Ellipse cx={width / 2} cy={ovalCy} rx={ovalW / 2} ry={ovalH / 2} stroke="#FF9B7B" strokeWidth={3} fill="none" />
                : <Rect x={(width - boxW) / 2} y={boxY} width={boxW} height={boxH} rx={28} ry={28} stroke="#FF9B7B" strokeWidth={3} fill="none" />}
            </Svg>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: flash }]} />

            <View style={[styles.topBar, { top }]}>
              <RoundDark Icon={X} label="Cerrar la cámara" onPress={onClose} />
              <View style={styles.segment} accessibilityRole="tablist">
                {(['face', 'body'] as const).map((m) => (
                  <Pressable
                    key={m}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === m }}
                    onPress={() => { hapticFeedback.light(); setMode(m); }}
                    style={[styles.segItem, mode === m && { backgroundColor: '#FFFFFF' }]}
                  >
                    <Text style={[coralText.label, { fontSize: 13, color: mode === m ? c.ink : '#FFFFFF', fontFamily: coralFonts.extrabold }]}>{m === 'face' ? 'Rostro' : 'Cuerpo'}</Text>
                  </Pressable>
                ))}
              </View>
              <RoundDark Icon={torch ? FlashlightOff : Flashlight} label={torch ? 'Apagar linterna' : 'Encender linterna'} onPress={() => { hapticFeedback.light(); setTorch((t) => !t); }} />
            </View>

            <View style={[styles.guideText, { top: guideBottom + 18 }]} pointerEvents="none">
              <Text style={[coralText.strong, styles.center, { color: '#FFFFFF', fontSize: 17 }]}>
                {mode === 'face' ? 'Centra tu cara en el óvalo' : 'Que entre todo tu cuerpo en el marco'}
              </Text>
              <View style={styles.reminders}>
                {TIPS[mode].slice(0, 3).map(({ Icon, text }) => (
                  <View key={text} style={styles.reminder}>
                    <Icon size={15} color="#FFD5A1" strokeWidth={2.3} />
                    <Text style={[coralText.caption, { color: '#FFFFFF', fontFamily: coralFonts.bold }]}>{text.split(',')[0]}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.shutterRow}>
                <View style={styles.side}>
                  <RoundDark Icon={ImageIcon} label="Elegir una foto de la galería" onPress={() => { void pickFromGallery(); }} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tomar la foto"
                  accessibilityState={{ busy: capturing }}
                  onPress={() => { void snap(); }}
                  style={({ pressed }) => [styles.shutterRing, pressed && { transform: [{ scale: 0.95 }] }]}
                >
                  <View style={styles.shutter} />
                </Pressable>
                <View style={styles.side}>
                  <RoundDark Icon={SwitchCamera} label="Girar la cámara" onPress={() => { hapticFeedback.light(); setFacing((f) => (f === 'front' ? 'back' : 'front')); }} />
                </View>
              </View>
              <CoralLink title="¿Cómo tomar la foto?" underline color="#FFFFFF" onPress={() => setTips(true)} />
            </View>
          </>
        ) : !permission ? (
          /* ------------------------------------------------ Comprobando el permiso */
          <View style={[styles.centerBox, { paddingTop: top }]} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color="#FFFFFF" accessibilityLabel="Comprobando el acceso a la cámara" />
            <Text style={[coralText.body, styles.center, { color: '#F3DDD5' }]}>Comprobando el acceso a la cámara…</Text>
          </View>
        ) : (
          /* ------------------------------------------------ Permiso de la cámara */
          <View style={[styles.centerBox, { paddingTop: top, paddingBottom: insets.bottom + 16 }]}>
            <Mascot pose="fotografo" height={200} enter="pop" />
            <Text accessibilityRole="header" style={[styles.darkTitle, styles.center]}>Necesitamos tu cámara</Text>
            <Text style={[coralText.body, styles.center, { color: '#F3DDD5' }]}>
              {permission.canAskAgain
                ? 'La usamos solo para la foto de tu análisis. No grabamos ni guardamos nada sin tu permiso.'
                : 'El acceso a la cámara está desactivado. Actívalo en los ajustes del teléfono o elige una foto de tu galería.'}
            </Text>
            <CoralButton title={permission.canAskAgain ? 'Permitir acceso a la cámara' : 'Abrir ajustes'} variant="light" onPress={askPermission} fullWidth />
            <CoralLink title="Elegir de la galería" underline color="#FFFFFF" onPress={() => { void pickFromGallery(); }} />
            <CoralLink title="Ahora no" underline color="#F3DDD5" onPress={onClose} />
          </View>
        )}

        {/* ------------------------------------------------ A2 · Antes de la foto */}
        {tips ? (
          <View style={[StyleSheet.absoluteFill, styles.tips, { paddingTop: top, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.tipsHead}>
              <RoundDark Icon={X} label="Cerrar consejos" onPress={() => closeTips(false)} />
            </View>
            <Mascot pose="fotografo" height={190} enter="pop" float />
            <Text accessibilityRole="header" style={[styles.darkTitle, styles.center]}>Antes de la foto</Text>
            <View style={styles.tipList}>
              {TIPS[mode].map(({ Icon, text }) => (
                <View key={text} style={styles.tipRow}>
                  <Icon size={22} color="#FF9B7B" strokeWidth={2.2} />
                  <Text style={[coralText.label, styles.flex, { color: '#FFFFFF' }]}>{text}</Text>
                </View>
              ))}
            </View>
            <View style={styles.tipsActions}>
              <CoralButton title="Entendido, abrir cámara" variant="light" onPress={() => closeTips(false)} leftIcon={<Camera size={18} color={c.ink} />} fullWidth />
              <CoralLink title="No volver a mostrar" underline color="#F3DDD5" onPress={() => closeTips(true)} />
            </View>
          </View>
        ) : null}
      </View>
      <NoticeOutlet />
    </Modal>
  );
};

function RoundDark({ Icon, label, onPress }: { Icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.roundDark, pressed && { opacity: 0.7 }]}>
      <Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  dark: { flex: 1, backgroundColor: '#1C0F0D' },
  light: { flex: 1, paddingHorizontal: 16, gap: 16 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundDark: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.16)', alignItems: 'center', justifyContent: 'center' },
  roundLight: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 12px rgba(179, 57, 46, 0.14)' },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  segItem: { minWidth: 84, minHeight: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  guideText: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 12 },
  reminders: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 6 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 40 },
  side: { width: 64, alignItems: 'center' },
  shutterRing: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  darkTitle: { fontFamily: coralFonts.title, fontSize: 28, lineHeight: 32, color: '#FFFFFF' },
  tips: { backgroundColor: '#2A1714', alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  tipsHead: { alignSelf: 'stretch', alignItems: 'flex-end' },
  tipList: { alignSelf: 'stretch', gap: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.10)' },
  tipsActions: { alignSelf: 'stretch', marginTop: 'auto', gap: 4, alignItems: 'center' },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  reviewPhoto: { flex: 1, minHeight: 220, maxHeight: 360, width: '72%', alignSelf: 'center', borderRadius: 28, backgroundColor: '#E9C4A5' },
  checks: { borderRadius: 24, padding: 18, gap: 12, boxShadow: '0px 10px 28px rgba(179, 57, 46, 0.14)' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewActions: { gap: 10, paddingHorizontal: 8 },
});
