import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Correo electrónico inválido'),
  role: z.enum(['admin', 'manager', 'user']),
  status: z.enum(['active', 'inactive']),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export type UserFormValues = z.infer<typeof userSchema>;
