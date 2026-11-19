import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/** Credenciales de demostración precargadas en el formulario de login. */
export const CREDENCIALES_DEMO: LoginFormValues = {
  email: 'valeria@bellia.com',
  password: '123456789',
};
