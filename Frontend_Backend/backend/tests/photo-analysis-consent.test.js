const assert = require('node:assert/strict');
const test = require('node:test');
const {
  PhotoAnalysisConsentService,
  PHOTO_ANALYSIS_CONSENT_ERROR,
} = require('../dist/modules/privacy/photo-analysis-consent.service');
const { WardrobeService } = require('../dist/modules/wardrobe/wardrobe.service');

function createConsentRepo(records = [], failure = null) {
  return {
    async findOne({ where }) {
      if (failure) throw failure;
      return records
        .filter(
          (record) =>
            record.userId === where.userId &&
            record.consentType === where.consentType,
        )
        .sort((left, right) => right.createdAt - left.createdAt)[0] || null;
    },
  };
}

function consentRecord(userId, accepted, createdAt) {
  return {
    userId,
    consentType: 'photo_analysis',
    accepted,
    createdAt: new Date(createdAt),
  };
}

async function assertConsentDenied(service, userId) {
  await assert.rejects(
    () => service.assertPhotoAnalysisConsent(userId),
    (error) => {
      assert.equal(error.getStatus(), 403);
      assert.equal(error.getResponse().error, PHOTO_ANALYSIS_CONSENT_ERROR);
      return true;
    },
  );
}

test('HU-06: ausencia, rechazo, revocación y fallo de consulta deniegan el análisis', async () => {
  await assertConsentDenied(new PhotoAnalysisConsentService(createConsentRepo()), 'user-a');
  await assertConsentDenied(
    new PhotoAnalysisConsentService(
      createConsentRepo([consentRecord('user-a', false, '2026-01-01')]),
    ),
    'user-a',
  );
  await assertConsentDenied(
    new PhotoAnalysisConsentService(
      createConsentRepo([
        consentRecord('user-a', true, '2026-01-01'),
        consentRecord('user-a', false, '2026-01-02'),
      ]),
    ),
    'user-a',
  );
  await assertConsentDenied(
    new PhotoAnalysisConsentService(createConsentRepo([], new Error('DB caída'))),
    'user-a',
  );
});

test('HU-06: aceptación vigente y nuevo otorgamiento permiten analizar solo a su usuaria', async () => {
  const service = new PhotoAnalysisConsentService(
    createConsentRepo([
      consentRecord('user-a', false, '2026-01-01'),
      consentRecord('user-a', true, '2026-01-02'),
      consentRecord('user-b', false, '2026-01-03'),
    ]),
  );

  await service.assertPhotoAnalysisConsent('user-a');
  await assertConsentDenied(service, 'user-b');
});

test('HU-06: denegación detiene armario antes de IA, persistencia y fallback', async () => {
  let enhancementCalls = 0;
  let saves = 0;
  const wardrobeRepo = {
    create: (value) => value,
    async save(value) {
      saves += 1;
      return value;
    },
  };
  const auditRepo = { create: (value) => value, async save() {} };
  const enhancementService = {
    async processAndEnhanceGarment() {
      enhancementCalls += 1;
      throw new Error('No debe ejecutarse');
    },
  };
  const consentService = {
    async assertPhotoAnalysisConsent() {
      const error = new Error('Consentimiento requerido');
      error.getStatus = () => 403;
      throw error;
    },
  };
  const service = new WardrobeService(
    wardrobeRepo,
    auditRepo,
    enhancementService,
    consentService,
  );

  await assert.rejects(
    () =>
      service.scanAndSaveGarment(
        'user-a',
        { buffer: Buffer.from('foto'), originalname: 'foto.jpg', mimetype: 'image/jpeg' },
        { captureSource: 'camera' },
      ),
    (error) => error.getStatus() === 403,
  );
  assert.equal(enhancementCalls, 0);
  assert.equal(saves, 0);
});
