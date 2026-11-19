import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Contenedor de escena para cada destino de la barra de navegación principal.
 * Renderizado directo sin recortes circulares pesados ni retrasos, garantizando
 * máxima fluidez y respuesta instantánea al cambiar entre pantallas con imágenes.
 */
export function TabScene({ children }: { name?: string; children: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
