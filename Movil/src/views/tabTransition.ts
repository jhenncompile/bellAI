/**
 * Puente entre la barra de pestañas y las pantallas para la animación de cambio de destino
 * (design.md, sección 23). La barra publica el centro de la burbuja de cada pestaña; cada
 * pantalla lo lee al recibir el foco para abrirse como un círculo que crece desde ese punto.
 * Las coordenadas son relativas al contenedor de las pestañas.
 */
export type TabOrigin = { x: number; y: number };

const centers = new Map<string, TabOrigin>();
let focusCount = 0;

export const tabTransition = {
  /** La barra publica el centro de la burbuja de cada destino cada vez que cambia su layout. */
  setCenters(next: Record<string, TabOrigin>) {
    centers.clear();
    Object.entries(next).forEach(([name, origin]) => centers.set(name, origin));
  },

  getCenter(routeName: string): TabOrigin | undefined {
    return centers.get(routeName);
  },

  /**
   * Cada pantalla avisa al recibir el foco. Devuelve `true` si debe animarse. La primera vez
   * (apertura de la app) no se anima, para no abrir la pantalla inicial con un círculo.
   */
  registerFocus(): boolean {
    focusCount += 1;
    return focusCount > 1;
  },
};
