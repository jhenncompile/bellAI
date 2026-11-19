import React, { useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { Camera, ScanFace } from 'lucide-react-native';
import { DiagnosticResult, FaceContoursData } from '@/entities/diagnostic/model/types';
import { MediaVaultService } from '@/entities/media-vault/model/mediaVaultService';
import { hapticFeedback } from '@/shared/lib/haptics';
import { Chip } from '@/shared/ui';
import { CoralButton, CoralCard, coralFonts, coralText, useCoral } from '@/shared/ui/coral';

const { width } = Dimensions.get('window');
const CANVAS_WIDTH = Math.min(width - 68, 320);
const CANVAS_HEIGHT = CANVAS_WIDTH * 1.25;

/** Colores del dibujo sobre la foto (sistema P1): coral para contornos, blanco para guías. */
const LINE = '#FF7A66';
const GUIDE = '#FFFFFF';
const LABEL_BG = 'rgba(42, 23, 20, 0.72)';

interface FaceGeometryVisualizerProps {
  diagnostic?: DiagnosticResult;
  faceShape?: string;
  imageUri?: string;
  onTakeFacePhoto?: () => void;
}

/** Proyecta coordenadas normalizadas (0 a 1) sobre el lienzo con la foto en modo «cover». */
function mapToCanvas(nx: number, ny: number, imgW: number, imgH: number): [number, number] {
  const rImg = imgW / Math.max(1, imgH);
  const rBox = CANVAS_WIDTH / Math.max(1, CANVAS_HEIGHT);
  if (rImg > rBox) {
    const renderedW = CANVAS_HEIGHT * rImg;
    const dx = (CANVAS_WIDTH - renderedW) / 2;
    return [Math.round((nx * renderedW + dx) * 10) / 10, Math.round(ny * CANVAS_HEIGHT * 10) / 10];
  }
  const renderedH = CANVAS_WIDTH / rImg;
  const dy = (CANVAS_HEIGHT - renderedH) / 2;
  return [Math.round(nx * CANVAS_WIDTH * 10) / 10, Math.round((ny * renderedH + dy) * 10) / 10];
}

/** Etiqueta legible sobre la foto: texto blanco de 11 px sobre una banda de tinta. */
function Tag({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 6.2 + 10;
  return (
    <>
      <Polygon points={`${x},${y - 12} ${x + w},${y - 12} ${x + w},${y + 4} ${x},${y + 4}`} fill={LABEL_BG} />
      <SvgText x={x + 5} y={y} fill="#FFFFFF" fontSize="11" fontWeight="700">{text}</SvgText>
    </>
  );
}

type Layer = 'landmarks' | 'shape' | 'thirds';
const LAYERS: { key: Layer; label: string }[] = [
  { key: 'landmarks', label: 'Rasgos' },
  { key: 'shape', label: 'Estructura' },
  { key: 'thirds', label: 'Tercios' },
];

/**
 * Dibujo de los puntos del rostro (sistema P1). Solo muestra medidas que vienen del análisis;
 * las recomendaciones están en Mi análisis → Rostro.
 */
export const FaceGeometryVisualizer: React.FC<FaceGeometryVisualizerProps> = ({ diagnostic, faceShape, imageUri, onTakeFacePhoto }) => {
  const c = useCoral();
  const [layer, setLayer] = useState<Layer>('landmarks');
  const [vaultUri, setVaultUri] = useState<string | undefined>(undefined);
  const photo = imageUri || vaultUri;

  useEffect(() => {
    if (imageUri) return;
    MediaVaultService.getItemsByFolder('rostro')
      .then((items) => { if (items[0]?.localUri) setVaultUri(items[0].localUri); })
      .catch(() => undefined);
  }, [imageUri]);

  const shape = diagnostic?.faceShape || faceShape;
  const lm = diagnostic?.realLandmarks;
  const imgW = lm?.imageDimensions?.width || 360;
  const imgH = lm?.imageDimensions?.height || 480;
  const pt = (p?: [number, number]) => (p ? mapToCanvas(p[0], p[1], imgW, imgH) : null);
  const path = (pts?: [number, number][]) => (pts?.length ? pts.map(([x, y]) => mapToCanvas(x, y, imgW, imgH).join(',')).join(' ') : '');

  const contours: FaceContoursData = lm?.contours || {};
  const oval = path(contours.faceOval);
  const lines = [contours.leftEyebrow, contours.rightEyebrow, contours.noseBridge, contours.noseBottom, contours.upperLip, contours.lowerLip].map(path);
  const eyes = [contours.leftEye, contours.rightEye].map(path);
  const trichion = pt(lm?.trichion);
  const glabella = pt(lm?.glabella);
  const subnasale = pt(lm?.subnasale);
  const menton = pt(lm?.menton);
  const cheekL = pt(lm?.cheekLeft);
  const cheekR = pt(lm?.cheekRight);

  // Medidas reales del análisis (si no vienen, no se muestran).
  const thirds = diagnostic?.biometricMetrics?.thirds;
  const ratio = diagnostic?.biometricMetrics?.lengthToWidthRatio;
  const symmetry = diagnostic?.facialSymmetry;
  const facts = [
    ratio ? `Largo y ancho: ${ratio.toFixed(2)}` : null,
    symmetry !== undefined ? `Simetría: ${symmetry} %` : null,
    layer === 'thirds' && thirds ? `Tercios: ${thirds.superior} % · ${thirds.medio} % · ${thirds.inferior} %` : null,
  ].filter(Boolean) as string[];

  const choose = (l: Layer) => { hapticFeedback.light(); setLayer(l); };

  return (
    <CoralCard radius={24} style={styles.card}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[coralText.strong, { color: c.ink }]}>Tus rasgos en la foto</Text>
        {shape ? <Text style={[coralText.caption, { color: c.ink2, fontFamily: coralFonts.bold }]}>Rostro {shape.toLowerCase()}</Text> : null}
      </View>

      <View style={styles.layers} accessibilityRole="tablist">
        {LAYERS.map((l) => <Chip key={l.key} label={l.label} active={layer === l.key} onPress={() => choose(l.key)} />)}
      </View>

      <View style={[styles.canvas, { backgroundColor: c.muted }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" accessibilityLabel="Tu foto del análisis con los rasgos marcados" />
        ) : (
          <View style={styles.empty}>
            <ScanFace color={c.ink2} size={44} />
            <Text style={[coralText.strong, styles.center, { color: c.ink }]}>Sin foto del análisis</Text>
            <Text style={[coralText.small, styles.center, { color: c.ink2 }]}>Toma una foto de frente y con buena luz para ver tus rasgos.</Text>
            {onTakeFacePhoto ? <CoralButton title="Tomar foto" height={44} onPress={onTakeFacePhoto} leftIcon={<Camera size={18} color={c.onPrimary} />} /> : null}
          </View>
        )}

        {photo ? (
          <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
            {layer === 'landmarks' ? (
              <>
                {oval ? <Polygon points={oval} stroke={LINE} strokeWidth="2.2" fill="rgba(255, 122, 102, 0.08)" /> : null}
                {lines.map((p, i) => (p ? <Polyline key={i} points={p} stroke={LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null))}
                {eyes.map((p, i) => (p ? <Polygon key={i} points={p} stroke={GUIDE} strokeWidth="1.8" fill="rgba(255, 255, 255, 0.15)" /> : null))}
                {glabella ? <><Circle cx={glabella[0]} cy={glabella[1]} r="3.5" fill={GUIDE} /><Tag x={glabella[0] + 6} y={glabella[1] - 4} text="Entrecejo" /></> : null}
                {menton ? <><Circle cx={menton[0]} cy={menton[1]} r="3.5" fill={GUIDE} /><Tag x={menton[0] + 6} y={menton[1] - 4} text="Mentón" /></> : null}
              </>
            ) : null}

            {layer === 'shape' ? (
              <>
                {oval ? <Polygon points={oval} stroke={LINE} strokeWidth="2.8" fill="rgba(255, 122, 102, 0.12)" /> : null}
                {cheekL && cheekR ? (
                  <>
                    <Line x1={cheekL[0]} y1={cheekL[1]} x2={cheekR[0]} y2={cheekR[1]} stroke={GUIDE} strokeWidth="2" strokeDasharray="4, 4" />
                    <Circle cx={cheekL[0]} cy={cheekL[1]} r="4.5" fill={GUIDE} />
                    <Circle cx={cheekR[0]} cy={cheekR[1]} r="4.5" fill={GUIDE} />
                    <Tag x={(cheekL[0] + cheekR[0]) / 2 - 40} y={cheekL[1] - 8} text="Ancho de pómulos" />
                  </>
                ) : null}
                {glabella && menton ? (
                  <Line x1={glabella[0]} y1={trichion ? trichion[1] : glabella[1] - 30} x2={menton[0]} y2={menton[1]} stroke={GUIDE} strokeWidth="1.5" strokeDasharray="3, 3" />
                ) : null}
              </>
            ) : null}

            {layer === 'thirds' ? (
              <>
                {[
                  [trichion, 'Nacimiento del cabello'],
                  [glabella, 'Cejas'],
                  [subnasale, 'Base de la nariz'],
                  [menton, 'Mentón'],
                ].map(([p, label]) => {
                  const point = p as [number, number] | null;
                  if (!point) return null;
                  return (
                    <React.Fragment key={label as string}>
                      <Line x1={CANVAS_WIDTH * 0.06} y1={point[1]} x2={CANVAS_WIDTH * 0.94} y2={point[1]} stroke={LINE} strokeWidth="1.8" strokeDasharray="4, 4" />
                      <Tag x={CANVAS_WIDTH * 0.06} y={point[1] - 4} text={label as string} />
                    </React.Fragment>
                  );
                })}
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>

      {facts.length ? (
        <View style={styles.facts}>
          {facts.map((f) => <Text key={f} style={[coralText.label, { color: c.ink }]}>{f}</Text>)}
        </View>
      ) : null}
      <Text style={[coralText.caption, { color: c.ink2 }]}>
        Para que las medidas sean precisas, usa una foto de frente con la frente despejada.
      </Text>
    </CoralCard>
  );
};

const styles = StyleSheet.create({
  card: { gap: 12 },
  center: { textAlign: 'center' },
  head: { gap: 2 },
  layers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, alignSelf: 'center', borderRadius: 20, overflow: 'hidden' },
  photo: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  facts: { gap: 4 },
});
