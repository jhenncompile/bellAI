const assert = require('node:assert/strict');
const test = require('node:test');
const sharp = require('sharp');
const { WardrobeService } = require('../dist/modules/wardrobe/wardrobe.service');
const {
  WardrobeEnhancementService,
} = require('../dist/modules/wardrobe/wardrobe-enhancement.service');
const {
  WardrobeController,
} = require('../dist/modules/wardrobe/wardrobe.controller');

function createInMemoryWardrobeRepo() {
  const store = [];
  let seq = 1;
  return {
    store,
    create(data) {
      return {
        id: data.id || `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`,
        name: null,
        subcategory: 'otros',
        color: null,
        colorHex: null,
        approximateSize: null,
        season: null,
        occasion: null,
        captureSource: 'camera',
        originalImageUrl: null,
        enhancedImageUrl: null,
        status: 'confirmed',
        aiMetadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
    },
    async save(entity) {
      entity.updatedAt = new Date();
      const idx = store.findIndex((i) => i.id === entity.id);
      if (idx >= 0) {
        store[idx] = { ...store[idx], ...entity };
        return store[idx];
      }
      store.push(entity);
      return entity;
    },
    async findOne({ where }) {
      return (
        store.find(
          (i) =>
            (!where.id || i.id === where.id) &&
            (!where.userId || i.userId === where.userId),
        ) || null
      );
    },
    async find({ where }) {
      return store.filter((i) => !where.userId || i.userId === where.userId);
    },
    createQueryBuilder() {
      const filters = [];
      return {
        where(condition, parameters) {
          filters.push({ condition, parameters });
          return this;
        },
        andWhere(condition, parameters) {
          filters.push({ condition, parameters });
          return this;
        },
        orderBy() {
          return this;
        },
        async getMany() {
          return store.filter((item) =>
            filters.every(({ condition, parameters }) => {
              if (condition.includes('item.userId =')) {
                return item.userId === parameters.userId;
              }
              if (condition.includes('item.category =')) {
                return item.category === parameters.category;
              }
              if (condition.includes('item.subcategory =')) {
                return item.subcategory === parameters.subcategory;
              }
              if (condition.includes('item.season =')) {
                return item.season === parameters.season;
              }
              if (condition.includes('item.occasion =')) {
                return item.occasion === parameters.occasion;
              }
              if (condition.includes('item.status =')) {
                return item.status === parameters.status;
              }
              if (condition.includes('item.name ILIKE')) {
                const term = parameters.search.replace(/%/g, '').toLowerCase();
                const haystack = [
                  item.name,
                  item.color,
                  item.colorHex,
                  item.subcategory,
                  item.category,
                ]
                  .join(' ')
                  .toLowerCase();
                return haystack.includes(term);
              }
              if (condition.includes('item.color ILIKE')) {
                const color = (item.color || '').toLowerCase();
                const colorHex = (item.colorHex || '').toLowerCase();
                const term = parameters.color.replace(/%/g, '').toLowerCase();
                return color.includes(term) || colorHex.includes(term);
              }
              return true;
            }),
          );
        },
      };
    },
    async remove(entity) {
      const idx = store.findIndex((i) => i.id === entity.id);
      if (idx >= 0) store.splice(idx, 1);
      return entity;
    },
  };
}

function createInMemoryAuditRepo() {
  const logs = [];
  return {
    logs,
    create(data) {
      return { id: `log-${logs.length + 1}`, createdAt: new Date(), ...data };
    },
    async save(entry) {
      logs.push(entry);
      return entry;
    },
    async find({ where, take }) {
      const filtered = logs.filter(
        (l) => !where?.userId || l.userId === where.userId,
      );
      return typeof take === 'number' ? filtered.slice(0, take) : filtered;
    },
    createQueryBuilder() {
      let userId;
      let actions = [];
      let limit = logs.length;
      return {
        select() {
          return this;
        },
        where(_condition, parameters) {
          userId = parameters.userId;
          return this;
        },
        andWhere(_condition, parameters) {
          actions = parameters.actions;
          return this;
        },
        orderBy(_column, direction) {
          this.direction = direction;
          return this;
        },
        take(count) {
          limit = count;
          return this;
        },
        async getMany() {
          const matchingLogs = logs
            .filter((log) => log.userId === userId && actions.includes(log.action))
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
          return matchingLogs.slice(0, limit);
        },
      };
    },
  };
}

function createInMemoryPreferencesRepo() {
  const store = [];
  return {
    store,
    create(data) {
      return {
        id: `pref-${store.length + 1}`,
        theme: 'system',
        language: 'es',
        notificationsEmail: true,
        notificationsPush: false,
        autoBackupEnabled: true,
        offlineModeEnabled: true,
        lastSyncedAt: null,
        ...data,
      };
    },
    async findOne({ where }) {
      return store.find((p) => p.userId === where.userId) || null;
    },
    async save(entity) {
      const idx = store.findIndex((p) => p.userId === entity.userId);
      if (idx >= 0) {
        store[idx] = { ...store[idx], ...entity };
        return store[idx];
      }
      store.push(entity);
      return entity;
    },
  };
}

function allowPhotoAnalysis() {
  return {
    async assertPhotoAnalysisConsent() {},
  };
}

async function createSamplePhotoBuffer(r = 30, g = 58, b = 138, width = 600, height = 800) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r, g, b },
    },
  })
    .jpeg({ quality: 88 })
    .toBuffer();
}

test('HU-009: getMobileCaptureConfig expone permisos de cámara y galería para React Native', () => {
  const controller = new WardrobeController({});
  const config = controller.getMobileCaptureConfig();

  assert.equal(config.permissionsRequired.camera.android, 'android.permission.CAMERA');
  assert.equal(
    config.permissionsRequired.gallery.android,
    'android.permission.READ_MEDIA_IMAGES',
  );
  assert.deepEqual(config.categories, [
    'superior',
    'inferior',
    'calzado',
    'abrigo',
    'accesorio',
  ]);
  assert.deepEqual(config.occasions, [
    'casual',
    'formal',
    'fiesta',
    'deporte',
    'trabajo',
    'playa',
    'gala',
  ]);
  assert.equal(config.subcategories.includes('blusas'), true);
  assert.equal(config.subcategories.includes('vestidos'), true);
  assert.equal(config.subcategories.includes('pantalones'), true);
  assert.equal(config.subcategories.includes('bolsos'), true);
});

test('HU-14/HU-16: guarda accesorios con ocasión y combina filtros de categoría, color y ocasión', async () => {
  const wardrobeRepo = createInMemoryWardrobeRepo();
  const auditRepo = createInMemoryAuditRepo();
  const service = new WardrobeService(
    wardrobeRepo,
    auditRepo,
    new WardrobeEnhancementService(),
    allowPhotoAnalysis(),
  );

  const saved = await service.createDraft('user-valeria', {
    name: 'Bolso negro',
    category: 'accesorio',
    subcategory: 'bolsos',
    color: 'Negro',
    occasion: 'fiesta',
  });

  assert.equal(saved.item.category, 'accesorio');
  assert.equal(saved.item.subcategory, 'bolsos');
  assert.equal(saved.item.bottomDetails.occasion, 'fiesta');

  const filtered = await service.getMyWardrobe('user-valeria', {
    category: 'accesorio',
    color: 'negro',
    occasion: 'fiesta',
  });
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].id, saved.item.id);

  const noMatches = await service.getMyWardrobe('user-valeria', {
    occasion: 'trabajo',
  });
  assert.equal(noMatches.isEmpty, false);
  assert.equal(noMatches.items.length, 0);
  assert.equal(noMatches.emptyState.title, 'Sin coincidencias para tu búsqueda');
});

test('HU-009: escanear prenda desde cámara/galería genera imagen mejorada realista y auto-clasifica en su categoría', async () => {
  const wardrobeRepo = createInMemoryWardrobeRepo();
  const auditRepo = createInMemoryAuditRepo();
  const enhancementService = new WardrobeEnhancementService();
  const service = new WardrobeService(
    wardrobeRepo,
    auditRepo,
    enhancementService,
    allowPhotoAnalysis(),
  );

  const buffer = await createSamplePhotoBuffer(30, 58, 138, 600, 820);
  const file = {
    buffer,
    originalname: 'blusa_favorita.jpg',
    mimetype: 'image/jpeg',
  };

  const result = await service.scanAndSaveGarment('user-valeria', file, {
    captureSource: 'camera',
  });

  assert.equal(result.savedAsDraft, false);
  assert.equal(result.item.userId, 'user-valeria');
  assert.equal(result.item.category, 'superior');
  assert.equal(result.item.subcategory, 'blusas');
  assert.equal(result.item.status, 'confirmed');
  assert.ok(result.item.enhancedImageUrl.startsWith('/uploads/wardrobe/enhanced_'));
  assert.ok(result.item.originalImageUrl.startsWith('/uploads/wardrobe/orig_'));
  assert.equal(result.item.bottomDetails.color, 'Azul Marino');
  assert.equal(result.item.bottomDetails.colorHex, '#1E3A8A');
  assert.ok(result.item.bottomDetails.approximateSize.includes('Aprox'));
  assert.equal(result.item.bottomDetails.categoryLabel, 'Superior • Blusas');
  assert.equal(auditRepo.logs.length, 1);
  assert.equal(auditRepo.logs[0].action, 'WARDROBE_ITEM_SCANNED');

  // Limpiar archivos de prueba generados en disco
  await enhancementService.removeGarmentImages([
    result.item.originalImageUrl,
    result.item.enhancedImageUrl,
  ]);
});

test('HU-009: si falla la subida de la foto o el archivo está corrupto, se conserva automáticamente el borrador', async () => {
  const wardrobeRepo = createInMemoryWardrobeRepo();
  const auditRepo = createInMemoryAuditRepo();
  const enhancementService = new WardrobeEnhancementService();
  const service = new WardrobeService(
    wardrobeRepo,
    auditRepo,
    enhancementService,
    allowPhotoAnalysis(),
  );

  // Caso 1: La subida de foto se corta (no llega archivo)
  const missingPhotoResult = await service.scanAndSaveGarment(
    'user-valeria',
    undefined,
    {
      name: 'Pantalón Negro de Vestir',
      category: 'inferior',
      subcategory: 'pantalones',
      color: 'Negro',
      season: 'todo_el_ano',
      captureSource: 'gallery',
    },
  );

  assert.equal(missingPhotoResult.savedAsDraft, true);
  assert.equal(missingPhotoResult.item.status, 'upload_failed');
  assert.equal(missingPhotoResult.item.name, 'Pantalón Negro de Vestir');
  assert.equal(missingPhotoResult.item.category, 'inferior');
  assert.equal(missingPhotoResult.item.subcategory, 'pantalones');
  assert.equal(missingPhotoResult.item.captureSource, 'gallery');

  // Caso 2: Reintentar subir la foto sobre ese borrador lo convierte en prenda confirmada con imagen mejorada
  const validBuffer = await createSamplePhotoBuffer(24, 24, 27, 550, 950);
  const recovered = await service.attachPhotoToDraft(
    'user-valeria',
    missingPhotoResult.item.id,
    {
      buffer: validBuffer,
      originalname: 'pantalon_negro.jpg',
      mimetype: 'image/jpeg',
    },
    'gallery',
  );

  assert.equal(recovered.savedAsDraft, false);
  assert.equal(recovered.item.id, missingPhotoResult.item.id);
  assert.equal(recovered.item.status, 'confirmed');
  assert.ok(recovered.item.enhancedImageUrl);

  await enhancementService.removeGarmentImages([
    recovered.item.originalImageUrl,
    recovered.item.enhancedImageUrl,
  ]);
});

test('HU-009: privacidad estricta del armario personal (ninguna usuaria puede ver, editar ni eliminar prendas de otra)', async () => {
  const wardrobeRepo = createInMemoryWardrobeRepo();
  const auditRepo = createInMemoryAuditRepo();
  const enhancementService = new WardrobeEnhancementService();
  const service = new WardrobeService(
    wardrobeRepo,
    auditRepo,
    enhancementService,
    allowPhotoAnalysis(),
  );

  const buffer = await createSamplePhotoBuffer(153, 27, 27, 500, 850);
  const createdByUsuariaA = await service.scanAndSaveGarment(
    'usuaria-a',
    { buffer, originalname: 'vestido_vino.jpg', mimetype: 'image/jpeg' },
    { captureSource: 'gallery' },
  );

  // Usuaria B consulta su armario: debe estar vacío
  const wardrobeB = await service.getMyWardrobe('usuaria-b', {});
  assert.equal(wardrobeB.items.length, 0);
  assert.equal(wardrobeB.summary.totalConfirmed, 0);

  // Usuaria B intenta ver, editar o borrar la prenda de Usuaria A: recibe 404 NotFoundException
  await assert.rejects(
    () => service.getGarmentById('usuaria-b', createdByUsuariaA.item.id),
    /no existe en tu armario personal/,
  );
  await assert.rejects(
    () =>
      service.updateGarment('usuaria-b', createdByUsuariaA.item.id, {
        name: 'Intento intruso',
      }),
    /no existe en tu armario personal/,
  );
  await assert.rejects(
    () => service.deleteGarment('usuaria-b', createdByUsuariaA.item.id),
    /no existe en tu armario personal/,
  );

  // Usuaria A sí puede editar y eliminar su prenda
  const edited = await service.updateGarment('usuaria-a', createdByUsuariaA.item.id, {
    name: 'Vestido Vino Elegante',
    approximateSize: 'S',
  });
  assert.equal(edited.item.name, 'Vestido Vino Elegante');
  assert.equal(edited.item.bottomDetails.approximateSize, 'S');

  const deleted = await service.deleteGarment('usuaria-a', createdByUsuariaA.item.id);
  assert.equal(deleted.deletedId, createdByUsuariaA.item.id);
});

test('HU-011: estado de armario vacío, cuadrícula, búsqueda/filtros y detalle con fecha de alta y último uso', async () => {
  const wardrobeRepo = createInMemoryWardrobeRepo();
  const auditRepo = createInMemoryAuditRepo();
  const enhancementService = new WardrobeEnhancementService();
  const service = new WardrobeService(
    wardrobeRepo,
    auditRepo,
    enhancementService,
    allowPhotoAnalysis(),
  );

  // 1. Armario vacío: devuelve mensaje invitando a agregar la primera prenda
  const emptyWardrobe = await service.getMyWardrobe('usuaria-nueva', {});
  assert.equal(emptyWardrobe.isEmpty, true);
  assert.ok(emptyWardrobe.emptyState);
  assert.equal(emptyWardrobe.emptyState.title, 'Tu armario digital está vacío');
  assert.match(emptyWardrobe.emptyState.message, /primera prenda/i);

  // 2. Agregar prendas y consultar cuadrícula y filtros
  const bufferBlusa = await createSamplePhotoBuffer(30, 58, 138, 600, 820);
  const blusa = await service.scanAndSaveGarment(
    'usuaria-nueva',
    { buffer: bufferBlusa, originalname: 'blusa_azul.jpg', mimetype: 'image/jpeg' },
    { name: 'Blusa Azul de Seda', category: 'superior', season: 'verano', captureSource: 'camera' },
  );

  const bufferPantalon = await createSamplePhotoBuffer(24, 24, 27, 550, 950);
  const pantalon = await service.scanAndSaveGarment(
    'usuaria-nueva',
    { buffer: bufferPantalon, originalname: 'pantalon_negro.jpg', mimetype: 'image/jpeg' },
    { name: 'Pantalón Sastre', category: 'inferior', season: 'invierno', captureSource: 'gallery' },
  );

  const populatedWardrobe = await service.getMyWardrobe('usuaria-nueva', {});
  assert.equal(populatedWardrobe.isEmpty, false);
  assert.equal(populatedWardrobe.emptyState, null);
  assert.equal(populatedWardrobe.grid.length, 2);
  assert.ok(populatedWardrobe.grid[0].photoUrl);
  assert.ok(populatedWardrobe.grid[0].name);
  assert.ok(populatedWardrobe.grid[0].category);

  // Filtro por texto y temporada
  const filteredSummer = await service.getMyWardrobe('usuaria-nueva', {
    search: 'Seda',
    season: 'verano',
  });
  assert.equal(filteredSummer.items.length, 1);
  assert.equal(filteredSummer.items[0].id, blusa.item.id);

  // 3. Detalle y registro de uso (addedAt, lastWornAt, wearCount)
  assert.equal(blusa.item.usageStats.wearCount, 0);
  assert.equal(blusa.item.usageStats.lastWornAt, null);
  assert.ok(blusa.item.usageStats.addedAt);

  const worn = await service.recordGarmentWear('usuaria-nueva', blusa.item.id, {});
  assert.equal(worn.item.usageStats.wearCount, 1);
  assert.ok(worn.item.usageStats.lastWornAt);

  await enhancementService.removeGarmentImages([
    blusa.item.originalImageUrl,
    blusa.item.enhancedImageUrl,
    pantalon.item.originalImageUrl,
    pantalon.item.enhancedImageUrl,
  ]);
});

test('HU-040: historial de acciones (agregar, editar, eliminar) y sincronización con copia automática y modo sin conexión', async () => {
  const wardrobeRepo = createInMemoryWardrobeRepo();
  const auditRepo = createInMemoryAuditRepo();
  const preferencesRepo = createInMemoryPreferencesRepo();
  const enhancementService = new WardrobeEnhancementService();
  const service = new WardrobeService(
    wardrobeRepo,
    auditRepo,
    enhancementService,
    allowPhotoAnalysis(),
    preferencesRepo,
  );

  // Crear, editar y eliminar una prenda para generar historial completo
  const buffer = await createSamplePhotoBuffer(30, 58, 138, 600, 800);
  const created = await service.scanAndSaveGarment(
    'usuaria-sync',
    { buffer, originalname: 'camisa_lino.jpg', mimetype: 'image/jpeg' },
    { name: 'Camisa de Lino', category: 'superior', captureSource: 'camera' },
  );

  await service.updateGarment('usuaria-sync', created.item.id, {
    name: 'Camisa de Lino Blanca',
    color: 'Blanco Marfil',
  });

  await service.deleteGarment('usuaria-sync', created.item.id);

  // Verificar historial de acciones (agregar, editar, eliminar) con su fecha
  const historyResult = await service.getWardrobeHistory('usuaria-sync', 20);
  assert.equal(historyResult.total, 3);
  const actionTypes = historyResult.history.map((h) => h.actionType);
  assert.equal(actionTypes.includes('agregar'), true);
  assert.equal(actionTypes.includes('editar'), true);
  assert.equal(actionTypes.includes('eliminar'), true);
  assert.ok(historyResult.history[0].occurredAt);

  // Verificar interruptores de copia automática y modo sin conexión + última sincronización
  const updatedSettings = await service.updateSyncSettings('usuaria-sync', {
    autoBackupEnabled: true,
    offlineModeEnabled: false,
  });
  assert.equal(updatedSettings.syncStatus.autoBackupEnabled, true);
  assert.equal(updatedSettings.syncStatus.offlineModeEnabled, false);
  assert.ok(updatedSettings.syncStatus.lastSyncedAt);

  const snapshot = await service.getSyncSnapshot('usuaria-sync');
  assert.equal(snapshot.syncStatus.autoBackupEnabled, true);
  assert.equal(snapshot.syncStatus.offlineModeEnabled, false);
  assert.ok(snapshot.syncStatus.lastSyncedAt);
  assert.equal(snapshot.history.length, 3);
});

test('HU-15: el tipo y el color corregidos por la usuaria prevalecen sobre lo detectado', async () => {
  const wardrobeRepo = createInMemoryWardrobeRepo();
  const auditRepo = createInMemoryAuditRepo();
  const enhancementService = new WardrobeEnhancementService();
  const service = new WardrobeService(wardrobeRepo, auditRepo, enhancementService);

  // Foto azul marino: el servidor detectaría "Azul Marino" y una blusa
  const buffer = await createSamplePhotoBuffer(30, 58, 138, 600, 820);
  const file = { buffer, originalname: 'foto.jpg', mimetype: 'image/jpeg' };

  // 1. Corrige tipo y color eligiendo otra muestra de la foto
  const corrected = await service.scanAndSaveGarment('user-valeria', file, {
    captureSource: 'camera',
    category: 'inferior',
    subcategory: 'jeans',
    color: 'Azul cobalto',
    colorHex: '#1D4ED8',
  });
  assert.equal(corrected.item.category, 'inferior');
  assert.equal(corrected.item.subcategory, 'jeans');
  assert.equal(corrected.item.bottomDetails.color, 'Azul cobalto');
  assert.equal(corrected.item.bottomDetails.colorHex, '#1D4ED8');
  assert.equal(corrected.item.aiMetadata.autoClassified, false);
  // El pipeline local no inventa una confianza numérica
  assert.equal(corrected.item.aiMetadata.confidence, null);

  // 2. Escribe el color a mano sin elegir muestra: no se guarda el hexadecimal detectado
  const manual = await service.scanAndSaveGarment('user-valeria', file, {
    captureSource: 'gallery',
    subcategory: 'faldas',
    color: 'Verde petróleo',
  });
  assert.equal(manual.item.bottomDetails.color, 'Verde petróleo');
  assert.equal(manual.item.bottomDetails.colorHex, null);

  await enhancementService.removeGarmentImages([
    corrected.item.originalImageUrl,
    corrected.item.enhancedImageUrl,
    manual.item.originalImageUrl,
    manual.item.enhancedImageUrl,
  ]);
});
