import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuraGoal, GoalWeekMilestone } from './types';
import { DiagnosticResult } from '@/entities/diagnostic/model/types';
import { bellaiService } from '@/features/bellai/api/bellaiService';

const GOAL_STORAGE_KEY = '@aura_goal_active_v1';

export class AuraGoalService {
  static async clearGoal(): Promise<void> {
    await AsyncStorage.removeItem(GOAL_STORAGE_KEY);
  }

  /**
   * Crea un plan paso a paso personalizado para un evento o cambio de imagen (Pilar 15)
   */
  static generateDefaultGoal(diagnostic?: DiagnosticResult, eventTitle: string = 'Graduación / Evento Especial'): AuraGoal {
    const seasonName = diagnostic?.season || 'tu estación';
    const faceShape = diagnostic?.faceShape || 'tu rostro';

    const milestones: GoalWeekMilestone[] = [
      {
        weekNumber: 1,
        title: 'Semana 1: Colorimetría y Depuración',
        objective: 'Identificar los colores que te potencian y descartar tonos desfavorecedores.',
        completed: false,
        tasks: [
          {
            id: 't-1-1',
            title: `Aprender los 3 colores clave de ${seasonName}`,
            description: 'Revisa tu paleta en la pestaña Estudios y memoriza tus tonos de impacto.',
            completed: false,
            actionRoute: '/studio',
          },
          {
            id: 't-1-2',
            title: 'Identificar prendas poco favorecedoras',
            description: 'Revisa las prendas de tu armario que no armonizan con tu paleta para depurarlas.',
            completed: false,
            actionRoute: '/wardrobe',
          },
        ],
      },
      {
        weekNumber: 2,
        title: 'Semana 2: Visagismo y Marco Facial',
        objective: `Definir el corte de cabello, gafas y escotes que equilibran tu rostro ${faceShape}.`,
        completed: false,
        tasks: [
          {
            id: 't-2-1',
            title: `Corte de cabello para rostro ${faceShape}`,
            description: 'Consulta los cortes recomendados en tu informe para elongar o suavizar tu mandíbula.',
            completed: false,
            actionRoute: '/studio',
          },
          {
            id: 't-2-2',
            title: 'Alinear metales y accesorios',
            description: `Usa exclusivamente metales ${diagnostic?.recommendedMetals[0] || 'Plata'} en pendientes y collares.`,
            completed: false,
          },
        ],
      },
      {
        weekNumber: 3,
        title: 'Semana 3: Armario Cápsula del Evento',
        objective: 'Digitalizar y coordinar las piezas clave para el gran día.',
        completed: false,
        tasks: [
          {
            id: 't-3-1',
            title: 'Escanear 3 prendas candidatas con la cámara',
            description: 'Fotografía el blazer, vestido o camisa principal para calcular su puntuación de armonía real.',
            completed: false,
            actionRoute: '/wardrobe',
          },
          {
            id: 't-3-2',
            title: 'Generar combinaciones automáticas',
            description: 'Usa el Outfit Generator para encontrar la fórmula ganadora entre tus prendas.',
            completed: false,
            actionRoute: '/wardrobe',
          },
        ],
      },
      {
        weekNumber: 4,
        title: 'Semana 4: Ensayo Final y Evaluación',
        objective: 'Superar los 85 puntos en el conjunto definitivo.',
        completed: false,
        tasks: [
          {
            id: 't-4-1',
            title: 'Evaluación del look completo',
            description: 'Pruébate el outfit completo y valida que no haya penalizaciones de contraste o temperatura.',
            completed: false,
            actionRoute: '/',
          },
        ],
      },
    ];

    return {
      id: `goal-${Date.now()}`,
      title: eventTitle,
      targetEvent: eventTitle,
      deadlineDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      weeksRemaining: 4,
      progressPercentage: 0,
      milestones,
      createdAt: new Date().toISOString(),
    };
  }

  static async getActiveGoal(diagnostic?: DiagnosticResult): Promise<AuraGoal> {
    try {
      const remoteChallenge = await bellaiService.getActiveChallenge().catch(() => null);
      if (remoteChallenge) {
        const tasks = remoteChallenge.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: 'Actividad del reto semanal.',
          completed: Boolean(task.completedAt),
        }));
        const completed = tasks.filter((task) => task.completed).length;
        return {
          id: remoteChallenge.id,
          title: remoteChallenge.title,
          targetEvent: remoteChallenge.title,
          deadlineDate: remoteChallenge.end,
          weeksRemaining: Math.max(0, Math.ceil((new Date(remoteChallenge.end).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))),
          progressPercentage: Math.round((completed / Math.max(1, tasks.length)) * 100),
          milestones: [{ weekNumber: 1, title: `Semana 1: ${remoteChallenge.title}`, objective: remoteChallenge.description || 'Completa las actividades propuestas.', completed: completed === tasks.length, tasks }],
          createdAt: remoteChallenge.start,
        };
      }
      const raw = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
      if (!raw) {
        const defaultGoal = this.generateDefaultGoal(diagnostic);
        await this.saveGoal(defaultGoal);
        return defaultGoal;
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[AURA Goal] Error cargando meta:', e);
      return this.generateDefaultGoal(diagnostic);
    }
  }

  static async saveGoal(goal: AuraGoal): Promise<void> {
    try {
      await AsyncStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal));
    } catch (e) {
      console.error('[AURA Goal] Error guardando meta:', e);
    }
  }

  static async toggleTask(taskId: string, diagnostic?: DiagnosticResult): Promise<AuraGoal> {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
      const remote = await this.getActiveGoal(diagnostic);
      const current = remote.milestones.flatMap((milestone) => milestone.tasks).find((task) => task.id === taskId);
      await bellaiService.setChallengeTask(taskId, !current?.completed);
      return this.getActiveGoal(diagnostic);
    }
    const goal = await this.getActiveGoal(diagnostic);
    let totalTasks = 0;
    let completedTasks = 0;

    goal.milestones.forEach((m) => {
      m.tasks.forEach((t) => {
        totalTasks++;
        if (t.id === taskId) {
          t.completed = !t.completed;
        }
        if (t.completed) completedTasks++;
      });
      m.completed = m.tasks.every((t) => t.completed);
    });

    goal.progressPercentage = Math.round((completedTasks / Math.max(1, totalTasks)) * 100);
    await this.saveGoal(goal);
    return goal;
  }
}
