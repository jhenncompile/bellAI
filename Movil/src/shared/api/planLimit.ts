/**
 * Topes del plan (HTTP 402 `PLAN_LIMIT`). Los clientes HTTP avisan aquí y el layout raíz
 * registra qué hacer: ofrecer el plan Premium. Igual que `setUnauthorizedHandler` con el 401.
 */
export interface PlanLimitInfo {
  feature?: 'assistant_day' | 'simulations_month' | 'wardrobe_items' | string;
  limit?: number;
  message: string;
}

let handler: ((info: PlanLimitInfo) => void) | null = null;

export const setPlanLimitHandler = (next: ((info: PlanLimitInfo) => void) | null) => {
  handler = next;
};

/** true si el cuerpo de la respuesta es el 402 de tope del plan. */
export const isPlanLimitBody = (body: any): boolean => body?.code === 'PLAN_LIMIT';

/** Lo llaman los clientes HTTP al recibir un 402 `PLAN_LIMIT`. */
export const notifyPlanLimit = (body: any) => {
  if (!isPlanLimitBody(body)) return;
  const message = typeof body?.message === 'string' ? body.message : 'Llegaste al límite de tu plan.';
  handler?.({ feature: body.feature, limit: body.limit, message });
};
