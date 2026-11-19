# Texto para actualizar el Perfil de Proyecto — Sección 3 (Herramientas tecnológicas)

El documento actual describe Flutter/Dart, FastAPI como backend principal y SQLAlchemy/Alembic. El
sistema construido usa otro stack. Este texto reemplaza las subsecciones 3.1, 3.2 y 3.3 y ajusta
los puntos 4.1.6.x y 4.1.8 que mencionan Flutter. Las subsecciones 3.4 a 3.7 (C4, Enterprise
Architect, VS Code, AWS, Jira, Git y GitHub) siguen siendo válidas.

---

## 3.1 Lenguajes de programación

**TypeScript (aplicación móvil, panel web y API).** TypeScript es un superconjunto de JavaScript
desarrollado por Microsoft que incorpora tipado estático. Permite detectar errores en tiempo de
desarrollo y compartir un mismo lenguaje entre la aplicación móvil, el panel administrativo y la API
principal, lo que reduce la curva de aprendizaje del equipo y facilita el mantenimiento. En este
proyecto se utiliza en modo estricto en los tres proyectos.

**Python (servicios de inteligencia artificial).** Python se utiliza exclusivamente para el servicio
de visión por computadora e inteligencia artificial, por su ecosistema de bibliotecas especializadas
(MediaPipe, OpenCV, PyTorch, NumPy). La API principal se comunica con este servicio mediante
contratos REST, de modo que los modelos pueden sustituirse sin afectar al resto del sistema (HU-043).

## 3.2 Frameworks y entornos de ejecución

**Frontend móvil**
- **React Native con Expo (SDK 58):** framework multiplataforma para Android e iOS con una sola base de código.
- **Expo Router:** navegación basada en archivos.
- **Axios y Fetch:** comunicación HTTP con la API; las fotografías se envían como `multipart/form-data`.
- **expo-camera, expo-image-picker, ML Kit:** captura guiada y detección facial en el dispositivo.
- **expo-secure-store:** almacenamiento cifrado del token de sesión (Keystore/Keychain).
- **expo-gl y three.js:** renderizado del avatar 3D.
- **expo-location:** ubicación aproximada para considerar el clima en los outfits.

**Panel administrativo web**
- **React 19 + Vite, TypeScript, Tailwind CSS, TanStack Query, Zod.**

**Backend (API principal)**
- **NestJS 10 (Node.js):** framework modular con inyección de dependencias, guardas de autenticación y validación de DTO.
- **TypeORM:** acceso a PostgreSQL y migraciones versionadas.
- **JWT y Passport:** autenticación con roles (usuaria, gestor, administrador).
- **BullMQ sobre Redis:** cola de tareas asíncronas para el análisis de imágenes y las simulaciones (HU-041).
- **Swagger (OpenAPI):** documentación interactiva de los endpoints en `/api/docs`.

**Servicios de inteligencia artificial**
- **FastAPI + Uvicorn:** servicio de IA independiente.
- **MediaPipe (Face Landmarker, Pose Landmarker, Hand Landmarker, segmentador multiclase):** puntos faciales, corporales y de manos, y segmentación de piel y cabello.
- **OpenCV y NumPy:** procesamiento de imagen, colorimetría en CIELAB y validación de calidad de fotos.
- **PyTorch + OpenCLIP (MobileCLIP2-S0):** clasificación zero-shot de prendas, estampados y estilos.
- **Ollama (modelo Qwen 2.5 de 3B parámetros):** modelo de lenguaje ejecutado localmente para el asistente, sin enviar datos a servicios externos.
- **Open-Meteo:** servicio externo de clima (sin clave; las coordenadas se redondean antes de enviarse).

**QA y soporte**
- **Jest** (API), **pytest** (servicio de IA), **ESLint** y **TypeScript** en los tres proyectos.
- **GitHub Actions:** integración continua de la API, el panel y el servicio de IA.
- **Docker y Docker Compose:** contenedores para PostgreSQL, Redis, IA, Ollama, API y panel.

## 3.3 Sistema gestor de base de datos

Se mantiene **PostgreSQL 17**. Las tablas del dominio de BellAI (diagnóstico, Style DNA,
retroalimentación, outfits, simulaciones, tareas, modelos de IA e incidencias) se definen en
`backend/schema.sql` y en migraciones de TypeORM. Se utilizan columnas JSONB para los resultados
detallados de los análisis y los vectores de estilo.

---

## Ajustes en otras secciones

- **4.1.6.1 / 4.1.6.3:** sustituir "Frontend Móvil (Flutter)… Riverpod… Dio" por "Frontend Móvil (React Native con Expo)… Expo Router… Axios".
- **4.1.6.1 / 4.1.6.3:** sustituir "Backend (Python / FastAPI)… Pydantic… SQLAlchemy… Alembic" por "API principal (NestJS)… DTO con class-validator… TypeORM y migraciones"; FastAPI queda como servicio de IA.
- **4.1.6.4 y 4.1.8 (Mantenibilidad):** sustituir "Flutter Test" por "Jest" y mantener pytest para el servicio de IA.
- **4.1.6.5:** la documentación interactiva de la API principal se genera con Swagger en NestJS (`/api/docs`); la del servicio de IA, con FastAPI (`/docs`).
- **4.1.8 (Usabilidad y Portabilidad):** sustituir "La aplicación móvil (Flutter)" por "La aplicación móvil (React Native con Expo)".
- **4.1.8 (Seguridad):** añadir que las fotografías se procesan y se eliminan al terminar el análisis, salvo que la usuaria autorice conservarlas.
