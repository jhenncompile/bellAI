import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { Flashlight, FlashlightOff, Image as ImageIcon, Shirt, Square, Sun, X } from 'lucide-react-native';
import { Banner } from '@/shared/ui';
import { CoralButton, CoralLink, Mascot, coralFonts, coralText, useCoral } from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';
import {
  analyzeGarmentImage,
  GarmentAnalysisResult,
} from '@/features/digital-wardrobe/services/garmentImageAnalyzer';
import { usePhotoAnalysisConsentGate } from '@/features/privacy/model/usePhotoAnalysisConsentGate';
import { CU08PhotoConsentView } from './CU08PhotoConsentView';
import { NoticeOutlet } from '@/shared/ui/Notice';

interface CU18GarmentCameraViewProps {
  onBack?: () => void;
  onCaptureGarment?: (analysis: GarmentAnalysisResult, source: 'camera' | 'gallery') => void;
}

type Problem = { title: string; description: string; settings?: boolean } | null;

const REMINDERS: { Icon: LucideIcon; text: string }[] = [
  { Icon: Shirt, text: 'Prenda extendida' },
  { Icon: Square, text: 'Fondo liso' },
  { Icon: Sun, text: 'Buena luz' },
];

/** CU-18 · Registrar una prenda con fotografía (cámara oscura, como la cámara guiada). */
export const CU18GarmentCameraView: React.FC<CU18GarmentCameraViewProps> = ({ onBack, onCaptureGarment }) => {
  const c = useCoral();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const consentGate = usePhotoAnalysisConsentGate();
  const cameraRef = useRef<CameraView>(null);
  const busy = capturing || analyzing;

  // Del Líder («fix models»): pedir el permiso de cámara al abrir, sin esperar a que se toque el botón.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const analyzePhoto = async (photoUri: string, source: 'camera' | 'gallery') => {
    try {
      await consentGate.runWithConsent(async () => {
        setAnalyzing(true);
        try {
          const analysis = await analyzeGarmentImage(photoUri);
          onCaptureGarment?.(analysis, source);
        } finally {
          setAnalyzing(false);
        }
      });
    } catch {
      setProblem({
        title: 'No pudimos verificar tu autorización',
        description: 'Revisa tu conexión e inténtalo de nuevo. La foto no se analizó.',
      });
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || busy) return;
    setProblem(null);
    setCapturing(true);
    hapticFeedback.heavy();
    let uri: string | undefined;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      uri = photo?.uri;
    } catch (err) {
      console.error('[CU18GarmentCamera] Error al capturar:', err);
    } finally {
      setCapturing(false);
    }
    if (uri) {
      await analyzePhoto(uri, 'camera');
    } else {
      hapticFeedback.warning();
      setProblem({ title: 'No pudimos tomar la foto', description: 'Vuelve a intentarlo o elige una foto de tu galería.' });
    }
  };

  const handlePickFromGallery = async () => {
    if (busy) return;
    setProblem(null);
    try {
      const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (media.status !== 'granted') {
        setProblem({
          title: 'Necesitamos acceso a tus fotos',
          description: 'Actívalo en los ajustes del teléfono para elegir una foto de tu prenda.',
          settings: true,
        });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      const uri = !res.canceled ? res.assets?.[0]?.uri : undefined;
      if (uri) {
        hapticFeedback.medium();
        await analyzePhoto(uri, 'gallery');
      }
    } catch (err) {
      console.error('[CU18GarmentCamera] Error al abrir la galería:', err);
      setProblem({ title: 'No pudimos abrir tu galería', description: 'Vuelve a intentarlo o toma la foto con la cámara.' });
    }
  };

  const top = insets.top + 12;
  const boxW = Math.min(width * 0.74, 300);
  const boxH = Math.min(height * 0.48, 400);
  const boxY = top + 72;

  const problemBanner = problem ? (
    <Banner
      kind="error"
      title={problem.title}
      description={problem.description}
      actionLabel={problem.settings ? 'Abrir ajustes' : undefined}
      onAction={problem.settings ? () => { void Linking.openSettings(); } : undefined}
    />
  ) : null;

  let body: React.ReactNode;
  if (!permission) {
    // Comprobando el permiso de la cámara
    body = (
      <View style={[styles.centerBox, { paddingTop: top, paddingBottom: insets.bottom + 16 }]}>
        <ActivityIndicator size="large" color="#FFFFFF" accessibilityLabel="Abriendo la cámara" />
        <Text style={[coralText.body, styles.center, { color: '#F3DDD5' }]}>Abriendo la cámara</Text>
      </View>
    );
  } else if (!permission.granted) {
    // Permiso denegado o pendiente
    const blocked = !permission.canAskAgain;
    body = (
      <View style={[styles.centerBox, { paddingTop: top, paddingBottom: insets.bottom + 16 }]}>
        <Mascot pose="fotografo" height={190} enter="pop" />
        <Text accessibilityRole="header" style={[styles.darkTitle, styles.center]}>Necesitamos tu cámara</Text>
        <Text style={[coralText.body, styles.center, { color: '#F3DDD5' }]}>
          {blocked
            ? 'Activa la cámara en los ajustes del teléfono, o elige una foto de tu galería.'
            : 'La usamos para fotografiar tu prenda y reconocer su tipo y su color.'}
        </Text>
        {problemBanner}
        <CoralButton
          title={blocked ? 'Abrir ajustes' : 'Permitir acceso a la cámara'}
          variant="light"
          onPress={() => { void (blocked ? Linking.openSettings() : requestPermission()); }}
          fullWidth
        />
        <CoralLink title="Elegir de la galería" underline color="#FFFFFF" onPress={() => { void handlePickFromGallery(); }} />
        {onBack ? <CoralLink title="Ahora no" underline color="#F3DDD5" onPress={onBack} /> : null}
      </View>
    );
  } else {
    body = (
      <>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
        <Svg height={height} width={width} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <Mask id="marco">
              <Rect x="0" y="0" width={width} height={height} fill="white" />
              <Rect x={(width - boxW) / 2} y={boxY} width={boxW} height={boxH} rx={28} ry={28} fill="black" />
            </Mask>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill="rgba(28, 15, 13, 0.55)" mask="url(#marco)" />
          <Rect x={(width - boxW) / 2} y={boxY} width={boxW} height={boxH} rx={28} ry={28} stroke="#FF9B7B" strokeWidth={3} fill="none" />
        </Svg>

        <View style={[styles.topBar, { top }]}>
          {onBack ? <RoundDark Icon={X} label="Cerrar la cámara" onPress={() => { hapticFeedback.light(); onBack(); }} /> : <View style={styles.side} />}
          <Text accessibilityRole="header" style={styles.topTitle}>Nueva prenda</Text>
          <RoundDark
            Icon={torch ? FlashlightOff : Flashlight}
            label={torch ? 'Apagar linterna' : 'Encender linterna'}
            onPress={() => { hapticFeedback.light(); setTorch((t) => !t); }}
          />
        </View>

        <View style={[styles.guide, { top: boxY + boxH + 16 }]} pointerEvents="box-none">
          <View style={styles.reminders} pointerEvents="none">
            {REMINDERS.map(({ Icon, text }) => (
              <View key={text} style={styles.reminder}>
                <Icon size={15} color="#FFD5A1" strokeWidth={2.3} />
                <Text style={[coralText.caption, { color: '#FFFFFF', fontFamily: coralFonts.bold }]}>{text}</Text>
              </View>
            ))}
          </View>
          {problemBanner}
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.side}>
            <RoundDark Icon={ImageIcon} label="Elegir una foto de la galería" onPress={() => { void handlePickFromGallery(); }} disabled={busy} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tomar la foto de la prenda"
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={() => { void handleTakePhoto(); }}
            style={({ pressed }) => [styles.shutterRing, pressed && { transform: [{ scale: 0.95 }] }]}
          >
            {capturing ? <ActivityIndicator color="#FFFFFF" /> : <View style={styles.shutter} />}
          </Pressable>
          <View style={styles.side} />
        </View>
      </>
    );
  }

  return (
    <View style={styles.dark}>
      {body}

      {analyzing ? (
        // Analizando la foto
        <View style={[StyleSheet.absoluteFill, styles.analyzing, { backgroundColor: c.background[0], paddingTop: top, paddingBottom: insets.bottom + 16 }]}>
          <Mascot pose="pensando" height={190} enter="pop" float />
          <Text accessibilityRole="header" style={[styles.lightTitle, { color: c.ink }]}>Reconociendo tu prenda</Text>
          <Text accessibilityLiveRegion="polite" style={[coralText.body, styles.center, { color: c.ink2 }]}>
            Buscamos su tipo y su color. Tarda unos segundos.
          </Text>
          <ActivityIndicator color={c.ink} accessibilityLabel="Analizando" />
        </View>
      ) : null}

      <Modal
        visible={consentGate.visible}
        animationType="slide"
        onRequestClose={() => { void consentGate.denyConsent(); }}
      >
        <CU08PhotoConsentView
          onBack={() => { void consentGate.denyConsent(); }}
          onGrantConsent={() => { void consentGate.grantConsent(); }}
          onDenyConsent={() => { void consentGate.denyConsent(); }}
          submitting={consentGate.submitting}
          errorMessage={consentGate.error}
        />
        <NoticeOutlet />
      </Modal>
    </View>
  );
};

function RoundDark({ Icon, label, onPress, disabled }: { Icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.roundDark, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  dark: { flex: 1, backgroundColor: '#1C0F0D' },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: coralFonts.extrabold, fontSize: 17, color: '#FFFFFF' },
  roundDark: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.16)', alignItems: 'center', justifyContent: 'center' },
  guide: { position: 'absolute', left: 16, right: 16, gap: 12 },
  reminders: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40 },
  side: { width: 64, alignItems: 'center' },
  shutterRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  darkTitle: { fontFamily: coralFonts.title, fontSize: 28, lineHeight: 32, color: '#FFFFFF' },
  analyzing: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  lightTitle: { fontFamily: coralFonts.title, fontSize: 28, lineHeight: 32, textAlign: 'center' },
});
