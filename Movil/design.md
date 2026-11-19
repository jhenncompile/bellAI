# Análisis de diseño de BellAI

Fecha de revisión: 4 de noviembre de 2026.

> **Rediseño de referencia (secciones 19 a 31).** Se incorporó un nuevo diseño móvil, «BellAI — Rediseño», con 37 pantallas en claro y oscuro. Las secciones 19 a 30 describen cómo se ve y cómo se comporta, y la 31 el estado de su aplicación en el código. Donde contradigan a las secciones 3 (color), 4 (tipografía), 5 (forma) o 7 (navegación), prevalecen las nuevas.

## 1. Alcance y conclusión

Este documento describe el diseño implementado en el repositorio y propone mejoras de interfaz y experiencia de uso. La revisión se basa en componentes, estilos, textos y conexiones entre pantallas. No se ejecutó una evaluación visual en dispositivos ni se consultó un archivo original de Penpot. Las menciones a Penpot en el código son referencias internas, no evidencia de fidelidad al prototipo.

BellAI tiene una identidad cálida: fondos durazno y rosa, texto tinta, superficies blancas translúcidas y esquinas redondeadas. Esta dirección encaja con una herramienta de asesoría de imagen que busca cercanía. El problema principal es la aplicación desigual del sistema: conviven colores estáticos y dinámicos, componentes con medidas diferentes y pantallas que comunican resultados sin contar con datos del usuario.

La recomendación es consolidar la identidad existente y completar sus estados antes de ampliar la decoración o incorporar otro lenguaje visual.

## 2. Identidad y tono

### Diseño observado

- La bienvenida presenta el nombre **BellAI**, un símbolo de destellos y el texto «Tu asistente inteligente de imagen, moda y belleza».
- El degradado vertical aporta continuidad entre pantallas construidas con `ScreenContainer`.
- Las tarjetas separan formularios, resultados y recomendaciones sin recurrir a divisores fuertes.
- La fotografía es central en captura y armario; los colores personales se representan mediante muestras.
- Los iconos Lucide predominan en la interfaz móvil, con trazos generalmente de 2 unidades.

### Inconsistencias

Coexisten BellAI, Bella IA, Bellia y AURA en textos, permisos y componentes. La interfaz web conserva «Expo Starter», «Home» y un acceso a documentación de Expo en su navegación. Esto debilita la percepción de un producto terminado.

**Recomendación:** usar BellAI como nombre visible en toda la experiencia. Reservar otros nombres para conceptos que se expliquen al usuario. Mantener el español en navegación, mensajes y acciones. Revisar expresiones como «alta precisión», «biométrico» y «colores tóxicos»: la interfaz debe explicar el alcance real del análisis y evitar presentar preferencias estéticas como verdades universales.

Fuentes: [bienvenida](src/views/CU00WelcomeView.tsx), [cabecera](src/widgets/AuraHeroHeader/ui/AuraHeroHeader.tsx), [configuración](app.json), [navegación web](src/components/app-tabs.web.tsx).

## 3. Sistema de color

### Paleta implementada

| Función | Tema claro | Tema oscuro |
| --- | --- | --- |
| Fondo principal | `#FBE8DD` | `#241F26` |
| Final del degradado | `#F6D3E0` | `#38323C` |
| Texto principal | `#241F26` | `#FFFFFF` |
| Texto secundario | `#746668` | `#D6C5B0` |
| Texto atenuado | `#A5A2A8` | `#A5A2A8` |
| Acento rosa | `#E8899F` | `#E8899F` |
| Superficie de tarjeta | Blanco al 55 % | Blanco al 10 % |
| Superficie de campo | Blanco al 75 % | Blanco al 14 % |
| Error | `#B5482E` | `#B5482E` |

Los colores cobre `#C97B4A`, oliva `#7A8450` y ocre `#D9A441` complementan la marca. Las paletas de diagnóstico deben mantenerse separadas conceptualmente de los colores que indican acciones y estados: una muestra de color personal no debería confundirse con un botón ni con una advertencia.

### Temas y superficies

`ThemeContext` ofrece modo claro y oscuro, persistencia y cambio manual. Sin embargo, la exportación estática `colors` siempre corresponde al tema claro. Bienvenida, acceso, armario y partes del chat consumen esa exportación, mientras sus contenedores o componentes internos pueden consumir el tema activo. Por lectura del código, esto permite combinar superficies oscuras con textos o tarjetas configurados para el modo claro.

Además, `app.json` fija `userInterfaceStyle` en `dark`, mientras el estado inicial del proveedor es `light`. La barra inferior usa `theme.ink[900]`: su fondo pasa de tinta a blanco en modo oscuro. Esta inversión debe revisarse como decisión de diseño, pues puede interrumpir la continuidad de las superficies oscuras.

**Recomendación:** consumir colores semánticos del tema activo y definir una política explícita para la apariencia inicial. Conservar variantes estáticas solo para usos deliberados, como una tarjeta exportable con apariencia fija.

### Contraste calculado

Los siguientes valores se calcularon con luminancia relativa sRGB sobre parejas de colores sólidos del código. No representan mediciones de capturas. Las transparencias deben evaluarse sobre su fondo compuesto y los degradados en el punto de menor contraste.

| Texto / fondo | Contraste aproximado | Lectura para texto normal |
| --- | --- | --- |
| `#241F26` / `#FBE8DD` | 13,62:1 | Supera 4,5:1 |
| `#746668` / `#FBE8DD` | 4,60:1 | Supera 4,5:1 con margen reducido |
| `#A5A2A8` / `#FFFFFF` | 2,52:1 | Insuficiente si comunica información necesaria |
| `#E8899F` / `#FFFFFF` | 2,47:1 | Insuficiente |
| `#FFFFFF` / `#E8899F` | 2,47:1 | Insuficiente |
| `#777479` / `#241F26` | 3,51:1 | Insuficiente para texto normal, como etiquetas pequeñas |
| `#B5482E` / `#2E2831` | 2,69:1 | Insuficiente para mensajes de error normales |

WCAG 2.2 AA exige 4,5:1 para texto normal y 3:1 para texto grande, con las excepciones definidas por el criterio. No debe extrapolarse esta tabla a controles deshabilitados o elementos puramente decorativos. Fuente: [W3C, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Recomendación:** conservar el rosa como acento decorativo y revisar su uso en texto y foco. Definir un color de error más luminoso para superficies oscuras y reforzar los textos atenuados que sigan siendo necesarios para completar una tarea.

Fuente de tokens: [colors.ts](src/shared/theme/tokens/colors.ts).

## 4. Tipografía

### Escala actual

| Estilo | Tamaño / interlineado | Peso |
| --- | --- | --- |
| Display y puntuación | 46 / 51 | 800 |
| H1 | 34 / 39 | 800 |
| H2 | 25 / 30 | 800 |
| H3 | 20 / 25 | 800 |
| H4 | 16 / 21 | 700 |
| Cuerpo | 14 / 21 | 400 |
| Botón | 15 / 18 | 700 |
| Texto pequeño | 13 / 19 | 400 |
| Etiqueta | 12 / 16 | 600 |
| Pie de texto | 11 / 16 | 400 |

Son unidades declaradas en los estilos de React Native, no píxeles físicos del dispositivo.

En la revisión inicial los tokens declaraban Nunito sin cargarla, por lo que se mostraba la fuente del sistema. Con el rediseño, Nunito y Fraunces se cargan con `useFonts` desde `@expo-google-fonts` (sección 31). El módulo Atelier utiliza fuentes del sistema y mantiene otra escala de espaciado.

Hay modificaciones locales de los tamaños: la marca usa 46 en bienvenida, 38 en acceso y 30 en la cabecera. Pueden tener sentido por contexto, pero deberían ser variantes documentadas. Los textos de 11 y 12 requieren especial cuidado sobre superficies translúcidas.

**Recomendación:** verificar primero la fuente realmente renderizada y sus pesos. Usar los presets compartidos; reservar tamaños pequeños para metadatos secundarios. Probar texto ampliado y evitar que alturas fijas o truncamientos oculten instrucciones, errores o acciones.

Fuente: [typography.ts](src/shared/theme/tokens/typography.ts).

## 5. Espaciado, forma y profundidad

El sistema compartido define una escala de **2, 4, 8, 12, 16, 20, 24, 32, 40 y 48**. El margen lateral de referencia es 20. Los tokens incluyen un lienzo de 390 × 844 como referencia; no debe tratarse como dimensión obligatoria de pantalla.

| Elemento | Medida declarada |
| --- | --- |
| Botón | Alturas mínimas de 48, 52 y 56 |
| Campo de entrada | Referencia de 50 en tokens de componentes |
| Tarjeta | Radio estándar 20; algunas pantallas usan 24 o 28 |
| Botón | Radios de 16 o 20 |
| Campo | Radio de referencia 14 |
| Chip | Alto visual 36 y forma de píldora |
| Barra inferior móvil | Base de 53 más espacio inferior seguro |

`CardGlass` implementa transparencia y borde; no aplica desenfoque por sí mismo. El nombre «glass» describe aquí una apariencia translúcida. Las sombras compartidas son suaves en modo claro y más intensas en oscuro.

Atelier tiene espaciados 4/8/14/20/28 y radios 10/14/18/24, además de una sombra violeta de botón. Su paleta ya deriva del tema global, pero estas medidas y la sombra mantienen diferencias con el resto del sistema. Su existencia en el repositorio no implica que todas sus pantallas sean accesibles desde la navegación principal.

**Recomendación:** adoptar el sistema de `shared/theme` como base y justificar las excepciones por función. Reservar sombras marcadas para elementos flotantes y usar superficies más opacas cuando la legibilidad lo requiera.

Fuentes: [espaciado](src/shared/theme/tokens/spacing.ts), [formas](src/shared/theme/tokens/shapes.ts), [tarjeta](src/shared/ui/card/CardGlass.tsx), [Atelier](src/features/digital-wardrobe/theme/atelierTheme.ts).

## 6. Componentes e interacción

| Componente | Estado actual | Mejora propuesta |
| --- | --- | --- |
| Botones | Variantes compartidas, carga, bloqueo y animación al pulsar | Una acción primaria por bloque; conectarla al estado real de la operación |
| Campos | Etiqueta, ayuda, foco, error y éxito en `InputBase` | Sustituir campos aislados cuando corresponda y asociar etiquetas accesibles |
| Tarjetas | Variantes sólidas, translúcidas y elevadas | Aplicar cada variante con un propósito estable |
| Chips | Selección visible, estado accesible y área ampliada mediante `hitSlop` | Comprobar separación entre áreas táctiles y lectura con texto ampliado |
| Muestras de color | Selección y representación cromática | Acompañar color con nombre y marca de selección |
| Modales | Flujos de cámara, confirmación y detalle | Unificar cierre, retroceso, foco y conservación de datos |
| Mensajes | Uso de alertas y estados locales | Mensajes junto a la acción que falló, con recuperación disponible |

Los botones principales usan tinta y texto blanco en modo claro, por lo que constituyen un ancla visual clara. Las variantes secundarias deben mantener menor peso para facilitar la elección.

Los componentes base incluyen animaciones de escala: 0,96 en botones y 0,985 en tarjetas. Los tokens de duración abarcan 100–400 ms. No encontré gestión explícita de la preferencia de movimiento reducido en la búsqueda realizada.

**Recomendación:** mantener las animaciones breves y permitir reducirlas. Usar háptica como complemento de la respuesta visual; revisar eventos donde pantalla y componente base pueden vibrar por la misma pulsación.

Fuentes: [botones](src/shared/ui/button/ButtonBase.tsx), [campos](src/shared/ui/input/InputBase.tsx), [chips](src/shared/ui/chip/Chip.tsx), [movimiento](src/shared/theme/tokens/motion.ts).

## 7. Navegación y arquitectura de información

### Navegación móvil implementada

| Pestaña | Contenido conectado | Observación |
| --- | --- | --- |
| Inicio | Captura, puntuación, accesos a módulos y resumen | Acumula varios bloques antes de completar el primer análisis |
| Armario | Búsqueda, filtros y prendas | La acción de añadir es visible en la cabecera |
| Probador | Resumen, rostro, tono, paleta y silueta | El nombre sugiere probar cambios, pero el contenido conectado prioriza resultados |
| Asistente | Conversación y sugerencias | El encabezado puede mostrar una estación predeterminada |
| Perfil | Cuenta, preferencias y privacidad | Las acciones destructivas necesitan diferenciación y confirmación claras |

`challenge` y `explore` están ocultas en la barra móvil. En web se muestran únicamente Home y un acceso a `explore` rotulado «Ranking & Duelos (Armario)»; esa ruta renderiza retos. La diferencia afecta tanto a la orientación como al acceso a funciones.

**Recomendación:** conservar destinos principales equivalentes entre plataformas. Si la sección agrupa resultados y recomendaciones, considerar el nombre «Mi análisis». Reservar «Probador» para una experiencia donde se visualicen cambios sobre una imagen. Mostrar la ubicación actual y asegurar que el retroceso de modales conserve el contexto.

Fuentes: [pestañas móviles](src/components/app-tabs.tsx), [pestañas web](src/components/app-tabs.web.tsx), [estudio](src/screens/StudioScreen.tsx).

## 8. Análisis por recorrido

### Bienvenida y acceso

La bienvenida tiene una estructura sencilla: marca, explicación y dos acciones. El formulario de acceso reutiliza una tarjeta y campos etiquetados, lo que reduce diferencias visuales.

En `CU00WelcomeView`, el centrado y margen lateral se envían mediante `contentContainerStyle` a un contenedor no desplazable. La rama correspondiente de `ScreenContainer` no utiliza esa propiedad. Es una discrepancia concreta entre el diseño declarado y el aplicado que debe comprobarse en pantalla.

El acceso no refleja la petición pendiente mediante un estado de carga propio en el botón. Recuperar contraseña presenta un estado de envío sin ejecutar una solicitud. Desde UX, una confirmación debe corresponder a una operación real y permitir recuperarse de un fallo.

**Propuesta:** conservar la composición simple, corregir el contenedor y mostrar carga, validación junto al campo y resultado real de la operación. Verificar teclado y desplazamiento en formularios largos.

### Inicio y primer análisis

Inicio combina cabecera, captura, acceso al armario, puntuación, módulos y tarjeta para compartir. Es útil para una persona con historial, pero antes del primer análisis debería priorizar la captura y explicar qué se obtendrá.

La ausencia de diagnóstico no debe convertirse en una forma de rostro o estación predeterminada. La cabecera del asistente, por ejemplo, hereda «Invierno Fuerte» si no recibe otra estación. El resumen `CU16` muestra 78 de forma fija.

**Propuesta:** diseñar dos composiciones explícitas: primera visita con una acción principal y estado con resultados reales. Mostrar «Análisis pendiente» donde todavía no existan datos. Presentar la puntuación como una medida de la aplicación con explicación de su alcance, evitando asociarla al valor personal o a una valoración objetiva de belleza.

### Captura guiada

`GuidedCameraModal` incorpora cámara, encuadre facial o corporal, cambio de cámara y revisión antes de confirmar. La oportunidad de repetir la foto favorece el control del usuario.

Coexiste con `CU09GuidedCameraView`, cuyo visor es una composición de vistas y guías, sin una previsualización de cámara en ese componente. Ambas experiencias deben comunicar con claridad cuándo hay captura real. Una malla dibujada tampoco debe presentarse como seguimiento facial si no corresponde a una detección activa.

**Propuesta:** unificar el recorrido y diferenciar permiso pendiente, permiso denegado, captura, revisión y procesamiento. Dar instrucciones breves y una acción de recuperación cuando la foto no sirva. Revisar encuadre y controles en teléfonos de distintas proporciones; el modal toma las dimensiones al cargar el módulo.

### Armario

La combinación de fotografías, búsqueda y filtros es adecuada para explorar prendas. La confirmación permite corregir categoría y color antes de guardar.

La pantalla activa no presenta estados diferenciados de carga, armario vacío y búsqueda sin coincidencias. Los filtros de temporada cambian de selección, pero no participan en `filteredGarments`. Confirmar borrado solo cierra el modal y editar abre el formulario de nueva prenda. Estas respuestas rompen la expectativa creada por los controles.

**Propuesta:** mostrar «Añade tu primera prenda» en el vacío inicial y «No encontramos prendas con estos filtros» cuando corresponda, con acciones distintas. Conectar filtros y operaciones antes de presentarlos como disponibles. Mantener contexto tras guardar y confirmar el resultado real. Para colecciones grandes, revisar la rejilla renderizada completa dentro de un contenedor desplazable y el coste de sus imágenes.

### Asistente

Las sugerencias permiten empezar sin redactar una consulta. El chat incluye un contenedor que contempla el teclado y un indicador de respuesta en curso.

El servicio actual selecciona textos de un catálogo y presupone rasgos personales. La interfaz promete asesoría personal, pero no comunica esa limitación. El error se maneja con háptica sin mensaje ni reintento visible.

**Propuesta:** ajustar los textos al alcance implementado, usar el diagnóstico solo cuando esté disponible y permitir reenviar una consulta fallida. Verificar que el último mensaje y el campo permanezcan visibles al abrir el teclado.

### Perfil y privacidad

La existencia de resumen de datos, exportación y gestión de consentimiento facilita el control de la cuenta. El diseño debe distinguir acciones habituales de borrar fotografías o eliminar la cuenta.

**Propuesta:** describir el efecto de cada acción, ofrecer cancelación y mostrar progreso y errores recuperables. Las indicaciones de autorización deben corresponder al comportamiento de captura y análisis; cambiar un control visual sin aplicar la preferencia en el recorrido no satisface la expectativa del usuario.

Fuentes: [inicio](src/screens/HomeScreen.tsx), [captura](src/widgets/GuidedCamera/ui/GuidedCameraModal.tsx), [armario](src/views/CU20WardrobeView.tsx), [coordinación del armario](src/screens/WardrobeScreen.tsx), [chat](src/widgets/ChatAdvisorView/ui/ChatAdvisorView.tsx), [privacidad](src/views/CU11PrivacyDataView.tsx).

## 9. Accesibilidad y adaptación móvil

La revisión de código no permite certificar WCAG 2.2 AA. Hay una base favorable en roles, etiquetas y estados accesibles de varios componentes, pero es necesario comprobar su comportamiento con tecnologías de asistencia.

La regla del proyecto exige objetivos táctiles de al menos **44 × 44**. Debe verificarse el área efectiva, no solo la figura visible: los chips miden 36 de alto y amplían su área mediante `hitSlop`; el cambio de tema también amplía sus 36 × 36. `IconButton` permite un ancho de 36 en tamaño pequeño sin declarar esa ampliación en su propia implementación. Evitar que áreas ampliadas se superpongan o queden recortadas por sus contenedores.

Esta regla interna es más exigente en tamaño que el mínimo general de 24 × 24 píxeles CSS del criterio AA 2.5.8, que contempla excepciones. No se deben confundir unidades nativas con píxeles físicos ni atribuir el requisito interno de 44 al criterio AA. Fuente: [W3C, tamaño mínimo de objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Antes de considerar el diseño validado:

- Revisar VoiceOver y TalkBack: orden de lectura, nombres, selección, carga y anuncios de error.
- Asociar campos con etiquetas; no depender únicamente del placeholder.
- Acompañar estados cromáticos y muestras con texto o símbolos comprensibles.
- Ocultar de la lectura los iconos y emojis decorativos, conservando el significado en la etiqueta de la acción.
- Comprobar foco visible y navegación por teclado en web, incluido el retorno del foco al cerrar modales.
- Probar texto ampliado, pantallas estrechas, teclado abierto y áreas seguras sin contenido ni acciones recortadas.
- Comprobar contraste sobre el fondo real y modos de apariencia de todas las pantallas.
- Respetar la preferencia de movimiento reducido y ofrecer respuestas visuales además de hápticas.

## 10. Estados de experiencia que deben unificarse

| Flujo | Vacío o primera visita | Carga | Error con recuperación | Éxito |
| --- | --- | --- | --- | --- |
| Análisis | Explicación y comenzar captura | Paso actual sin porcentaje inventado | Repetir foto o reintentar | Resultado asociado a la foto y fecha |
| Armario | Añadir primera prenda | Esqueleto de tarjetas | Reintentar o consultar respaldo identificado | Prenda visible y confirmación |
| Búsqueda | Instrucción inicial cuando ayude | Solo si hay trabajo asíncrono | Reintentar si depende de una consulta | Coincidencias o mensaje de cero resultados |
| Asistente | Presentación y sugerencias | Indicador de respuesta | Mensaje conservado y reenviar | Respuesta de alcance claro |
| Perfil y privacidad | Explicar datos aún no disponibles | Indicador por sección | Reintentar sin perder el contexto | Confirmación del cambio persistido |
| Autenticación | Campos y ayudas | Bloquear el envío duplicado | Error junto al formulario | Acceso tras confirmar la sesión |

Estos son estados propuestos como contrato de diseño; la tabla no afirma que todos estén implementados. Los mensajes deben explicar qué ocurrió y qué puede hacer la persona, sin códigos internos, identificadores ni detalles de infraestructura.

## 11. Prioridades de mejora

| Prioridad | Trabajo | Criterio de aceptación |
| --- | --- | --- |
| P0 | Eliminar resultados y confirmaciones ficticias | Sin datos aparece un estado pendiente; solo se confirma una operación completada |
| P0 | Alinear consentimiento y tratamiento de fotos | El recorrido refleja la autorización vigente antes de guardar o analizar |
| P1 | Unificar temas y contrastes | Las pantallas principales funcionan en claro y oscuro sin mezclar tokens estáticos |
| P1 | Completar estados de carga, vacío y recuperación | Cada operación asíncrona ofrece información y una salida útil |
| P1 | Corregir expectativas del armario | Filtrar, editar y borrar producen el efecto anunciado |
| P1 | Unificar marca y destinos entre plataformas | Sin restos de Expo Starter ni rótulos que lleven a otra función |
| P2 | Consolidar tipografía y medidas | Fuente verificada y excepciones de componentes documentadas |
| P2 | Validar interacción accesible y adaptación | Controles operables con lector, texto ampliado y teclado |
| P2 | Ajustar jerarquía de Inicio y nombres | Primera captura visible y destino de resultados comprensible |

## 12. Validación y límites

El análisis cubre el sistema compartido, navegación móvil y web, acceso, inicio, captura, armario, estudio, chat y privacidad. La profundidad varía por recorrido; no sustituye una prueba completa de cada pantalla.

Se verificaron las definiciones de color y se calcularon las parejas de contraste incluidas en este documento. No se midieron tiempos de tarea, satisfacción, rendimiento visual ni tasas de conversión. Tampoco se certificó accesibilidad.

La siguiente validación visual debe cubrir Android e iOS, ambos temas, una pantalla estrecha y otra amplia, texto ampliado, permisos denegados y pérdida de conexión. La versión web necesita una revisión independiente de navegación y foco. Las referencias del código a diseños de Penpot deben contrastarse con el archivo original cuando esté disponible.

El archivo `.agents/rules/business.md` no está presente en esta copia del repositorio; esta revisión aplica las reglas de diseño y producción reproducidas en `AGENTS.md` y en las instrucciones proporcionadas.

## 13. Ajustes aplicados a login y registro

Las observaciones anteriores describen la revisión inicial. Posteriormente se actualizaron ambas pantallas con una estructura compartida en [AuthScreenLayout](src/features/auth/ui/AuthScreenLayout.tsx):

- Cabecera compacta de BellAI y regreso a bienvenida; formulario centrado con ancho máximo de 460 y margen lateral de 20.
- Tarjeta con radio de 24 y relleno de 20 aplicado una sola vez. Los espacios entre campos pertenecen al contenedor, sin añadir márgenes al texto del campo.
- Colores del tema activo, etiquetas y placeholders con contraste reforzado mediante el texto secundario.
- Contenido desplazable y ajuste al teclado, sin el espacio inferior reservado para las pestañas de la aplicación.
- Campos con autocompletado, avance de foco y control para mostrar u ocultar la contraseña con área mínima de 44 × 44.
- Estado de envío conectado a autenticación, bloqueo de solicitudes duplicadas y error visible en el formulario que conserva los datos para reintentar.
- Registro con aceptación del tratamiento de datos desmarcada inicialmente. Este control de registro no sustituye el consentimiento específico de análisis fotográfico.

La adaptación visual al teclado, el escalado de texto y ambos temas todavía requiere comprobación en dispositivos. Estos cambios no completan la recuperación de contraseña ni los demás recorridos señalados en la revisión inicial.

## 14. Ajustes aplicados a la bienvenida

La [pantalla de bienvenida](src/views/CU00WelcomeView.tsx) utiliza ahora el tema activo y una composición desplazable con margen lateral de 20 y ancho máximo de 460, coherente con login y registro. El contenido tiene un centrado real y permite desplazarse cuando no cabe; ya no depende de `contentContainerStyle` en la rama no desplazable de `ScreenContainer`.

La marca precede a una ilustración decorativa de prendas y muestras de color, excluida de la lectura accesible. Estas muestras ilustran el producto y no representan un diagnóstico personal. El mensaje «Tu estilo, a tu manera» y las etiquetas de color personal y armario digital explican la propuesta antes de las acciones.

La tarjeta de acceso aplica su relleno una sola vez. «Comenzar» es la acción principal y abre registro; «Ya tengo una cuenta» conserva menor peso visual y abre login. Ambos botones ocupan el ancho disponible y reutilizan los componentes compartidos. Queda pendiente validar visualmente la composición en dispositivos y con texto ampliado.

## 15. Reorganización de pantallas principales

Se conserva la paleta original de BellAI y sus degradados en ambos temas. El criterio minimalista se aplica a la jerarquía, el espaciado y la cantidad de bloques; no se sustituyen los colores por una paleta neutra. Las observaciones anteriores describen la revisión inicial, previa a estos ajustes.

- **Inicio:** una acción principal para comenzar el análisis, un resumen del resultado disponible y accesos a las tareas diarias. La tarjeta para compartir se despliega por decisión de la persona.
- **Armario:** acción de añadir con etiqueta, búsqueda, categorías presentes en los datos y filtro de color funcional. Se distinguen carga, error, copia local, armario vacío y búsqueda sin resultados. La lista virtualizada adapta sus columnas al ancho y a la escala de texto.
- **Mi análisis:** sustituye el nombre «Probador» para describir el contenido real. Agrupa resumen, paleta, rostro y silueta. Los resultados proceden del análisis disponible; si faltan, se explica el siguiente paso en lugar de presentar los valores de ejemplo de las vistas anteriores.
- **Asistente:** cabecera propia, contraste de mensajes según el tema, sugerencias y envío accesibles y reintento de respuesta. La conversación sigue los mensajes nuevos mientras la persona permanece cerca del final.
- **Perfil:** identidad, preferencias, análisis y privacidad agrupados. Apariencia permite cambiar el tema. Se retiran las filas sin acción y las métricas de looks y racha que se mostraban con valores fijos.
- **Navegación:** mismos cinco destinos en móvil y web. Las pantallas auxiliares conservan sus rutas fuera de la barra principal.

`PageHeader`, `NavigationRow` y `ContentState` concentran los patrones compartidos en `shared/ui`. Los chips tienen una altura mínima de 44 y crecen con el texto. Los contenedores de página limitan el ancho de lectura en pantallas grandes.

La actualización de resultados al volver a una pestaña evita volver a guardar una copia de la fotografía. Las vistas de captura, acceso y edición conservan sus flujos existentes. Estos cambios no constituyen una certificación de accesibilidad ni una validación visual en un teléfono; quedan por comprobar el teclado, el lector de pantalla y la captura en un dispositivo real.

## 16. Plan de evolución visual y de navegación

Este plan se limita al diseño visual, arquitectura de información y navegación. No incorpora nuevas capacidades de análisis, cambios de API ni modificaciones del modelo de datos. Cada fase se valida antes de comenzar la siguiente.

### Fase 1 — Coherencia de marca y navegación

**Objetivo:** que cualquier persona comprenda dónde está, qué puede hacer y cómo volver.

- Consolidar **BellAI** como único nombre visible; retirar rótulos heredados, nombres alternativos y referencias de Expo.
- Mantener los cinco destinos principales: Inicio, Armario, Mi análisis, Asistente y Perfil. Aplicar las mismas etiquetas, orden, iconos y destinos en móvil y web.
- Revisar las rutas auxiliares, modales y retornos para que conserven el contexto de origen y no compitan con la navegación principal.
- Hacer que la pestaña activa, títulos de página y encabezados describan el contenido real. «Mi análisis» agrupa resultados; cualquier futuro probador visual tendrá una ruta y nombre propios.

**Criterio de salida:** no hay destinos duplicados, rótulos contradictorios ni una pantalla principal inaccesible desde su plataforma.

### Fase 2 — Sistema visual único y accesible

**Objetivo:** pasar de estilos locales a un lenguaje de interfaz consistente en claro y oscuro.

- Consolidar color, tipografía, espaciado, radios, elevación y movimiento en `shared/theme`; sustituir valores estáticos que rompan el tema activo.
- Ajustar contrastes de textos secundarios, errores, chips y acciones para cumplir WCAG 2.2 AA sobre la superficie real.
- Normalizar variantes de botones, campos, tarjetas, chips, encabezados y mensajes. Cada variante tendrá un propósito: acción primaria, secundaria, destructiva, selección o información.
- Definir tamaños mínimos de 44 × 44, foco visible, escalado de texto y movimiento reducido para todos los controles interactivos.

**Criterio de salida:** las pantallas principales se ven consistentes en ambos temas y ningún dato necesario depende solo del color o de texto de bajo contraste.

### Fase 3 — Recorridos principales y jerarquía

**Objetivo:** reducir carga cognitiva y dar prioridad a la tarea que la persona necesita completar.

- **Inicio y primer uso:** destacar una sola acción principal, «Comenzar mi análisis», y mostrar una composición explícita cuando aún no existen resultados.
- **Armario:** diferenciar visualmente armario vacío, búsqueda sin resultados, carga, copia sin conexión y error. Mantener la acción «Añadir prenda» siempre disponible y contextual.
- **Mi análisis:** presentar resumen, paleta, rostro y silueta como secciones de un mismo resultado, con estados pendientes claros y lenguaje orientativo.
- **Asistente y Perfil:** simplificar cabeceras, agrupar ajustes por intención y dar peso visual proporcional a las acciones destructivas o relacionadas con privacidad.
- **Galería BellAI:** comunicar antes del permiso que solo la imagen mejorada se guardará automáticamente y confirmar visualmente el destino después de hacerlo.

**Criterio de salida:** cada recorrido tiene una acción dominante, explica los estados sin datos y permite recuperarse sin perder el trabajo de la persona.

### Fase 4 — Pulido y validación visual

**Objetivo:** detectar fallos que no aparecen al revisar solo el código.

- Revisar Android e iOS, tema claro y oscuro, pantalla estrecha y amplia, texto ampliado, teclado abierto y áreas seguras.
- Probar TalkBack, VoiceOver, navegación por teclado en web y retorno de foco al cerrar un modal.
- Verificar permisos de cámara, galería y fotos guardadas con estados de permiso concedido, denegado y recuperado desde ajustes.
- Recoger una prueba breve con personas usuarias: encontrar una prenda, iniciar un análisis, interpretar un resultado y localizar privacidad. Corregir los bloqueos antes de añadir decoración o destinos nuevos.

**Criterio de salida:** los recorridos clave se completan sin instrucciones externas, sin texto recortado y con mensajes de recuperación comprensibles.

## 17. Orden de introducción

| Entrega | Introducción visible | Dependencia |
| --- | --- | --- |
| 1 | Marca BellAI, pestañas equivalentes, títulos y retornos coherentes | Ninguna |
| 2 | Tokens semánticos, componentes normalizados y contraste corregido | Entrega 1 |
| 3 | Estados visuales y jerarquía de Inicio, Armario, Mi análisis, Asistente y Perfil | Entrega 2 |
| 4 | Avisos de galería, adaptación y validación en dispositivos | Entrega 3 |

No se deben mezclar estas entregas con cambios funcionales que alteren los contratos de la API o el almacenamiento local. Si una decisión visual exige una función nueva, se documentará como una propuesta separada antes de implementarla.

## 18. Estado de implementación

- **Fase 1:** en curso. Las pestañas principales ya comparten destinos; BellAI sustituye los nombres alternos en textos, permisos y tarjetas visibles.
- **Fase 2:** en curso. Los componentes principales usan tokens del tema, los chips respetan un objetivo táctil de 44 y los botones detienen su escala cuando el sistema solicita reducir movimiento. Se ajustó el color de error en modo oscuro.
- **Fase 3:** en curso. Inicio, Armario y Mi análisis cuentan con composiciones para ausencia de datos. El registro de prenda explica que únicamente su resultado mejorado se guardará en el álbum BellAI.
- **Fase 4:** pendiente de validación manual en dispositivos y lectores de pantalla.
- **Rediseño de referencia:** documentado en las secciones 19 a 30 y aplicado en parte (entregas A a E, sección 31). Falta la validación en dispositivos.

## 19. Rediseño de referencia: alcance y estado

**Origen.** Lienzo «BellAI — Rediseño» (artifact de Claude Design, 5ea07d3a). Contiene 41 tableros: 37 pantallas móviles de 390 × 844 y 4 pantallas de administración web de 1280 × 800. Cada pantalla tiene un ajuste `tema` (claro u oscuro). La app principal tiene además `conResultados`, que alterna entre primera visita y usuaria con análisis.

**Versiones leídas.** Dos. La segunda cambió el color de error en claro, los destinos de la bienvenida, los textos de privacidad en Consentimiento y Analizando, el título de Silueta, el vacío del Armario y las notas que marcan simulación, avatar y retos como propuesta fuera de este ciclo. Este documento refleja la segunda.

**Cómo se revisó.** Se leyó el código fuente de los tableros (`bell.css` y cada `.dc.html`). Los contrastes de la sección 20 se calcularon a partir de los colores declarados. No se renderizó el lienzo ni se probó en un dispositivo, así que la descripción visual sale del código y no de capturas.

**Estado en el repositorio.** Al redactar esta sección el código no tenía `#8F3A52`, Fraunces ni burbuja en la barra de pestañas. Después se aplicaron las entregas A a E; el estado actual está en la sección 31. Lo que no figure allí sigue siendo especificación.

**Qué cambia respecto a las secciones anteriores.**

| Aspecto | Antes (secciones 3 a 7) | Rediseño |
| --- | --- | --- |
| Texto de énfasis y enlaces | Rosa `#E8899F` (2,47:1 sobre blanco) | Vino `#8F3A52` en claro (6,11:1) y rosa claro `#F4A6B8` en oscuro |
| Botón primario en oscuro | Texto blanco sobre rosa (2,47:1) | Texto tinta sobre rosa (6,55:1) |
| Tipografía | Nunito en todo | Fraunces para títulos y cifras, Nunito para el resto |
| Barra de pestañas | Barra con fondo de tinta | Barra flotante translúcida con burbuja y onda de expansión |
| Pantalla de resultados | Lista de pantallas sueltas | Resumen con enlaces a rostro, tono, paleta y silueta, más Style DNA |
| Motivo gráfico | Tarjetas rectas | Arcos (`999px 999px 18px 18px`) para muestras, prendas y avatares |

## 20. Color del rediseño en claro y oscuro

Los colores se definen como variables en `.app` y se invierten con la clase `.dark`. Conservan la identidad durazno y rosa de la sección 3.

| Variable | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--bg1` / `--bg2` | `#FBE8DD` / `#F6D3E0` | `#241F26` / `#38323C` | Degradado vertical del fondo |
| `--ink` | `#241F26` | `#FFFFFF` | Texto principal |
| `--ink2` | `#5F5254` | `#D6C5B0` | Texto secundario |
| `--card` | Blanco al 68 % | Blanco al 10 % | Tarjetas, con desenfoque de 14 |
| `--line` | Blanco al 90 % | Blanco al 16 % | Borde de tarjetas y separadores |
| `--line2` | Tinta al 20 % | Blanco al 26 % | Borde de campos |
| `--acc` | `#8F3A52` | `#F4A6B8` | Palabra en cursiva, enlaces, foco |
| `--btn` / `--btnt` | `#241F26` / `#FFFFFF` | `#E8899F` / `#241F26` | Botón primario y su texto |
| `--soft` | Rosa al 28 % | Rosa al 22 % | Fondo de iconos, pasos, chips informativos |
| `--sheet` | `#FFF6F0` | `#2E2831` | Hojas inferiores y diálogos |
| `--scrim` | Tinta al 50 % | Negro al 60 % | Velo detrás de hojas |
| `--shadow` | Tinta al 16 % | Negro al 45 % | Sombras |
| `--err` | `#9E3B25` | `#FF9F8A` | Error y acciones destructivas |
| `--ok` | `#4F6B2E` | `#B7D68A` | Confirmación |
| `--warn` | `#8A5A00` | `#F0C36A` | Advertencia |
| `--bar` | Blanco al 90 % | `#342D39` al 94 % | Barra de pestañas |

**Fondo.** Además del degradado, cada pantalla lleva dos halos radiales (rosa a la izquierda, ocre a la derecha) que se desplazan despacio.

**Cámara.** Las pantallas de captura usan siempre un fondo oscuro (`#4A3A4E` hacia `#241F26`), texto blanco y botón blanco, sin importar el tema. Las hojas inferiores sobre la cámara vuelven a tinta sobre fondo claro.

**Colores que no cambian con el tema.** La tarjeta de resultado (degradado `#F7B9C6`, `#E8899F`, `#E5A06F` con texto `#241F26`), los arcos de color, las muestras de la paleta y la tarjeta para compartir. Son contenido o piezas de marca y su texto está calculado para el fondo fijo.

**Paleta de marca y de diagnóstico.** Rosa `#E8899F`, cobre `#C97B4A`, oliva `#7A8450`, ocre `#D9A441`, terracota `#B5593B`, camel `#C19A6B`, ciruela `#7A3B52`, bosque `#3F5B3A`, chocolate `#5C3D2E`, beige `#D8C3A5`, crema `#F3E3C8`, marfil `#FAF4EA`. Las muestras son circulares o en arco, miden al menos 44 de lado en selección, llevan nombre debajo y marca interior (✓ para elegir, ✕ para evitar) cuando están activas.

### Contraste calculado

Parejas de colores sólidos del código, con la misma fórmula de la sección 3. Las tarjetas translúcidas se evaluaron sobre el degradado ya compuesto.

| Texto / fondo | Claro | Oscuro |
| --- | --- | --- |
| `--ink` / `--bg1` | 13,62:1 | 16,17:1 |
| `--ink` / `--bg2` | 11,79:1 | 12,43:1 |
| `--ink2` / `--bg1` | 6,27:1 | 9,60:1 |
| `--ink2` / `--bg2` | 5,43:1 | 7,38:1 |
| `--ink2` / tarjeta sobre `--bg2` | 6,75:1 | 5,42:1 |
| `--acc` / `--bg1` | 6,11:1 | 8,46:1 |
| `--acc` / `--bg2` | 5,29:1 | 6,51:1 |
| `--btnt` / `--btn` | 16,17:1 | 6,55:1 |
| `--err` / `--bg1` | 5,69:1 | 8,14:1 |
| `--err` / `--bg2` | 4,93:1 | 6,26:1 |
| Texto blanco / botón destructivo | 6,76:1 | 8,14:1 (texto tinta) |
| `--ok` / `--bg1` | 5,09:1 | 7,69:1 (sobre `--bg2`) |
| `--warn` / `--bg1` | 4,99:1 | 7,53:1 (sobre `--bg2`) |
| `--ink2` / `--sheet` | 6,98:1 | 8,52:1 |
| Icono de burbuja / burbuja | 12,40:1 | 8,46:1 |
| Etiqueta de pestaña / barra | 7,24:1 | 7,89:1 |

Todas las parejas de la tabla superan 4,5:1. En la primera versión del lienzo `--err` valía `#B5482E` y daba 3,90:1 sobre el extremo rosa del degradado; la segunda versión lo oscureció a `#9E3B25`. Los textos de 12 y 12,5 con peso 800 en etiquetas y chips dependen de que se mantengan estos contrastes. No se midieron los controles inactivos ni el interruptor apagado (pista de tinta al 40 %); queda por verificar su contraste de 3:1 como componente.

## 21. Tipografía del rediseño

| Rol | Fuente | Tamaño | Peso | Notas |
| --- | --- | --- | --- | --- |
| Marca y titulares de bienvenida | Fraunces | 46 / 40 / 34 | 500 | Interlineado 1,02 a 1,06; espaciado −0,02 em |
| Título de pantalla (`h1.disp`) | Fraunces | 32 | 500 | En cabecera con botón de retorno baja a 26 |
| Subtítulo (`h2.disp`) | Fraunces | 24 | 500 | Se usa entre 22 y 38 según la pieza |
| Título de tarjeta (`h3.disp`) | Fraunces | 19 | 600 | |
| Cifras destacadas | Fraunces | 36 a 44 | 500 | Puntuación, estación, cifras de administración |
| Introducción (`.lead`) | Nunito | 14,5 / 1,5 | 400 a 600 | Color `--ink2` |
| Texto de apoyo (`.sm`) | Nunito | 13 / 1,4 | 600 | |
| Botón | Nunito | 15 | 800 | |
| Etiqueta de sección (`.sec`, `.eyebrow`) | Nunito | 12 | 800 | Mayúsculas, espaciado 0,12 em |
| Pie de muestra (`.cap`) | Nunito | 12 | 700 | |
| Etiqueta de pestaña | Nunito | 11 | 700 | 800 en la activa |

**Recurso distintivo.** En casi todos los títulos, la palabra clave va en cursiva y con `--acc`: «Hola, *bella*», «Tu *paleta*», «Qué bueno *verte*». Mantenerlo como convención de marca y no aplicarlo a más de una palabra por título.

**Por resolver.** El prototipo carga Fraunces y Nunito desde Google Fonts. En la app nativa hay que registrarlas con `expo-font` (con los pesos 500, 600 y la cursiva de Fraunces; 400, 600, 700 y 800 de Nunito) y comprobar el comportamiento si la carga falla. Esto ya estaba pendiente para Nunito en la sección 4. La etiqueta de pestaña de 11 queda por debajo del mínimo recomendado de 12 en la sección 4; comprobar con texto ampliado.

## 22. Forma, superficies y movimiento

| Elemento | Medida |
| --- | --- |
| Tarjeta | Radio 24, relleno 16, borde `--line`, sombra suave |
| Tarjeta de resultado (héroe) | Radio 32, degradado fijo, arcos translúcidos decorativos |
| Hoja inferior | Radio superior 32, asa de 44 × 5, relleno 12 / 20 / 30 |
| Diálogo | Radio 28, margen lateral 24, centrado |
| Botón primario | Alto mínimo 52 (56 en bienvenida), radio 20, brillo que cruza cada 4 s |
| Botón compacto | Alto 44, radio 16 |
| Botón secundario (`.ghost`) | Transparente, borde de 1,5 en `--ink`, sin brillo |
| Botón destructivo | Fondo `--err`, texto blanco en claro y tinta en oscuro |
| Botón de icono | Círculo de 44 con borde y fondo de tarjeta |
| Chip | Alto 44, radio 22, borde `--line`; activo: fondo `--btn` |
| Etiqueta (`.tag`) | Píldora, relleno 5 / 12, texto 12,5; variantes ok, advertencia y mala |
| Campo | Alto 52, radio 18, borde de 1,5 en `--line2`; foco: borde `--acc` |
| Interruptor | 52 × 30, perilla de 24; activo en rosa `#E8899F` |
| Casilla | 26 × 26, radio 8 |
| Fila de lista | Alto mínimo 62, icono en círculo de 40 con fondo `--soft` |
| Arco | `border-radius: 999px 999px 18px 18px`; en prendas y muestras de diagnóstico |

**Movimiento.** Entrada escalonada de bloques (`rise`, 0,75 s con retardos de 0,1 a 0,58 s), flotación lenta de arcos, desplazamiento de halos, brillo en botones, barrido de línea sobre las guías de cámara, pulso del obturador y hoja que sube. La regla `prefers-reduced-motion` anula toda animación y transición. En React Native hay que leer la preferencia del sistema (`AccessibilityInfo.isReduceMotionEnabled`) y aplicar el mismo criterio, algo que la sección 6 ya señalaba como pendiente.

**Foco.** Contorno de 3 en `--acc` con separación de 2 en todos los controles. En móvil equivale a un estado de foco para teclado y lectores externos.

## 23. Navegación: barra con burbuja y onda

Cinco destinos, los mismos de la sección 7 y en este orden: Inicio, Armario, Mi análisis, Asistente, Perfil.

**Barra.** Flotante, a 12 de cada borde lateral y a 14 del inferior, alto 68, radio 30, fondo `--bar` translúcido con desenfoque de 18, borde `--line` y sombra amplia. Cada botón ocupa un quinto del ancho (unos 71 de ancho en 390) y cubre el alto completo, por lo que supera el mínimo de 44 × 44.

**Estado inactivo.** Icono de trazo de 22 y etiqueta de 11 en `--ink2`.

**Estado activo.** El icono sube 27 y crece un 12 %. Detrás aparece una burbuja circular de 58 con un aro de 6 del color de la barra (el aro la separa visualmente del fondo). La etiqueta pasa a `--ink` con peso 800. `aria-current="page"` marca la pestaña.

| Parte | Claro | Oscuro |
| --- | --- | --- |
| Burbuja | Degradado `#3C3042` a `#241F26` | Degradado `#F4A6B8` a `#E8899F` |
| Icono sobre la burbuja | Blanco | Tinta `#241F26` |
| Sombra de la burbuja | Rosa `#E8899F` difuso | Igual |

**Secuencia al cambiar de pestaña.**

1. La burbuja sale del botón pulsado con un rebote (sube, se estira, se comprime y asienta en 0,8 s) y emite un anillo rosa que se agranda y se desvanece.
2. Desde el centro de ese botón, la pantalla nueva se revela con un recorte circular que crece hasta cubrir todo (0,95 s). El centro del círculo sigue al botón (X de 53, 124, 195, 266 o 337; Y de 796).
3. Una onda rosa translúcida de 2200 de diámetro se expande desde el mismo punto y se desvanece en 1 s.
4. Los bloques de la pantalla nueva entran escalonados.

**Reglas de implementación.**

- Con movimiento reducido, la pantalla cambia sin recorte ni onda, y la burbuja aparece en su sitio sin rebote.
- La pantalla de **Asistente** ocupa el alto completo con el campo de mensaje fijo sobre la barra; las demás hacen scroll con 130 de margen inferior para no quedar tapadas.
- En el prototipo cada pestaña es un botón. En la app deben seguir siendo destinos de Expo Router, con la misma barra para web.
- El recorte circular y la onda son costosos en dispositivos modestos. Validar fluidez en un teléfono de gama baja antes de adoptarlos (fase 4). Si no se consigue, conservar burbuja y ripple y retirar la onda.
- Las rutas auxiliares (captura, detalle, filtros, historial) se abren sin barra y vuelven al origen con el botón de retorno.

## 24. Mapa de pantallas del rediseño

Convenciones: «claro» y «oscuro» se refieren a cómo responde la pantalla al tema. Todas las pantallas móviles tienen cabecera con botón de retorno de 44 (salvo bienvenida, App y procesando) y pie con la acción principal.

### 24.1 Bienvenida, acceso y perfil

| Pantalla | Cómo se ve | Acciones |
| --- | --- | --- |
| **Bienvenida** | Marca con icono de destellos; tres arcos flotantes (rosa, ocre-cobre con círculo tinta, rosa-oliva) con tres píldoras translúcidas («Color personal», «Armario digital», «Análisis corporal»); titular de 46 «Tu estilo, *a tu manera*» | Comenzar (primario) y Ya tengo una cuenta (secundario). Claro y oscuro |
| **Iniciar sesión** | Marca y titular «Qué bueno *verte*» sobre una tarjeta con correo y contraseña (botón de mostrar de 44) | Iniciar sesión, Crear una cuenta, ¿Olvidaste tu contraseña? |
| **Crear cuenta** | Titular «Crea tu *cuenta*»; tarjeta con nombre, correo, contraseña y casilla de tratamiento de datos | Crear cuenta, Ya tengo una cuenta |
| **Bienvenida guiada 1 de 2** | Barra de dos pasos; chips de estilo (siete) y ocasión (seis) con marca de selección | Siguiente, Omitir por ahora |
| **Bienvenida guiada 2 de 2** | Cuadrículas de cuatro muestras: «Me encantan» (✓) y «Prefiero evitar» (✕); campo de presupuesto en Bs. | Finalizar y comenzar |
| **Editar perfil** | Cambiar foto, nombre, correo, estilos como chips con «+ Añadir», colores y presupuesto | Guardar cambios |

### 24.2 Aplicación principal (cinco pestañas)

| Pestaña | Cómo se ve | Estados |
| --- | --- | --- |
| **Inicio** | Marca y campana; «Hola, *bella*». Con resultados: tarjeta héroe «Otoño *suave*», subtono y contraste, cinco muestras solapadas y botón «Ver mi análisis». Debajo, «Para hoy» con dos mosaicos («Añade una prenda», «Pregúntale a BellAI») y «Compartir mi paleta» | **Primera visita:** tarjeta con arco punteado, «Descubre *tus colores*», botón «Comenzar mi análisis» y tres pasos (Foto, Análisis, Tu paleta). No aparece el botón de compartir |
| **Armario** | «Mi *armario*» con botón Añadir; búsqueda de 52; chips de categoría con desplazamiento horizontal; rejilla de dos columnas con prendas en arco y su color nombrado | **Categoría sin prendas:** tarjeta con arco punteado, «Aún no hay *prendas aquí*», «No encontramos prendas en esta categoría. Prueba otra o añade una.» y botón «Añadir prenda» |
| **Mi análisis** | Tarjeta héroe con estación y avatar en arco; paleta de ocho muestras en rejilla; tarjetas de Rostro y Silueta; lista «Explora más» (diagnóstico completo, Style DNA, recomendaciones) | Con y sin resultados |
| **Asistente** | Cabecera «Asistente *BellAI*»; burbujas del asistente (tarjeta) y de la usuaria (tinta o rosa); muestras de color dentro de la respuesta; indicador de escritura; chips de sugerencias; campo con botón de enviar | |
| **Perfil** | «Mi *perfil*», tarjeta de cuenta, interruptores de apariencia oscura y recordatorios, accesos a análisis, privacidad y «Zona delicada» con filas en `--err` | Cambia el tema en vivo |

### 24.3 Captura y consentimiento

| Pantalla | Cómo se ve | Acciones |
| --- | --- | --- |
| **Captura de rostro** | Fondo de cámara oscuro; óvalo punteado rosa con línea que barre; chips de estado (Luz ✓, Distancia ✓, «Mira al frente» como aviso); selector Rostro / Cuerpo y obturador de 76 | Obturador, flash, cerrar |
| **Captura de cuerpo** | Silueta punteada, chips «Luz» y «Retrocede un paso» | Obturador, cambiar cámara |
| **Revisa tu foto** | Vista previa en arco; lista con Poca iluminación (✕ en `--err`), Nitidez (✓) y Encuadre incompleto (✕), cada una con consejo | Repetir foto (primario), Usar de todos modos |
| **Consentimiento** | Arco ocre con escudo; «Tus fotos, *tus reglas*»; tres garantías en lista; interruptor «Autorizo el uso de mis fotos para el análisis» | Continuar, Ahora no |
| **Analizando** | Arco con barrido blanco; frase «Analizamos tu imagen con tu permiso, cuidando tu privacidad.»; lista de cinco pasos (hecho ✓, en curso con rueda, pendiente punteado) | El enlace «Continuar al resultado» es de prototipo: avanza sin un análisis real |

### 24.4 Diagnóstico

| Pantalla | Cómo se ve |
| --- | --- |
| **Resumen** | Anillo de puntuación (78 de 100) con el texto «Medida orientativa de la app. No es un juicio sobre tu belleza.»; lista con Rostro, Tono, Paleta (cuatro puntos) y Silueta; botones «Ver mi Style DNA» y «Ver recomendaciones» |
| **Forma del rostro** | Rostro con diez puntos de referencia; «Ova*lado*»; barra de confianza; tabla de proporciones; chips «Armonizan contigo» |
| **Tono y subtono** | Barra de tono con indicador; subtono en tres chips; tarjetas de contraste y estación; nota sobre luz natural |
| **Paleta personal** | Tres grupos en arcos de 56 × 72: Recomendados, Neutros y De acento, cada uno con nombre; compartir |
| **Silueta** | Figura con seis puntos; «Reloj de *arena*» y tres medidas; chips de líneas que armonizan; aviso de que no es un ideal de cuerpo |
| **Style DNA** | Radar de siete dimensiones con descripción accesible, tres etiquetas y siete barras de 0 a 100 |

### 24.5 Armario digital

| Pantalla | Cómo se ve |
| --- | --- |
| **Añadir prenda con cámara** | Marco redondeado punteado; selector Prenda / Calzado / Accesorio; galería, obturador |
| **Prenda reconocida** | Vista en arco con etiqueta «Detectado automáticamente»; categoría, color, patrón y ocasión editables; «Guardar en mi armario» |
| **Detalle de prenda** | Arco grande; etiquetas; «Combina con» (tres piezas); editar y eliminar (en `--err`); «Crear un look con esta prenda» |
| **Filtrar armario** | Hoja inferior con Tipo, Color (seis muestras) y Ocasión sobre el armario atenuado; «Limpiar» y «Ver prendas» |

### 24.6 Recomendaciones y looks

| Pantalla | Cómo se ve |
| --- | --- |
| **Recomendaciones** | Pestañas Colores, Prendas, Cortes y Accesorios; tarjetas con muestra en arco, razón breve, «¿Por qué?» y tres botones de valoración (me gusta, neutral, no me gusta) |
| **Motivo** | Hoja inferior «¿Por qué oliva profundo?» con cuatro motivos y «Entendido» |
| **Looks por ocasión y clima** | Chips de ocasión; etiqueta «Nublado · 14 °C»; interruptor «Usar solo mi armario»; tarjeta con tres prendas en mosaico; «Otro look» y «Comparar» |
| **Comparar looks** | Looks A, B y C con etiqueta «Muy compatible» o «Compatible»; texto de recomendación; «Guardar el look B» |
| **Guardar y valorar** | «¿Qué te *parece*?» con Me gusta, Neutral y No me gusta; «Guardar en mis looks» |
| **Evaluar prenda en tienda** | Cámara con hoja inferior: semáforo (verde, ámbar, rojo) con «Va *contigo*», etiqueta «Verde · compatible» y tres razones |

### 24.7 Simulación y probador

| Pantalla | Cómo se ve |
| --- | --- |
| **Simulador de cabello** | Comparación Antes / Después, corte (Corto, Medio, Largo) y color; nota «Simulación visual aproximada» |
| **Maquillaje y uñas** | Dos pestañas; Labios, Rubor y Uñas (Liso, Francesa, Brillo) con muestras |
| **Gafas** | Modelo «Redondas» con «Suavizan un rostro ovalado» y chips de armonía |
| **Avatar y probador** | Avatar para girar con Top, Abajo, Calzado y Accesorios del armario |

Estas cuatro pantallas amplían el alcance del producto. Según la sección 16 no deben incorporarse antes de consolidar las fases anteriores. «Probador» queda reservado para esta experiencia (sección 7) y necesitará ruta y nombre propios, fuera de la barra principal.

### 24.8 Historial, retos y privacidad

| Pantalla | Cómo se ve |
| --- | --- |
| **Historial** | Filtros Todo, Diagnósticos, Looks y Consultas; grupos «Hoy» y «Esta semana» con eventos y sus resultados |
| **Tarjeta para compartir** | Tarjeta de 250 × 326 con estación, cinco muestras y marca; interruptor «Incluir mi foto» (apagado por defecto); «Compartir» y «Guardar imagen». Apariencia fija |
| **Retos semanales** | Reto de la semana con progreso (4 de 5); «Subir mi look de hoy»; próximos retos marcados «Pronto» |
| **Mis datos** | Interruptor de autorización; «Lo que guardamos» (fotos, análisis, armario, con «Consultar»); «Descargar mis datos»; «Zona delicada» |
| **Confirmar eliminación** | Diálogo centrado «¿Borrar tus *fotos*?», qué se elimina y qué se conserva, casilla «Entiendo que no se puede deshacer.», Cancelar y «Sí, borrar» en `--err` |

### 24.9 Administración web (1280 × 800)

Barra lateral de 250 con marca y cuatro destinos (Panel, Cuentas, Modelos de IA, Incidencias y recursos). Contenido con título «Panel de *administración*», cuatro tarjetas de cifras, gráfico de uso de siete días y lista de servicios de análisis con etiqueta de estado. Las cifras son de ejemplo. Responde al tema como las pantallas móviles.

## 25. Cómo se ve cada superficie en claro y oscuro

| Superficie | Claro | Oscuro |
| --- | --- | --- |
| Fondo | Durazno a rosa, con halos rosa y ocre | Tinta a ciruela oscura, con los mismos halos |
| Tarjeta | Blanco al 68 % con borde blanco | Blanco al 10 % con borde blanco al 16 % |
| Botón primario | Tinta con texto blanco | Rosa con texto tinta |
| Botón secundario | Borde y texto tinta | Borde y texto blancos |
| Chip activo | Tinta con texto blanco | Rosa con texto tinta |
| Palabra en cursiva | Vino | Rosa claro |
| Hoja inferior | `#FFF6F0` | `#2E2831` |
| Barra de pestañas | Blanco casi opaco | `#342D39` |
| Burbuja de pestaña | Tinta con icono blanco | Rosa con icono tinta |
| Campo | Fondo de tarjeta, borde tinta tenue | Fondo de tarjeta, borde blanco tenue |
| Cámara | Siempre oscura | Siempre oscura |
| Tarjeta de resultado y compartir | Igual en ambos temas | Igual en ambos temas |

Pantallas sin ajuste de tema: captura de rostro, de cuerpo, añadir prenda y evaluar prenda (cámara), la tarjeta de resultado en cualquier pantalla y la tarjeta para compartir. El resto responde al tema. La política inicial de la sección 3 (el desajuste entre `app.json` y `ThemeContext`) sigue pendiente.

## 26. Patrones nuevos que reemplazan a los anteriores

- **Cabecera de pantalla:** botón circular de retorno, título en Fraunces con una palabra en cursiva y, a la derecha, una acción de icono (compartir, editar, repetir). Sustituye al `PageHeader` actual donde no coincida.
- **Hoja inferior** para decisiones breves (filtros, motivo de una recomendación, resultado de la tienda). Sustituye a los modales a pantalla completa en esos casos.
- **Diálogo centrado** solo para confirmar una acción destructiva.
- **Lista de ajustes** en tarjeta única con filas separadas por línea tenue, icono en círculo y, cuando hay peligro, texto y círculo en `--err`.
- **Barra de progreso** de 8 con relleno rosa a ocre, usada en confianza del rostro y Style DNA.
- **Pasos de proceso:** hecho (✓ en `--ok`), en curso (rueda) y pendiente (círculo punteado), siempre con texto.
- **Aviso de alcance:** cada resultado lleva una frase corta que lo presenta como orientativo, como pide la sección 8.

## 27. Estados vacíos y primera visita

| Flujo | Qué muestra el rediseño | Qué falta |
| --- | --- | --- |
| Inicio | Composición propia para primera visita con una acción dominante | Estado de carga |
| Armario | Estado vacío con acción «Añadir prenda» | Carga, error con reintento y «sin resultados de búsqueda» distinto del armario vacío |
| Mi análisis | Se muestra con resultados; sin ellos el prototipo solo cambia el Inicio | Diseñar el estado sin análisis dentro de la pestaña |
| Asistente | Conversación, sugerencias, escritura | Error con «Reintentar» y mensaje conservado |
| Captura | Avisos de luz, distancia y encuadre; pantalla «Revisa tu foto» | Permiso de cámara denegado o pendiente |
| Datos | Consentimiento, descarga y borrado con confirmación | Progreso y error de la exportación |

La segunda versión del lienzo reescribió el vacío del Armario para el caso de una categoría sin prendas («Aún no hay prendas aquí»). Sigue sin existir la pantalla del armario completamente vacío ni la de búsqueda sin coincidencias, que la sección 15 pide como estados distintos. Ambas deben diseñarse con el mismo lenguaje antes de implementar.

## 28. Puntos a corregir antes de implementar

1. **Nombre de marca.** Resuelto en la segunda versión: Silueta dice «Perfil de silueta». Vigilar que ninguna pantalla vuelva a mostrar AURA (sección 2 y regla de AGENTS.md).
2. **Datos de ejemplo.** Procesando salta a «Continuar al resultado» sin un análisis real, el resumen muestra 78 fijo, rostro dice que sus valores son de ejemplo y el panel de administración tiene cifras inventadas. Nada de esto puede llegar a producción como dato real (prioridad P0, sección 11).
3. **Promesa de privacidad.** La segunda versión suavizó los textos: Consentimiento dice «Priorizamos procesar tu análisis en tu dispositivo» y Analizando dice «Analizamos tu imagen con tu permiso, cuidando tu privacidad.» Comprobar que coinciden con lo que hace la app; si la foto sale del dispositivo, el texto debe decirlo.
4. **Destinos de bienvenida.** Resuelto: «Comenzar» abre Registro y «Ya tengo una cuenta» abre Acceso, como pide la sección 14.
5. **Controles.** En el prototipo, chips de estilo, ocasión y pestañas de recomendaciones son `span` y no se pueden enfocar. En React Native deben ser `Pressable` con `accessibilityRole` y `accessibilityState`, y la casilla de datos del registro debe seguir sin marcar de inicio.
6. **Error en claro.** Resuelto: `--err` pasó a `#9E3B25` (sección 20). Aplicar el mismo valor en todos los tokens de error (sección 30).
7. **Tamaño del texto.** Las etiquetas de pestaña de 11 y varios textos de 12 deben probarse con texto ampliado sin recortes.
8. **Administración web.** Es una superficie distinta de la app. La regla de cinco destinos de AGENTS.md aplica a la app de la usuaria. Decidir si el panel vive en este repositorio o en otro antes de construirlo.
9. **Alcance.** Cabello, maquillaje, gafas, avatar, retos e historial son funciones nuevas. Documentarlas como propuesta separada (sección 17). El lienzo ya las marca como «propuesta fuera de este ciclo».

## 29. Orden de adopción propuesto

| Entrega | Contenido | Dependencia |
| --- | --- | --- |
| A | Fuentes Fraunces y Nunito registradas; tokens de la sección 20 en `shared/theme` | Ninguna |
| B | Componentes base: botón, tarjeta, chip, campo, interruptor, etiqueta, hoja, diálogo | A |
| C | Barra de pestañas con burbuja, primero sin onda; después recorte circular y onda | B |
| D | Bienvenida, acceso, registro y bienvenida guiada | B |
| E | Inicio, Armario, Mi análisis, Asistente y Perfil, con todos sus estados | C, D |
| F | Captura, consentimiento, análisis y resultados | E |
| G | Armario avanzado, recomendaciones y looks | F |
| H | Historial, tarjeta para compartir, retos y datos | F |
| Fuera de este ciclo | Simulación, probador y administración | Decisión de producto |

Cada entrega se valida en ambos temas, con movimiento reducido y con texto ampliado antes de pasar a la siguiente. Como en la sección 18, la validación en dispositivos y con lectores de pantalla sigue pendiente.

## 30. Tokens que hay que cambiar para aplicar el rediseño

Esta sección compara los tokens de `src/shared/theme/tokens/` con las variables de `bell.css`. Sirve como lista de trabajo: cada fila indica qué clave tocar y con qué valor. No se modificó ningún archivo de código. Los valores «actual» se leyeron de `colors.ts`, `glass.ts`, `typography.ts`, `shapes.ts`, `spacing.ts`, `shadows.ts` y `motion.ts`.

**Reglas para quien aplique los tokens.**

1. Las pantallas consumen colores semánticos de `useTheme()`, nunca `colors` estático ni hex sueltos (sección 3).
2. El rosa `#E8899F` sigue siendo relleno y marca (interruptor activo, barras, botón primario en oscuro). Como color de texto, foco o enlace se usa el token de acento de texto de la tabla 30.1.
3. Un mismo valor vive en varias claves de `ThemeColors` (`text.danger`, `border.error`, `status.error`, `danger[500]`, `penpot.state.danger`). Al cambiarlo hay que cambiar todas.
4. Después de cambiar un token, buscar en `src/` los usos de su valor anterior en hex para no dejar restos.

### 30.1 Colores: valores a cambiar

| Clave en `ThemeColors` | Claro: actual → nuevo | Oscuro: actual → nuevo | Variable del lienzo |
| --- | --- | --- | --- |
| `text.secondary` (y `ink[600]`) | `#746668` → `#5F5254` | `#D6C5B0` (igual) | `--ink2` |
| `text.accent` | `#E8899F` → `#8F3A52` | `#E8899F` → `#F4A6B8` | `--acc` |
| `border.focus` | `#E8899F` → `#8F3A52` | `#E8899F` → `#F4A6B8` | `--acc` |
| `text.danger`, `border.error`, `status.error`, `danger[500]`, `state.danger` | `#B5482E` → `#9E3B25` | `#FF9B85` → `#FF9F8A` | `--err` |
| `state.success`, `status.success` | `#2F5E4A` → `#4F6B2E` | `#C9EAD9` → `#B7D68A` | `--ok` |
| `surface.card`, `background.surface` | `rgba(255,255,255,.55)` → `.68` | `.10` (igual) | `--card` |
| `surface.input`, `background.surfaceElevated` | `.75` → `.68` | `.14` → `.10` | `--card` (los campos usan el mismo fondo que la tarjeta) |
| `border.glass` | `rgba(255,255,255,.6)` → `.9` | `.15` → `.16` | `--line` |
| `border.medium` (borde de campo) | `rgba(36,31,38,.16)` → `.20` | `rgba(255,255,255,.22)` → `.26` | `--line2` |
| `surface.modal` (hoja y diálogo) | `rgba(255,255,255,.95)` → `#FFF6F0` | `#2E2831` (igual) | `--sheet` |
| `surface.overlay`, `background.overlay` | `rgba(36,31,38,.45)` → `.50` | `rgba(10,8,12,.85)` → `rgba(0,0,0,.60)` | `--scrim` |
| `surface.camera` | `#1E1B22` → `#241F26` | `#141217` → `#241F26` | Fondo de cámara |
| `state.successBg` | `rgba(122,132,80,.15)` → `.28` | `.25` → `.28` | `.tag.ok` |
| `state.warningBg` | `rgba(217,164,65,.18)` → `.34` | igual que claro | `.tag.warn` |
| `state.dangerBg` | `rgba(181,72,46,.12)` → `.20` | `.25` → `.20` | `.tag.bad` |

Sin cambio de valor: `text.primary`, `text.inverse`, `brand.primary`, `background.gradient`, `background.primary` y los de oscuro de `ink[900]`. Con ellos el botón primario ya es tinta con texto blanco en claro y rosa con texto tinta en oscuro (`--btn`, `--btnt`).

`text.muted` (`#A5A2A8`, 2,52:1 sobre blanco) queda solo para elementos deshabilitados. El texto que la persona necesita leer usa `text.secondary`.

### 30.2 Colores: tokens nuevos

| Token propuesto | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `brand.accentSoft` | `rgba(232,137,159,.28)` | `rgba(232,137,159,.22)` | Fondo de iconos en lista, pasos, etiquetas, pista de barra |
| `text.warning` | `#8A5A00` | `#F0C36A` | Texto de advertencia. `state.warning` (`#D9A441`) sigue como relleno |
| `text.onDanger` | `#FFFFFF` | `#241F26` | Texto del botón destructivo |
| `surface.tabBar` | `rgba(255,255,255,.90)` | `rgba(52,45,57,.94)` | Barra de pestañas |
| `tabBar.bubble` | `['#3C3042','#241F26']` (145°) | `['#F4A6B8','#E8899F']` (145°) | Burbuja activa |
| `tabBar.bubbleIcon` | `#FFFFFF` | `#241F26` | Icono sobre la burbuja |
| `tabBar.ripple` / `tabBar.burst` | `#E8899F` / `rgba(232,137,159,.40)` | Igual | Anillo y onda |
| `switch.trackOff` / `switch.trackOn` | `rgba(95,82,84,.40)` / `#E8899F` | Igual | Interruptor; perilla `#FFFFFF` |
| `gradients.hero` | `['#F7B9C6','#E8899F','#E5A06F']` (150°) | Igual | Tarjeta de resultado; texto fijo `#241F26` |
| `gradients.barFill` | `['#E8899F','#D9A441']` | Igual | Barras de confianza y Style DNA |
| `gradients.camera` | radial `['#4A3A4E','#241F26']` | Igual | Fondo de las pantallas de captura |
| `background.halos` | `['rgba(232,137,159,.42)','rgba(217,164,65,.28)']` | Igual | Dos halos decorativos del fondo |
| `camera.ink2` / `camera.card` / `camera.line` | `#E6D9CC` / `rgba(255,255,255,.14)` / `rgba(255,255,255,.22)` | Igual | Texto y superficies sobre la cámara |
| `camera.guide` / `camera.scan` | `#F4A6B8` / `#E8899F` | Igual | Trazo punteado de la guía y línea que barre |
| `selection.ring` | Anillo interno `border.bg1` de 3 y externo `text.primary` de 2 | Igual | Muestra de color seleccionada |

### 30.3 Paleta de diagnóstico: valores que difieren

| Clave en `palette` | Actual | Nuevo | Nota |
| --- | --- | --- | --- |
| `terracotta` | `#A8604B` | `#B5593B` | |
| `cream` | `#F2E8DC` | `#F3E3C8` | |
| `forestGreen` | `#2D5A3F` | `#3F5B3A` | Llamada «Bosque» |
| `avoidSilver` | `#A8B2C1` | `#B8C4CF` | Llamada «Gris frío» |
| `coffee` | `#8B5E3C` | `#8E5B4A` | Llamada «Chocolate» en prendas |

Entradas nuevas: `camel #C19A6B`, `plum #7A3B52`, `beige #D8C3A5`, `ivory #FAF4EA`, `darkChocolate #5C3D2E`, `petrol #3E5C6B`. Rampa de tono de piel: `#F6E0D2`, `#E9C4A5`, `#CFA07A`, `#A8744F`, `#7A4B33`, `#4B2C20`. Sin cambio: cobre `#C97B4A`, oliva `#7A8450`, ocre `#D9A441`, rosa `#E8899F`. El lienzo trata estas muestras como ejemplos de contenido; los nombres y la lista final dependen de lo que devuelva el análisis.

### 30.4 Tipografía

| Clave | Actual | Nuevo |
| --- | --- | --- |
| `fontFamily` | Nunito en iOS y Android, System en el resto | Nunito en todas las plataformas, cargada con `expo-font` |
| `fontFamilyDisplay` (nueva) | No existe | Fraunces 500, 600 y 500 cursiva |
| `display` | 46 / 51, peso 800, −1 | Fraunces 46 / 47, peso 500, −0,92 |
| `h1` | 34 / 39, peso 800, −0,8 | Fraunces 32 / 34, peso 500, −0,64 |
| `h2` | 25 / 30, peso 800 | Fraunces 24 / 25, peso 500, −0,48 |
| `h3` | 20 / 25, peso 800 | Fraunces 19 / 20, peso 600, −0,38 |
| `titleBar` (nuevo) | No existe | Fraunces 26 / 28, peso 500: título junto al botón de retorno |
| `stat` (nuevo) | No existe | Fraunces 36 a 44, peso 500: puntuación, estación, cifras |
| `body` / `lead` | 14 / 21, peso 400 | 14,5 / 22, peso 400 a 600, color `text.secondary` |
| `small` | 13 / 19, peso 400 | 13 / 18, peso 600 |
| `hint` (nuevo) | No existe | 12,5 / 17, peso 600 |
| `tag` (nuevo) | No existe | 12,5, peso 800 |
| `label` | 12 / 16, peso 600 | 13, peso 800 para etiqueta de campo |
| `eyebrow` (nuevo) | No existe | 12, peso 800, mayúsculas, espaciado 1,44 |
| `caption` | 11 / 16, peso 400 | 12, peso 700 para pie de muestra |
| `button` | 15 / 18, peso 700 | 15, peso 800 (16 en el botón de bienvenida) |
| `navLabel` (nuevo) | No existe | 11, peso 700; 800 en la activa |
| Énfasis en título | No existe | Fraunces cursiva con `text.accent`, una palabra por título |

Los nombres exactos de familia que React Native exige para cada peso dependen del paquete de fuentes que se instale; consultar la documentación de Expo de la versión del proyecto antes de fijarlos (AGENTS.md).

### 30.5 Forma

| Clave | Actual | Nuevo |
| --- | --- | --- |
| `componentShapes.card.md` (tarjeta por defecto) | 20 | 24 |
| `componentShapes.card.hero` (nueva) | No existe | 32 |
| `componentShapes.sheet` (nueva) | No existe | 32 en las esquinas superiores |
| `componentShapes.dialog` (nueva) | No existe | 28 (`radius.xxxl`) |
| `componentShapes.input.md` | 14 | 18 |
| `componentShapes.chip` | Píldora | Píldora de 44 de alto (radio 22) |
| `componentShapes.arch` (nueva) | No existe | Superior 999, inferior 18; 28 en bienvenida, 14 en pastillas pequeñas |
| `componentShapes.tabBar` (nueva) | No existe | 30; burbuja circular de 58 |
| `componentShapes.checkbox` (nueva) | No existe | 8 en 26 × 26 |
| `componentShapes.brandMark` (nueva) | No existe | 14 en 40 × 40 |
| `radius` | Sin 18, 30 ni 32 | Añadir `18`, `30`, `32` |

Sin cambio: botón grande 20, botón compacto 16, interruptor y avatar en píldora, anchos de borde (1, 1,5, 3 de foco).

### 30.6 Tamaños y espaciado (`componentSizes`)

| Clave | Actual | Nuevo |
| --- | --- | --- |
| `input` | 50 | 52 |
| `chip` | 36 | 44 |
| `buttonSmall` | 48 | 44 |
| `button` | 52 | 52 (nueva `buttonHero` de 56 para la bienvenida) |
| `bottomBar` | 53 más inferior seguro | 68 de alto, 12 de margen lateral, 14 de margen inferior |
| `fab` | 60 | Sustituir por `tabBubble` de 58 |
| `icon` | 24 | 22 (nuevos `iconSm` 18 e `iconLg` 28), trazo 2 |
| `touchMin` (nueva) | No existe | 44 |
| `listRow` (nueva) | No existe | 62 de alto mínimo |
| `switch` (nueva) | No existe | 52 × 30, perilla 24 |
| `screenMargin` | 20 | 20 (la bienvenida usa 24) |
| Margen superior de cabecera y inferior de pie | No existe | El prototipo usa 56 y 30; en la app sustituir por áreas seguras |
| Margen inferior del contenido con barra | No existe | 130 para no quedar bajo la barra |

La escala `spacing` (2 a 48) cubre los espacios del lienzo y no cambia.

### 30.7 Vidrio y sombras

| Clave | Actual | Nuevo |
| --- | --- | --- |
| `glass.surface` (claro) | `.55` | `.68` |
| `glass.surfaceElevated` (claro) | `.75` | `.68` |
| `glass.border` (claro / oscuro) | `rgba(36,31,38,.08)` / `rgba(255,255,255,.10)` | `rgba(255,255,255,.9)` / `rgba(255,255,255,.16)` |
| `glass.borderActive` | `#E8899F` | `#8F3A52` claro, `#F4A6B8` oscuro |
| `glass.blurIntensity` | 18 claro, 25 oscuro | 14 en tarjetas y 18 en la barra, igual en ambos temas |
| `shadows.card` (nueva) | `md` o `lg` según pantalla | Desplazamiento vertical ≈ 10, radio ≈ 20, opacidad .16 claro y .45 oscuro, color tinta o negro |
| `shadows.button` (nueva) | No existe | Desplazamiento ≈ 8, radio ≈ 14, opacidad .16 y .45 |
| `shadows.sheet` (nueva) | `modal` | Hacia arriba (−12), radio ≈ 28 |
| `shadows.bubble` (nueva) | `glowPrimary` | Rosa `#E8899F`, desplazamiento ≈ 8, radio ≈ 16, opacidad alta |

El CSS del lienzo usa sombras con extensión negativa, que React Native no soporta. Los valores de la tabla son aproximaciones que hay que revisar en un dispositivo.

### 30.8 Movimiento (`durations`, `scales`, nuevos)

| Clave | Actual | Nuevo |
| --- | --- | --- |
| `durations` | 100, 150, 250, 400 | Añadir `rise` 750, `sheet` 700, `bubble` 800, `ripple` 900, `reveal` 950, `burst` 1000, `shine` 4000, `float` 6000 y `drift` 14000 |
| Retardo escalonado | No existe | Paso de 70 a 80 ms entre bloques de una pantalla |
| Curvas | No existen | Salida `(.2,.9,.2,1)`; rebote del icono y la burbuja `(.3,1.7,.5,1)` |
| `scales.pressedButton` | .96 | .96 |
| `scales.pressedIconButton` (nueva) | No existe | .92 |
| `scales.pressedTile` (nueva) | No existe | .97 |
| `scales.activeTab` | .95 | Retirar. La pestaña activa sube 27 y escala 1,12 |
| Movimiento reducido | Solo botones | Todos los efectos de esta sección se anulan con la preferencia del sistema |

### 30.9 Tokens que el rediseño no usa

Aparecen en el código actual y no en el lienzo: `brand.cyan`, `brand.neonGreen`, `brand.emerald`, `gradients.goldGlow`, `gradients.cyberGlow`, `border.gold`, `status.info`, `state.info`, `state.infoBg` y `palette.avoidCold` (`#4F6BED`, `#D94A8A`). No se deben eliminar sin buscar sus usos en `src/`. Hasta decidirlo, no se aplican a pantallas nuevas.

### 30.10 Decisiones de producto antes de tocar el tema

- **Tema inicial.** `app.json` fija `userInterfaceStyle` en `dark` y el proveedor arranca en claro (sección 3). El lienzo presenta ambos temas como equivalentes y no indica cuál es el inicial.
- **Fuentes.** Fraunces y Nunito se cargan en cada plataforma; falta decidir qué se muestra mientras cargan.
- **Barra de pestañas.** Si la onda y el recorte circular no rinden en gama baja, conservar solo burbuja y anillo (sección 23).

## 31. Estado de implementación del rediseño

Aplicadas las entregas A a E de la sección 29 que pertenecen a esta fase. Verificado: `npx tsc --noEmit` sin errores, `npx expo-doctor` con 20 de 20 comprobaciones, y `npx expo export --platform android` genera el paquete. `npx expo lint` conserva 2 errores que ya existían en `src/entities/media-vault/model/managedMediaService.ts` (módulos `expo-media-library/legacy` y `expo-sqlite` sin resolver). **No se probó en un teléfono, un emulador ni en web**, así que nada de lo visual está validado.

### Qué se aplicó

| Entrega | Contenido | Archivos principales |
| --- | --- | --- |
| A. Tokens, fuentes y tema | Colores, tipografía, formas, tamaños, vidrio, sombras y movimiento de la sección 30. Fuentes con `useFonts` y pantalla de inicio retenida hasta cargarlas. Tema inicial según el sistema | `src/shared/theme/tokens/*`, `fonts.ts`, `ThemeContext.tsx`, `src/app/_layout.tsx`, `app.json` |
| B. Componentes base | Botón, tarjeta de vidrio con desenfoque, chip con ✓, campo, etiquetas (`soft`, `danger`), contenedor de pantalla con halos, cabecera con retorno. Nuevos: `AccentTitle`, `Eyebrow`, `Switch`, `Checkbox`, `BottomSheet`, `Dialog`, `ListCard` y `ListRow`, `Arch`, `ColorSwatch`, `HeroCard` | `src/shared/ui/*` |
| C. Barra de pestañas | Barra flotante con burbuja con rebote y anillo, desenfoque, `accessibilityRole="tab"` y ocultación con el teclado | `src/components/FloatingTabBar.tsx`, `PrimaryTabs.tsx` |
| D. Acceso | Bienvenida con arcos y píldoras, acceso, registro y recuperación con el diseño nuevo. «Comenzar» abre el registro y «Ya tengo una cuenta» el acceso | `src/views/CU00` a `CU03`, `src/features/auth/ui/*` |
| E. Pestañas | Inicio (primera visita y con resultados), Armario, Mi análisis, Asistente y Perfil | `src/screens/*`, `src/views/CU04LogoutView.tsx`, `CU20WardrobeView.tsx`, `ChatAdvisorView.tsx` |

### Diferencias con el lienzo

- **Animación de la barra:** burbuja con rebote y anillo, onda rosa de 2200 que crece desde el botón (`Burst` en `FloatingTabBar.tsx`) y apertura de la pantalla nueva como un círculo que crece desde ese botón (`TabScene.tsx`, que cada ruta de pestaña envuelve). La posición de los botones la publica la barra en `tabTransition.ts`. Con movimiento reducido no hay onda ni círculo. La técnica del círculo es un contenedor redondo con `overflow: hidden` y la pantalla desplazada en sentido contrario; no se midió su fluidez en gama baja.
- **Desenfoque en Android:** `expo-blur` sin `BlurTargetView` solo añade una capa semitransparente en Android. Por eso las tarjetas y la barra usan el desenfoque real en iOS y web, y en Android solo la superficie translúcida. Habilitarlo requiere envolver el contenido en `BlurTargetView`.
- **Halos del fondo:** usan el filtro `blur` de React Native y se omiten en Android anteriores a la API 31.
- **Sombras:** aproximaciones de las sombras CSS, que React Native no puede reproducir con extensión negativa.
- **Tema:** el botón de tema salió de la cabecera de Inicio. Se cambia en Perfil con el interruptor «Apariencia oscura».
- **Recordatorios:** no se incluyó el interruptor del lienzo porque la app no tiene recordatorios.
- **Mi análisis:** conserva las pestañas Resumen, Mi paleta, Rostro y Silueta que ya existían. El resumen toma la composición del lienzo.
- **Brillo de botones y recorte de la bienvenida:** el brillo animado no se aplicó.
- **Enlaces web de la barra:** la barra personalizada navega con `navigateToTab` y ya no genera enlaces `<a>` por pestaña en web.
- **Fuentes del sistema:** el texto que declara `fontWeight` sin familia (unas 190 apariciones en pantallas no rediseñadas) sigue en la fuente del sistema hasta que cada pantalla use los presets de `typography`.

### Pendiente y riesgos conocidos

- **Modo oscuro en modales:** resuelto en `CU07`, `CU11`, `CU21`, `OnboardingModal`, `GuidedCameraModal`, `ShareButton` y `FaceGeometryVisualizer`, que ahora leen el tema activo (`CU18` y `CU19` ya lo hacían). El encabezado del onboarding pasó de un degradado oscuro fijo al degradado del tema, y la cámara guiada usa los colores de cámara (`colors.camera`), siempre oscuros. Siguen con el `colors` estático `ViralCard` (apariencia fija a propósito), los widgets de diagnóstico y las vistas CU huérfanas.
- **Vistas CU huérfanas** (`CU05`, `CU06`, `CU08` a `CU10`, `CU12` a `CU17`): sin cambios.
- **Recuperar contraseña:** `CU03` muestra «Enlace enviado» sin hacer una solicitud real. La lógica no se modificó; sigue pendiente conectarla (prioridad P0, sección 11).
- **Validación visual:** Android e iOS, ambos temas, texto ampliado, teclado abierto en acceso y asistente, movimiento reducido, áreas seguras y fluidez de la burbuja en un teléfono de gama baja.
- **Contraste con la barra:** comprobar en dispositivo que el texto de las pestañas sigue legible sobre el desenfoque.

### Ajuste a la pantalla

Las medidas del lienzo son para 390 de ancho. Para que la interfaz no se vea grande en pantallas pequeñas ni se estire en las anchas:

- `src/shared/theme/tokens/responsive.ts` calcula un factor de escala (`widthScale`, entre 0,82 y 1) a partir del ancho de la ventana y expone `ms()` para escalar tamaños de títulos, cifras e ilustraciones. Los presets `display`, `h1`, `titleBar`, `h2`, `h3` y `stat` de `typography.ts` ya salen escalados; el texto de lectura pequeño no se escala, para respetar la accesibilidad.
- La columna de contenido y la barra de pestañas tienen un ancho máximo de 520 (`CONTENT_MAX_WIDTH`), centradas. Antes eran 760 en las pantallas y la barra ocupaba todo el ancho.
- La ilustración de la bienvenida se ajusta al ancho y también al alto del teléfono.
- El factor se calcula al cargar la app. No reacciona a un cambio de tamaño de ventana en web ni al giro, porque la app está fijada en vertical.

## 32. Pantallas secundarias del Perfil de Proyecto (noviembre 2026)

Las cinco pestañas no cambian. Las funciones nuevas del PDF se abren como rutas ocultas de la barra
(`href: null` en `PrimaryTabs`) desde **Inicio** («Para hoy» y «Explora») y desde **Perfil**.

| Ruta | Pantalla | Historias | Se abre desde |
|---|---|---|---|
| `/style` | `StyleScreen`: Style DNA (radar de 7 dimensiones) y recomendaciones con «¿Por qué?» y valoración | HU-007, 008, 012–014, 018, 039 | Inicio · Explora, Perfil |
| `/outfits` | `OutfitsScreen`: generar por ocasión y clima, comparar, guardar y valorar | HU-015–018, 038 | Inicio · Para hoy |
| `/compatibility` | `CompatibilityScreen`: semáforo «¿Me lo compro?» | HU-024, 025, 027 | Inicio · Para hoy |
| `/simulator` | `SimulatorScreen`: cabello, maquillaje, uñas y gafas sobre la foto | HU-019–021 | Inicio · Explora |
| `/avatar` | `AvatarScreen`: maniquí 3D con las proporciones medidas y un outfit guardado | HU-022, 023 | Inicio · Explora, Outfits |
| `/history` | `HistoryScreen`: análisis, outfits, simulaciones, valoraciones y chats | HU-028 | Perfil |
| `/report` | `ReportScreen`: reportar un problema y ver la respuesta | HU-031 | Perfil |

Reglas que siguen estas pantallas:
- Tokens de `@/shared/theme` y componentes de `@/shared/ui`; estados de carga, vacío y error con «Reintentar».
- Los errores llegan ya traducidos por `friendlyMessage` (`@/shared/api/http`): nunca códigos HTTP ni UUID.
- El semáforo combina color **y** texto («Compatible», «Con matices», «Poco compatible»).
- Las fotos se suben con `uploadMultipart` (token desde `secureToken`); el servidor las borra tras el análisis
  salvo que la usuaria active «Conservar mis fotos» en Privacidad (consentimiento `photo_retention`).
- Las tareas pesadas (diagnóstico, simulación) se siguen con `useTask` / `waitForTask` (HU-041).
- «Mi análisis» lee el diagnóstico del servidor (`/api/diagnosis/latest`) y solo usa el análisis local sin conexión.

## 33. Propuesta P1 «Coral amanecer»: Acceso, bienvenida guiada e Inicio (noviembre 2026)

Propuesta elegida en Penpot (página «Flujo 01 · Propuestas (rediseño)», fila P1). **Reemplaza la paleta de las secciones 19 a 30 en toda la app:** `src/shared/theme/tokens/colors.ts` (temas claro y oscuro) usa ahora los valores P1, así que todas las pantallas la heredan. Las pantallas de este flujo además siguen la estructura nueva; las demás conservan su estructura hasta que se rediseñe su flujo.

- **Tokens:** `src/shared/theme/tokens/coral.ts`, en variante clara y oscura.
  - Fondo crema `#FFF7F1` → `#FFE8E0`.
  - Gradiente del héroe `#FF6F61` → `#FF9B7B` → `#FFD5A1`, siempre con texto en tinta `#2A1714`.
  - Acento de texto `#B3392E`.
- **Componentes:** `src/shared/ui/coral`. Incluye pantalla, título, botón, enlace, botón de volver, tarjeta, héroe, chip, caja de icono, estilos de campo y la mascota.
- **Mascota:** las poses están en `assets/images/mascota/`. Es decorativa y los lectores de pantalla la ignoran.
- **Pantallas:**
  - Bienvenida (CU00) y recuperar contraseña (CU03).
  - Estructura de acceso, compartida por inicio de sesión (CU02) y registro (CU01).
  - Bienvenida guiada (`OnboardingModal`), ahora a pantalla completa.
  - Inicio (`HomeScreen`), con dos estados: primera visita y con resultados.
- **Contraste medido (WCAG 2.1) sobre el fondo:**
  - Tinta 14,5:1.
  - Texto secundario 6,8:1.
  - Acento 5,1:1.
  - Texto del botón 17,1:1.
  - Texto de ejemplo en los campos 4,6:1.
  - Tinta sobre el coral más intenso 6,3:1.
- **Cambios de comportamiento:**
  - La bienvenida guiada permite «Omitir por ahora»: guarda el perfil sin preferencias.
  - Inicio muestra el avance del perfil (preferencias, foto y paleta).
  - En la primera visita, «Mi análisis» aparece bloqueado e indica que se activa con la foto.
- **Movimiento** (respeta «reducir movimiento» del sistema):
  - La mascota entra con rebote o desde abajo y flota en bucle.
  - Los bloques de cada pantalla entran escalonados (`Appear`).
  - Los botones y accesos se encogen al presionarlos.
  - La barra de pestañas conserva su burbuja y su onda, ahora en coral.
- **Pendiente:**
  - La recuperación de contraseña (CU03) tiene el estilo P1, pero el backend no tiene todavía un endpoint para enviar el enlace.

### 33.1 Sistema P1 en Penpot y decisiones (noviembre 2026)

La referencia visual de componentes y estados es la página **«Sistema P1»** de Penpot (secciones 01 a 13).

**Decisiones tomadas:**
- **Enlaces y error.** Los enlaces van en tinta, subrayados. El rojo `#B42318` se usa solo para errores, siempre con icono. La cursiva ladrillo `#B3392E` queda únicamente en la palabra clave de los títulos.
- **Barra de pestañas.** Se mantiene la burbuja animada, en versión discreta:
  - Burbuja de 48 px que sobresale 12 px, sin rebote.
  - Onda de 1,4× que dura 450 ms.
  - Iconos y etiquetas en tinta, con trazo 3.
- **Modo oscuro.** Por ahora la app es solo clara: `DARK_MODE_ENABLED = false` en `ThemeContext` y el interruptor de Perfil queda oculto. El tema oscuro se conserva. Regla para cuando se reactive: sobre el héroe, el botón es siempre de tinta.

**Paso 0 aplicado en los componentes compartidos:**
- **Botones.** Cuatro tipos:
  - Principal (tinta).
  - Secundario: contorno de tinta sobre blanco (`ButtonSecondary` y `ButtonOutline`).
  - Terciario: enlace subrayado (`ButtonGhost`).
  - Peligro: `#B42318`.
  
  `ButtonGold` ahora se muestra como el principal. Todos son píldoras de 44, 50 o 54 px de alto, y al deshabilitarse quedan al 38 % de opacidad.
- **Tarjetas.** La variante `glass` pasa a ser blanca y sólida, con sombra cálida.
- **Campos.** 54 px de alto, foco con borde de tinta y anillo coral, y mensaje de error con icono.
- **Estados de pantalla.** `ContentState` muestra la mascota según el estado: `kind` puede ser `thinking`, `empty` o `error`, y si no se indica se deduce del título.
- **Diálogos.** `Dialog` va centrado y acepta una mascota.
- **Avisos.** Nuevo `NoticeProvider` / `useNotice()` para el aviso breve y `Banner` para problemas dentro de la pantalla. Reemplazan a `Alert.alert` a medida que se rediseña cada flujo.
- **Tipografía.** Tamaño mínimo de 11 px (etiquetas de pestaña y notas). Los títulos fijos de 26 px o más se escalan con `ms()` para caber en teléfonos de 320 px.
- **Mascota.** 15 poses en `assets/images/mascota/`.

### 33.2 Pantalla «Reto» (fuera de alcance, noviembre 2026)

`src/app/challenge.tsx` → `ChallengeScreen` (meta de 4 semanas con tareas) no tiene punto de entrada ni historia de usuario en `docs/CasosDeUsos/README.md`. No se rediseña por ahora y la ruta sigue oculta. Queda pendiente de decisión del equipo:
- **Si corresponde a una historia de usuario:** se diseña como flujo propio, con un punto de entrada claro (por ejemplo, una tarjeta en Inicio cuando ya hay resultados).
- **Si no corresponde:** se eliminan la pantalla y su ruta.
