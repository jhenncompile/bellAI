import { apiClient } from '@/shared/lib/axios';
import type { PaymentsOverview } from '../types/payments.types';

export const paymentsService = {
  async overview(): Promise<PaymentsOverview> {
    const { data } = await apiClient.get<PaymentsOverview>('/admin/payments');
    return data;
  },
};
