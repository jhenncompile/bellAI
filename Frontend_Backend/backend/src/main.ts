import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import * as path from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { verifyMediaSignature } from './common/media/signed-url';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // rawBody: el webhook de pagos verifica la firma de Stripe sobre el cuerpo original
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // 1. Cabeceras de seguridad con Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // HU-034 (CP-034-02): detrás de un balanceador con TLS, redirigir HTTP -> HTTPS
  if (process.env.FORCE_HTTPS === 'true') {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.headers['x-forwarded-proto'] === 'http') return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
      next();
    });
  }

  // 2. Servir carpeta de uploads estáticos para avatares
  // HU-034: las fotos personales (private/...) nunca se sirven de forma pública
  const uploadDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads/private', (_req: express.Request, res: express.Response) => {
    res.status(404).json({ message: 'Recurso no encontrado' });
  });
  // HU-034 (CP-034-03): las fotos del armario exigen URL firmada por el backend
  app.use('/uploads/wardrobe', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!verifyMediaSignature(`/uploads/wardrobe${req.path}`, req.query.exp, req.query.sig)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    next();
  });
  app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny' }));

  // 3. CORS restringido por lista blanca y variables de entorno (TEC-06 / RNF-01)
  const corsOriginEnv = process.env.CORS_ORIGIN;
  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost',
    'http://localhost:80',
  ];
  const allowedOrigins = corsOriginEnv
    ? corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : defaultOrigins;

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Permitir solicitudes sin origin (como apps móviles nativas, Postman o curl)
      if (!requestOrigin) {
        return callback(null, true);
      }
      if (
        allowedOrigins.includes(requestOrigin) ||
        (process.env.NODE_ENV !== 'production' &&
          (/^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(requestOrigin) ||
            requestOrigin.startsWith('exp://')))
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // 4. Pipe global de validación estricta con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // 5. Documentación OpenAPI (Swagger) en /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('BellAI API')
    .setDescription('API del asistente personal de imagen, moda y belleza BellAI')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = process.env.PORT || 8000;
  await app.listen(port, '0.0.0.0'); // Escuchar en 0.0.0.0 para que dispositivos Android en la red local puedan conectarse

  logger.log(`🚀 Servidor NestJS Bellia corriendo en http://localhost:${port}`);
  logger.log(`🛡️ Seguridad: Helmet, CORS, Throttler, AES-256 y GDPR activados`);
  logger.log(`📱 Acceso móvil: http://<tu-ip-local>:${port}/api`);
}

bootstrap();
