/**
 * HU-28: retos semanales de estilo.
 *
 * Si nadie programó un reto para la semana en curso, el servidor crea uno a partir de este catálogo
 * (rota por número de semana, así todas las usuarias comparten el mismo reto). Cada tarea lleva la
 * pantalla de la app donde se hace (`accion`), para que la usuaria vaya directo.
 * Funciones puras: se prueban sin base de datos.
 */

/** Pantallas de la app a las que puede llevar una tarea. */
export const CHALLENGE_ACTIONS = ['studio', 'wardrobe', 'outfits', 'style', 'simulator', 'advisor', 'compatibility', 'profile'] as const;
export type ChallengeAction = (typeof CHALLENGE_ACTIONS)[number];

export interface ChallengeTaskTemplate {
  title: string;
  description: string;
  action: ChallengeAction;
}

export interface ChallengeTemplate {
  title: string;
  description: string;
  tasks: ChallengeTaskTemplate[];
}

export const CHALLENGE_CATALOG: ChallengeTemplate[] = [
  {
    title: 'Semana de tu paleta',
    description: 'Lleva tus colores favorecedores del análisis a tu ropa de todos los días.',
    tasks: [
      { title: 'Repasa tu paleta personal', description: 'Mira los colores que te favorecen y los que conviene evitar.', action: 'studio' },
      { title: 'Registra una prenda de tu paleta', description: 'Fotografía una prenda tuya en uno de tus colores.', action: 'wardrobe' },
      { title: 'Arma un outfit con dos colores tuyos', description: 'Genera combinaciones y elige una con dos tonos de tu paleta.', action: 'outfits' },
      { title: 'Pregunta cómo usar un color nuevo', description: 'Pídele a la asesora ideas para un color de tu paleta que no usas.', action: 'advisor' },
    ],
  },
  {
    title: 'Armario en orden',
    description: 'Conoce mejor lo que ya tienes antes de pensar en comprar.',
    tasks: [
      { title: 'Registra 3 prendas que usas mucho', description: 'Tus básicos ayudan a que las combinaciones sean realistas.', action: 'wardrobe' },
      { title: 'Revisa qué prendas no armonizan contigo', description: 'Busca en tu armario las que quedan fuera de tu paleta.', action: 'wardrobe' },
      { title: 'Combina una prenda olvidada', description: 'Genera combinaciones con algo que llevas tiempo sin usar.', action: 'outfits' },
      { title: 'Valora 3 combinaciones', description: 'Di si te gustan o no: así las sugerencias aprenden de ti.', action: 'outfits' },
    ],
  },
  {
    title: 'Rostro y accesorios',
    description: 'Pon a prueba los cortes, gafas y accesorios que mejor enmarcan tu rostro.',
    tasks: [
      { title: 'Revisa cortes y monturas para ti', description: 'Consulta las recomendaciones según la forma de tu rostro.', action: 'studio' },
      { title: 'Prueba un cambio en el probador', description: 'Simula un color de cabello o un accesorio sobre tu foto.', action: 'simulator' },
      { title: 'Valora recomendaciones de accesorios', description: 'Marca las que te gustan para afinar tus sugerencias.', action: 'style' },
      { title: 'Consulta qué metal te favorece', description: 'Pregunta a la asesora por oro, plata o cobre.', action: 'advisor' },
    ],
  },
  {
    title: 'Descubre tu estilo',
    description: 'Entiende tu perfil de estilo y prueba algo un poco distinto.',
    tasks: [
      { title: 'Mira tu perfil de estilo', description: 'Revisa tus dimensiones predominantes y cómo cambiaron.', action: 'style' },
      { title: 'Actualiza tus estilos preferidos', description: 'Elige los estilos con los que te identificas hoy.', action: 'profile' },
      { title: 'Valora 5 recomendaciones', description: 'Cada valoración ajusta tu perfil de estilo.', action: 'style' },
      { title: 'Prueba un outfit fuera de tu rutina', description: 'Genera combinaciones para una ocasión que no sueles elegir.', action: 'outfits' },
    ],
  },
  {
    title: 'Compra consciente',
    description: 'Antes de comprar, comprueba si la prenda te favorece y combina con tu armario.',
    tasks: [
      { title: 'Repasa tus colores a evitar', description: 'Tenlos presentes la próxima vez que vayas de compras.', action: 'studio' },
      { title: 'Evalúa una prenda antes de comprarla', description: 'Haz una foto en la tienda y mira su compatibilidad contigo.', action: 'compatibility' },
      { title: 'Arma 3 looks con una sola prenda base', description: 'Demuestra cuánto rinde una prenda que ya tienes.', action: 'outfits' },
      { title: 'Pregunta qué básico te falta', description: 'La asesora conoce tu armario: pídele el hueco más útil de cubrir.', action: 'advisor' },
    ],
  },
  {
    title: 'Silueta y proporciones',
    description: 'Usa tu análisis corporal para elegir cortes y largos que te favorecen.',
    tasks: [
      { title: 'Completa tu análisis de silueta', description: 'Haz la foto de cuerpo entero si aún no la tienes.', action: 'studio' },
      { title: 'Revisa cortes y largos para ti', description: 'Mira las recomendaciones de prendas según tu silueta.', action: 'style' },
      { title: 'Arma un outfit con esas pautas', description: 'Combina una prenda superior e inferior que sigan tus cortes.', action: 'outfits' },
      { title: 'Valora el resultado', description: 'Di si te gustó: el perfil aprende de tu opinión.', action: 'outfits' },
    ],
  },
];

/** Plantilla de la semana: rota por el número de semana ISO (todas las usuarias ven el mismo reto). */
export function templateForWeek(isoWeek: number): ChallengeTemplate {
  const i = ((Math.trunc(isoWeek) % CHALLENGE_CATALOG.length) + CHALLENGE_CATALOG.length) % CHALLENGE_CATALOG.length;
  return CHALLENGE_CATALOG[i];
}

export interface ChallengeProgress {
  completed: number;
  total: number;
  percent: number;
}

export function progressOf(tasks: { completedAt?: string | Date | null }[]): ChallengeProgress {
  const total = tasks.length;
  const completed = tasks.filter((t) => Boolean(t.completedAt)).length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}

/**
 * Racha: semanas seguidas con el reto completo, contando hacia atrás desde la actual. Si la semana
 * actual aún no está completa no rompe la racha (todavía hay tiempo); solo no suma.
 * `weeks` va de la más reciente a la más antigua y la primera es la semana en curso.
 */
export function weeklyStreak(weeks: { completed: number; total: number }[]): number {
  let streak = 0;
  for (let i = 0; i < weeks.length; i++) {
    const done = weeks[i].total > 0 && weeks[i].completed >= weeks[i].total;
    if (done) streak++;
    else if (i > 0) break;
  }
  return streak;
}
