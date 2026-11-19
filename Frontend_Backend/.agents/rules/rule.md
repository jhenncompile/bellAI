# Reglas de Generación de IA y Prevención de Antipatrones

## 1. Redacción y Tono (Prohibición de "Slop" y Jerga)
- **Cero lenguaje inflado y cliché**: Queda estrictamente prohibido el uso de vocabulario estadísticamente sobreutilizado por la IA, como "adentrarse" (delve), "testimonio" (testament), "tapiz" (tapestry), "crucial", "juega un papel vital", "innovador" o "revolucionario".
- **Eliminación del paralelismo negativo**: No utilices la estructura dramática predecible de contraste, como "No se trata solo de [X], es un [Y]".
- **No hay autopromoción en la UI**: Las interfaces no deben contener discursos de ventas ni jerga técnica innecesaria dirigida al usuario. Términos como "experto", "determinista", "avanzado" o explicaciones de álgebra subyacente están prohibidos en la microcopia.
- **Elimina las muletillas de transición**: Prohibido usar cierres prefabricados y redundantes como "En conclusión", "En resumen", "Es importante señalar" o "Vale la pena recordar".

## 2. Experiencia de Usuario (UX) y Modelos Mentales
- **Nunca expongas el backend**: La interfaz debe hablar el idioma del usuario, no el de la base de datos. Queda prohibido mostrar nombres de variables en bruto, IDs o jerga de desarrollo (ej. user_id_UUID, is_active_boolean o trazas de errores SQL) en la interfaz final.
- **Cero "Teatro de Interacción"**: No insertes tarjetas estáticas con sombras que parezcan clicables pero no lo sean. Tampoco agregues etiquetas o badges de estado falsos ("Activo", "En línea", "Completado") a menos que estén conectados a una lógica asíncrona real y un sujeto claro.
- **Obligación de diseñar casos extremos**: Nunca diseñes exclusivamente para el "camino feliz". Todo componente generado debe contemplar y describir su estado vacío (empty state), estado de carga e indicador de error.
- **Prohibido el Arte ASCII**: Bajo ninguna circunstancia utilices caracteres ASCII para simular esquemas, diagramas o estructuras visuales dentro del código de producción de la UI.

## 3. Elementos Visuales e Iconografía
- **Los emojis no son iconos**: Está absolutamente prohibido utilizar cadenas de emojis como reemplazo de iconografía profesional (SVG/Lucide) para menús de navegación, cabeceras, viñetas de listas o decoración de fondo.
- **Control de estética estéril**: No utilices colores neón saturados conflictivos que destruyan la jerarquía visual. En los modos oscuros, están prohibidos los efectos de resplandor (glow) o auroras difuminadas detrás del texto, ya que reducen el contraste y no aportan valor semántico.
- **No caer en el gradiente púrpura/índigo por reflejo**: Usar la paleta de la marca (lujo sobrio, champagne, terracota, negro profundo, neutros cálidos).
- **No usar Sparkles por reflejo para todo lo relacionado con IA**: Usar iconos específicos del dominio o tipografía limpia.
- **Bordes y sombras limpios**: No mezclar bordes finos con sombras difusas gigantescas. No usar radios idénticos desmedidos (`rounded-3xl` en todo).

## 4. Accesibilidad (A11y)
- **Componentes interactivos nativos**: Usar `Pressable`/`TouchableOpacity` con `accessibilityRole` y `accessibilityLabel`.
- **Aislamiento de Emojis**: Si se usa un emoji decorativo, debe aislarse con `accessible={false}` o `aria-hidden="true"`.
