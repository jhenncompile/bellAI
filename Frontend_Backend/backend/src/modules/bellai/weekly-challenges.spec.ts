import { CHALLENGE_ACTIONS, CHALLENGE_CATALOG, progressOf, templateForWeek, weeklyStreak } from './weekly-challenges';

describe('Retos semanales de estilo (HU-28)', () => {
  it('cada semana hay un reto con tareas, y rota por el catálogo', () => {
    for (const tpl of CHALLENGE_CATALOG) {
      expect(tpl.tasks.length).toBeGreaterThanOrEqual(3);
      for (const t of tpl.tasks) {
        expect(CHALLENGE_ACTIONS).toContain(t.action);
        expect(t.title.length).toBeLessThanOrEqual(180); // columna reto_tarea.titulo
      }
      expect(tpl.title.length).toBeLessThanOrEqual(140); // columna reto_semanal.titulo
    }
    expect(templateForWeek(1)).not.toBe(templateForWeek(2));
    expect(templateForWeek(1)).toBe(templateForWeek(1 + CHALLENGE_CATALOG.length));
    expect(templateForWeek(-1)).toBeDefined();
  });

  it('calcula el avance con las tareas marcadas', () => {
    expect(progressOf([{ completedAt: '2026-11-17' }, { completedAt: null }, {}, { completedAt: new Date() }]))
      .toEqual({ completed: 2, total: 4, percent: 50 });
    expect(progressOf([])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('la racha cuenta semanas completas seguidas; la semana en curso sin terminar no la rompe', () => {
    const full = { completed: 4, total: 4 };
    const half = { completed: 2, total: 4 };
    expect(weeklyStreak([full, full, half, full])).toBe(2);
    expect(weeklyStreak([half, full, full])).toBe(2); // esta semana aún no termina
    expect(weeklyStreak([half, half, full])).toBe(0);
    expect(weeklyStreak([{ completed: 0, total: 0 }])).toBe(0);
  });
});
