import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInitialData1700000000004 implements MigrationInterface {
  name = 'SeedInitialData1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const adminId = '11111111-1111-1111-1111-111111111111';

    // 1. Verificar si el usuario ya existe
    const existingUser = await queryRunner.manager
      .createQueryBuilder()
      .select('u.id')
      .from('users', 'u')
      .where('u.email = :email', { email: 'valeria@bellia.com' })
      .getRawOne();

    if (!existingUser) {
      // Inserción de usuario administrador
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('users')
        .values({
          id: adminId,
          name: 'Valeria Administradora',
          email: 'valeria@bellia.com',
          password: '$2b$10$QjOBbkasXIRQc63uMLtd0eri372yvi0oEe2f7lh9bxxLYCmwkbFb2', // Hash bcrypt para '123456789'
          role: 'admin',
          status: 'active',
        })
        .execute();

      // Perfil inicial
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('profiles')
        .values({
          userId: adminId,
          bio: 'Administradora principal del Sistema Bellia',
          phoneMasked: '+591 7***89',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        })
        .execute();

      // Preferencias iniciales
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('preferences', [
          'userId',
          'theme',
          'language',
          'emailNotifications',
          'pushNotifications',
          'marketingConsent',
          'trackingConsent',
        ])
        .values({
          userId: adminId,
          theme: 'system',
          language: 'es',
          emailNotifications: true,
          pushNotifications: true,
          marketingConsent: true,
          trackingConsent: true,
        })
        .updateEntity(false)
        .execute();

      // Consentimientos GDPR
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('gdpr_consents')
        .values([
          { userId: adminId, consentType: 'terms_of_service', accepted: true, policyVersion: 'v1.0' },
          { userId: adminId, consentType: 'privacy_policy', accepted: true, policyVersion: 'v1.0' },
          { userId: adminId, consentType: 'data_processing', accepted: true, policyVersion: 'v1.0' },
        ])
        .execute();

      // Activos multimedia iniciales supervisados (HU-033: 3D, Prenda, Modelo IA, Foto)
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('media_assets')
        .values([
          {
            id: '22222222-2222-2222-2222-222222222221',
            userId: adminId,
            title: 'Modelo 3D Casco Cyberpunk Sci-Fi (Probador Virtual)',
            originalFilename: 'cyberpunk_helmet.glb',
            s3Key: 'models-3d/demo_cyberpunk_helmet.glb',
            s3Bucket: 'bellia-media',
            s3Url: 'https://bellia-media.s3.us-east-1.amazonaws.com/models-3d/demo_cyberpunk_helmet.glb',
            cdnUrl: 'https://cdn.bellia.tech/models-3d/demo_cyberpunk_helmet.glb',
            mediaType: 'model_3d',
            systemFunction: 'probador_virtual_3d',
            isActive: true,
            usedByComponents: ['Módulo Probador Virtual 3D WebGL', 'Lienzo Three.js Móvil'],
            status: 'active',
            mimeType: 'model/gltf-binary',
            extension: '.glb',
            sizeBytes: 12845600,
            metadata: { format: 'glTF 2.0 Binary', readyForWebGL: true, supportsThreeJS: true, polygonCount: 48200 },
          },
          {
            id: '22222222-2222-2222-2222-222222222222',
            userId: adminId,
            title: 'Prenda Digital: Chaqueta Cuero Urbana Colección 2026',
            originalFilename: 'chaqueta_cuero_urbana.glb',
            s3Key: 'garments/demo_chaqueta_cuero_urbana.glb',
            s3Bucket: 'bellia-media',
            s3Url: 'https://bellia-media.s3.us-east-1.amazonaws.com/garments/demo_chaqueta_cuero_urbana.glb',
            cdnUrl: 'https://cdn.bellia.tech/garments/demo_chaqueta_cuero_urbana.glb',
            mediaType: 'garment',
            systemFunction: 'catalogo_prendas',
            isActive: true,
            usedByComponents: ['Catálogo de Prendas Bellia', 'Recomendador de Tallas IA'],
            status: 'active',
            mimeType: 'model/gltf-binary',
            extension: '.glb',
            sizeBytes: 8450120,
            metadata: { category: 'abrigos', clothType: 'leather', gender: 'unisex', resolution: '4K PBR' },
          },
          {
            id: '22222222-2222-2222-2222-222222222223',
            userId: adminId,
            title: 'Red Neuronal PyTorch - Visión Computacional (HU-032)',
            originalFilename: 'cnn_vision_model_v1.pt',
            s3Key: 'ai-models/demo_cnn_vision_model_v1.pt',
            s3Bucket: 'bellia-media',
            s3Url: 'https://bellia-media.s3.us-east-1.amazonaws.com/ai-models/demo_cnn_vision_model_v1.pt',
            cdnUrl: 'https://cdn.bellia.tech/ai-models/demo_cnn_vision_model_v1.pt',
            mediaType: 'ai_component',
            systemFunction: 'motor_inferencia_ia',
            isActive: true,
            usedByComponents: ['Microservicio FastAPI IA (backend/ai)', 'Pipeline CI/CD AWS ECS'],
            status: 'active',
            mimeType: 'application/octet-stream',
            extension: '.pt',
            sizeBytes: 45200300,
            metadata: { framework: 'PyTorch 2.2', architecture: 'ResNet50-Custom', inputShape: [1, 3, 224, 224], accuracy: '96.4%' },
          },
          {
            id: '22222222-2222-2222-2222-222222222224',
            userId: adminId,
            title: 'Fotografía de Estudio - Producto Lookbook 4K',
            originalFilename: 'studio_product_shot.webp',
            s3Key: 'photos/demo_studio_product_shot.webp',
            s3Bucket: 'bellia-media',
            s3Url: 'https://bellia-media.s3.us-east-1.amazonaws.com/photos/demo_studio_product_shot.webp',
            cdnUrl: 'https://cdn.bellia.tech/photos/demo_studio_product_shot.webp',
            mediaType: 'photo',
            systemFunction: 'galeria_marketing',
            isActive: true,
            usedByComponents: ['Banner Principal Ecommerce', 'App Móvil Android Splash'],
            status: 'active',
            mimeType: 'image/webp',
            extension: '.webp',
            sizeBytes: 845200,
            metadata: { width: 3840, height: 2160, format: 'webp', aspectRatio: '1.78', exifStripped: true, optimizedTo: 'webp' },
          },
        ])
        .execute();
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from('media_assets')
      .where('id IN (:...ids)', {
        ids: [
          '22222222-2222-2222-2222-222222222221',
          '22222222-2222-2222-2222-222222222222',
          '22222222-2222-2222-2222-222222222223',
          '22222222-2222-2222-2222-222222222224',
        ],
      })
      .execute();

    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from('users')
      .where('email = :email', { email: 'valeria@bellia.com' })
      .execute();
  }
}
