import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, Sparkles } from 'lucide-react-native';
import { AuraScoreData } from '@/entities/aura-score/model/types';
import { DiagnosticResult } from '@/entities/diagnostic/model/types';
import { seasonTitleParts, toneSummary } from '@/entities/diagnostic/model/labels';
import { Mascot, coralFonts } from '@/shared/ui/coral';
import { coralHeroDirection, coralLight } from '@/shared/theme/tokens/coral';

export interface ViralCardProps {
  scoreData: AuraScoreData;
  diagnostic: DiagnosticResult;
  userPhotoUri?: string;
  includePhoto?: boolean;
  forwardedRef?: any;
}

const INK = '#2A1714';

/**
 * Tarjeta para compartir (sistema P1). Se captura como imagen, así que usa colores fijos del
 * tema claro P1 y no depende del tema activo. Solo muestra datos reales del análisis.
 */
export const ViralCard: React.FC<ViralCardProps> = ({ scoreData, diagnostic, userPhotoUri, includePhoto = false, forwardedRef }) => {
  const showUserPhoto = Boolean(includePhoto && userPhotoUri);
  const season = seasonTitleParts(diagnostic.season);
  const palette = diagnostic.palette.slice(0, 5);

  return (
    <View ref={forwardedRef} collapsable={false} style={styles.card}>
      <LinearGradient colors={coralLight.hero} start={coralHeroDirection.start} end={coralHeroDirection.end} style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><Sparkles size={16} color={coralLight.accent} strokeWidth={2.2} /></View>
            <Text style={styles.brandName}>BellAI</Text>
          </View>
          <View style={styles.privacy}>
            <ShieldCheck size={13} color={INK} strokeWidth={2.4} />
            <Text style={styles.privacyText}>{showUserPhoto ? 'Foto autorizada' : 'Sin foto'}</Text>
          </View>
        </View>

        <View style={styles.middle}>
          {showUserPhoto ? (
            <Image source={{ uri: userPhotoUri }} style={styles.photo} />
          ) : (
            <Mascot pose="paleta" height={118} />
          )}
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>MI ESTACIÓN</Text>
            <Text style={styles.season}>
              {season.lead}
              <Text style={styles.seasonAccent}>{season.accent}</Text>
            </Text>
            <Text style={styles.tone}>{toneSummary(diagnostic.undertone, diagnostic.contrastLevel)}</Text>
          </View>
        </View>

        {palette.length ? (
          <View style={styles.paletteBox}>
            <Text style={styles.eyebrow}>MI PALETA</Text>
            <View style={styles.swatches}>
              {palette.map((s) => (
                <View key={s.hex + s.name} style={styles.swatchCell}>
                  <View style={[styles.swatch, { backgroundColor: s.hex }]} />
                  <Text style={styles.swatchName} numberOfLines={1}>{s.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Guía de estilo · {scoreData.totalScore}/100{scoreData.tierLabel ? ` · ${scoreData.tierLabel}` : ''}</Text>
          <Text style={styles.footerText}>Asesoría de imagen con BellAI</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginHorizontal: 8, borderRadius: 30, overflow: 'hidden', boxShadow: '0px 10px 28px rgba(179, 57, 46, 0.18)' },
  inner: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: coralFonts.title, fontSize: 20, color: INK },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255, 255, 255, 0.85)', paddingHorizontal: 10, minHeight: 26, borderRadius: 13 },
  privacyText: { fontFamily: coralFonts.bold, fontSize: 12, color: INK },
  middle: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photo: { width: 96, height: 118, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF' },
  eyebrow: { fontFamily: coralFonts.extrabold, fontSize: 11.5, letterSpacing: 0.8, color: INK },
  season: { fontFamily: coralFonts.title, fontSize: 28, lineHeight: 32, color: INK },
  seasonAccent: { fontFamily: coralFonts.titleAccent },
  tone: { fontFamily: coralFonts.bold, fontSize: 13.5, color: INK, marginTop: 2 },
  paletteBox: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 20, padding: 14, gap: 10 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  swatchCell: { flex: 1, alignItems: 'center', gap: 4 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF' },
  swatchName: { fontFamily: coralFonts.bold, fontSize: 11, color: INK },
  footer: { alignItems: 'center', gap: 2 },
  footerText: { fontFamily: coralFonts.semibold, fontSize: 12, color: INK },
});
