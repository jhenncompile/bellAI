import { AVATAR_SCAN_TASK, AvatarScanService, checkScanUpload, scanField } from './avatar-scan.service';
import { taskFinishedMessage } from '../notifications/push.messages';

const foto = (fieldname: string, extra: Partial<Express.Multer.File> = {}) =>
  ({ fieldname, mimetype: 'image/jpeg', size: 1000, buffer: Buffer.from(fieldname), originalname: `${fieldname}.jpg`, ...extra }) as Express.Multer.File;

describe('Escaneo del avatar (HU-023)', () => {
  describe('validación de la subida', () => {
    it('acepta las vistas de la cabeza, la pose T y hasta 24 fotos del giro', () => {
      expect(scanField('face_frente')).toBe(true);
      expect(scanField('tpose')).toBe(true);
      expect(scanField('turn_0')).toBe(true);
      expect(scanField('turn_23')).toBe(true);
      expect(scanField('turn_24')).toBe(false);
      expect(scanField('otra')).toBe(false);
    });

    it('exige cara de frente, pose T y estatura razonable', () => {
      expect(() => checkScanUpload([foto('tpose')], '165')).toThrow('Falta la foto de tu cara de frente.');
      expect(() => checkScanUpload([foto('face_frente')], '165')).toThrow('Falta la foto de cuerpo entero en pose T.');
      expect(() => checkScanUpload([foto('face_frente'), foto('tpose')], '90')).toThrow('estatura');
      expect(() => checkScanUpload([foto('face_frente'), foto('tpose')], 'abc')).toThrow('estatura');
    });

    it('acepta la coma decimal, ignora campos extraños y rechaza formatos no válidos', () => {
      const { byField, heightCm } = checkScanUpload([foto('face_frente'), foto('tpose'), foto('turn_1'), foto('basura')], '165,5');
      expect(heightCm).toBe(165.5);
      expect([...byField.keys()]).toEqual(['face_frente', 'tpose', 'turn_1']);
      expect(() => checkScanUpload([foto('face_frente', { mimetype: 'application/pdf' }), foto('tpose')], '165')).toThrow('JPG, PNG o WEBP');
    });
  });

  describe('tarea', () => {
    const make = (opts: { consent?: boolean; prevKey?: string | null; aiFails?: boolean } = {}) => {
      const queries: { sql: string; params: any[] }[] = [];
      const files = new Map<string, Buffer>();
      let photoSeq = 0;
      const photos = new Map<string, { key: string; mime: string }>();
      const ds = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          queries.push({ sql, params });
          if (sql.includes('FROM gdpr_consents')) return [{ accepted: opts.consent ?? true }];
          if (sql.startsWith('INSERT INTO fotografia')) {
            const id = `foto-${++photoSeq}`;
            photos.set(id, { key: params[1], mime: params[2] });
            return [{ id }];
          }
          if (sql.startsWith('SELECT clave_archivo AS key, mime')) return photos.has(params[0]) ? [photos.get(params[0])] : [];
          if (sql.startsWith('SELECT clave_archivo AS key FROM fotografia')) return photos.has(params[0]) ? [{ key: photos.get(params[0])!.key }] : [];
          if (sql.startsWith('DELETE FROM fotografia')) photos.delete(params[0]);
          if (sql.includes(`configuracion->'scan'->>'key'`)) return opts.prevKey ? [{ key: opts.prevKey }] : [];
          return [];
        }),
      };
      const storage = {
        uploadFile: jest.fn(async ({ key, buffer }: any) => { files.set(key, buffer); }),
        readFile: jest.fn(async (key: string) => files.get(key) ?? Buffer.from('')),
        deleteFile: jest.fn(async (key: string) => { files.delete(key); }),
      };
      const ai = {
        postFiles: jest.fn(async () => {
          if (opts.aiFails) throw new Error('No vimos tu cuerpo entero');
          return { version: 'v', mesh: { positions: [0, 0, 0] }, measurements: { cinturaCm: 70 }, proportions: { waist: 0.7 }, appearance: { skinHex: '#AA8877' }, quality: { warnings: [] } };
        }),
      };
      let handler: any;
      const tasks = {
        register: jest.fn((type: string, h: any, o: any) => { handler = h; expect(type).toBe(AVATAR_SCAN_TASK); expect(o.minTimeoutS).toBeGreaterThanOrEqual(180); }),
        enqueue: jest.fn(async (_u: string, _t: string, input: any) => ({ id: 'tarea-1', input })),
      };
      const audit = { record: jest.fn(async () => undefined) };
      const bellai = { ensureUser: jest.fn(async () => undefined) };
      const service = new AvatarScanService(ds as any, storage as any, ai as any, tasks as any, audit as any, bellai as any);
      service.onModuleInit();
      return { service, queries, files, photos, storage, ai, tasks, run: (input: any) => handler(input, { userId: 'u1', progress: async () => undefined }) };
    };

    it('sin consentimiento de fotos no guarda nada', async () => {
      const { service, storage } = make({ consent: false });
      await expect(service.start({ id: 'u1' } as any, [foto('face_frente'), foto('tpose')], '165')).rejects.toMatchObject({ response: { code: 'consentimiento_requerido' } });
      expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    it('guarda las fotos como avatar y encola la tarea con la estatura', async () => {
      const { service, tasks, queries } = make();
      await service.start({ id: 'u1' } as any, [foto('face_frente'), foto('tpose'), foto('turn_0')], '170');
      const input = (tasks.enqueue as jest.Mock).mock.calls[0][2];
      expect(input).toEqual({ photos: { face_frente: 'foto-1', tpose: 'foto-2', turn_0: 'foto-3' }, heightCm: 170 });
      expect(queries.filter((q) => q.sql.startsWith('INSERT INTO fotografia')).every((q) => q.sql.includes("'avatar'"))).toBe(true);
    });

    it('manda las fotos a la IA, guarda la malla, borra la anterior y siempre borra las fotos', async () => {
      const { service, run, ai, files, photos, storage, tasks, queries } = make({ prevKey: 'private/u1/avatar/viejo.json' });
      await service.start({ id: 'u1' } as any, [foto('face_frente'), foto('tpose')], '165');
      const result = await run((tasks.enqueue as jest.Mock).mock.calls[0][2]);

      const [path, sent, fields] = (ai.postFiles as jest.Mock).mock.calls[0];
      expect(path).toBe('/api/v1/avatar/reconstruct');
      expect(Object.keys(sent)).toEqual(['face_frente', 'tpose']);
      expect(fields).toEqual({ height_cm: '165' });
      expect(result).toEqual({ measurements: { cinturaCm: 70 }, appearance: { skinHex: '#AA8877' }, quality: { warnings: [] } });

      const meshKey = [...files.keys()].find((k) => k.includes('/avatar/escaneo-'))!;
      expect(JSON.parse(files.get(meshKey)!.toString())).toEqual({ positions: [0, 0, 0] });
      const upsert = queries.find((q) => q.sql.startsWith('INSERT INTO avatar'))!;
      expect(upsert.sql).toContain(`COALESCE(avatar.configuracion,'{}'::jsonb) || jsonb_build_object('scan'`);
      expect(JSON.parse(upsert.params[2]).key).toBe(meshKey);
      expect(storage.deleteFile).toHaveBeenCalledWith('private/u1/avatar/viejo.json');
      expect(photos.size).toBe(0);
    });

    it('si la IA falla, también borra las fotos', async () => {
      const { service, run, photos, tasks } = make({ aiFails: true });
      await service.start({ id: 'u1' } as any, [foto('face_frente'), foto('tpose')], '165');
      await expect(run((tasks.enqueue as jest.Mock).mock.calls[0][2])).rejects.toThrow('No vimos tu cuerpo entero');
      expect(photos.size).toBe(0);
    });

    it('la comprobación rápida no guarda la foto y pregunta a la IA', async () => {
      const { service, storage, ai } = make();
      (ai as any).postImage = jest.fn(async () => ({ ok: false, code: 'pies_cortados', message: 'No se te ven los pies.', tpose: false }));
      const r = await service.checkBody({ id: 'u1' } as any, foto('file'));
      expect(r.code).toBe('pies_cortados');
      expect((ai as any).postImage.mock.calls[0][0]).toBe('/api/v1/avatar/check-body');
      expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    it('sin escaneo, pide a la IA la malla base y la devuelve', async () => {
      const { service, ai } = make();
      const base = { positions: [0, 1, 2], indices: [0, 1, 2] };
      (ai as any).postJson = jest.fn(async () => base);
      const buf = await service.mesh({ id: 'u1' } as any);
      expect(JSON.parse(buf.toString('utf-8'))).toEqual(base);
      expect((ai as any).postJson.mock.calls[0][0]).toBe('/api/v1/avatar/base-mesh');
    });
  });

  it('avisa por push cuando el avatar está listo y abre la pantalla del avatar', () => {
    expect(taskFinishedMessage(AVATAR_SCAN_TASK, 'completada', {}, null)?.data).toEqual({ url: '/avatar', kind: 'avatar_listo' });
    expect(taskFinishedMessage(AVATAR_SCAN_TASK, 'fallida', null, 'No se vio tu cuerpo.')?.body).toBe('No se vio tu cuerpo.');
  });
});
