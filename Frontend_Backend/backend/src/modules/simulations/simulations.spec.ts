import { SIMULATION_KINDS, tryOnRegion } from './simulations.service';

describe('HU-022: probador de prendas sobre la foto', () => {
  it('incluye la simulación de prendas', () => {
    expect(SIMULATION_KINDS).toContain('prenda');
  });

  it('asigna la región del cuerpo según la categoría de la prenda', () => {
    expect(tryOnRegion('superior', 'blusas')).toBe('superior');
    expect(tryOnRegion('abrigo', 'chaquetas')).toBe('superior');
    expect(tryOnRegion('inferior', 'pantalones')).toBe('inferior');
    expect(tryOnRegion('superior', 'vestidos')).toBe('completo');
  });

  it('no permite probar calzado ni accesorios', () => {
    expect(tryOnRegion('calzado', 'zapatillas')).toBeNull();
    expect(tryOnRegion('accesorio', 'bolsos')).toBeNull();
  });
});
