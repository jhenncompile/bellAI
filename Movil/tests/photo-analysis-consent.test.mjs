import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function source(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
}

test('HU-06: rostro consulta el consentimiento antes de guardar o analizar', () => {
  // El análisis facial ahora pasa por useScanWorkflow (diagnóstico en el servidor). La bóveda local y
  // el análisis solo se ejecutan dentro de analyzeFaceUri / analyzeBodyUri, que únicamente se llaman
  // a través de withConsent → consentGate.runWithConsent (assertPhotoAnalysisConsent).
  const workflow = source('src/features/scan-diagnosis/model/useScanWorkflow.ts');
  const gate = source('src/features/privacy/model/usePhotoAnalysisConsentGate.ts');

  assert.ok(gate.indexOf('assertPhotoAnalysisConsent()') < gate.indexOf('await task()'));
  assert.ok(workflow.includes('consentGate.runWithConsent('));
  assert.match(workflow, /const processImageUri = \(uri: string\) => withConsent\(\(\) => analyzeFaceUri\(uri\)\)/);
  assert.match(workflow, /const processBodyUri = \(uri: string\) => withConsent\(\(\) => analyzeBodyUri\(uri\)\)/);
  // La única llamada a cada análisis es la protegida por withConsent
  assert.equal(workflow.split('analyzeFaceUri(').length - 1, 1);
  assert.equal(workflow.split('analyzeBodyUri(').length - 1, 1);
});

test('HU-06: todos los puntos compartidos de prendas fallan cerrados', () => {
  const files = [
    'src/features/digital-wardrobe/services/garmentImageAnalyzer.ts',
    'src/features/digital-wardrobe/services/wardrobeService.ts',
    'src/features/wardrobe-matching/api/wardrobeService.ts',
  ];

  for (const file of files) {
    assert.match(source(file), /assertPhotoAnalysisConsent\(\)/, file);
  }
});

test('HU-06: CU08 está integrado en rostro y prendas con aceptar y rechazar', () => {
  const home = source('src/screens/HomeScreen.tsx');
  const garmentCamera = source('src/views/CU18GarmentCameraView.tsx');

  for (const fileSource of [home, garmentCamera]) {
    assert.match(fileSource, /CU08PhotoConsentView/);
    assert.match(fileSource, /onGrantConsent/);
    assert.match(fileSource, /onDenyConsent/);
  }
});

test('HU-06: el perfil conserva revocación, reotorgamiento y error visible', () => {
  const profile = source('src/screens/ProfileScreen.tsx');

  assert.match(profile, /recordPhotoAnalysisConsent\(!photoConsentActive\)/);
  assert.match(profile, /setPhotoConsentActive\(saved\.accepted\)/);
  assert.match(profile, /No se actualizó la autorización/);
});
