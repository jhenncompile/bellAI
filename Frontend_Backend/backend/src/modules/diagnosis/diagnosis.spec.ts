import { buildIntegratedDiagnosis, mergeAnalyses } from './diagnosis.builder';

/** Resultados mínimos con la forma que devuelve el servicio de IA. */
const face = {
  face: { faceShape: 'Ovalado', confidence: 0.9 },
  colorimetry: { skinTone: 'Clara', undertone: 'Calido', season: 'Primavera Clara (Light Spring)', contrastLevel: 'Medio', confidence: 0.8, colors: {} },
};
const body = { body: { bodyType: 'Reloj de Arena (Hourglass)', verticality: 'Proporción equilibrada', confidence: 0.7 } };

describe('Diagnóstico integral: rostro, piel y silueta en un solo resultado (HU-12)', () => {
  it('une rostro, piel y silueta con una confianza global', () => {
    const d = buildIntegratedDiagnosis(face, body);
    expect(d.faceShape).toBe('Ovalado');
    expect(d.season).toContain('Primavera');
    expect(d.bodyType).toContain('Reloj de Arena');
    expect(d.confidence.overall).toBeCloseTo(0.8, 3);
    expect(d.summary).toMatch(/piel.*rostro.*silueta/s);
  });

  it('si hoy solo envía el cuerpo, conserva el rostro y la piel de su último diagnóstico', () => {
    const previous = buildIntegratedDiagnosis(face, null);
    const merged = mergeAnalyses(null, body, previous);
    const d = buildIntegratedDiagnosis(merged.face, merged.body);
    expect(d.faceShape).toBe('Ovalado');
    expect(d.undertone).toBe('Calido');
    expect(d.bodyType).toContain('Reloj de Arena');
  });

  it('si hoy solo envía el rostro, conserva su silueta, y lo nuevo sustituye a lo anterior', () => {
    const previous = buildIntegratedDiagnosis({ ...face, face: { faceShape: 'Redondo', confidence: 0.9 } }, body);
    const merged = mergeAnalyses(face, null, previous);
    const d = buildIntegratedDiagnosis(merged.face, merged.body);
    expect(d.faceShape).toBe('Ovalado');
    expect(d.bodyType).toContain('Reloj de Arena');
  });

  it('sin diagnóstico anterior se queda con lo que hay, sin inventar la otra parte', () => {
    const merged = mergeAnalyses(face, null, null);
    expect(merged.body).toBeNull();
    expect(buildIntegratedDiagnosis(merged.face, merged.body).bodyType).toBeNull();
  });
});
