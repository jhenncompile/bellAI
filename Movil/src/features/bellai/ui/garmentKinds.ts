import type { AvatarGarment } from '../api/types';

/**
 * HU-023: prenda del armario → prenda básica del maniquí que se genera en el servidor.
 * Devuelve «tipo:RRGGBB,…» para /avatar/mesh. Calzado y accesorios todavía no se dibujan.
 */
export function serverGarments(garments: AvatarGarment[]): string {
  const kind = (g: AvatarGarment): string | null => {
    const sub = (g.subcategory || '').toLowerCase();
    const name = (g.name || '').toLowerCase();
    switch (g.slot) {
      case 'vestido':
        return 'vestido';
      case 'abrigo':
        return 'blazer';
      case 'torso':
        if (sub === 'camisetas') return 'camiseta';
        if (sub === 'tops') return 'top';
        if (sub === 'blusas' || sub === 'camisas') return 'blusa_v';
        return 'blusa_basica';
      case 'cadera':
        if (sub === 'shorts') return 'short';
        return name.includes('lápiz') || name.includes('lapiz') || name.includes('recta') ? 'falda_lapiz' : 'falda_a';
      case 'piernas':
        return name.includes('ancho') || name.includes('palazzo') || name.includes('wide') ? 'pantalon_ancho' : 'pantalon_recto';
      default:
        return null;
    }
  };
  return garments
    .map((g) => {
      const k = kind(g);
      const hex = g.colorHex && /^#[0-9A-Fa-f]{6}$/.test(g.colorHex) ? g.colorHex.slice(1) : 'CBB89D';
      return k ? `${k}:${hex}` : null;
    })
    .filter(Boolean)
    .join(',');
}
