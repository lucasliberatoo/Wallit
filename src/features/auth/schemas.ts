import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome'),
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(6, 'A senha precisa ter ao menos 6 caracteres'),
});

export const resetSchema = z.object({
  email: z.string().trim().email('Email inválido'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ResetValues = z.infer<typeof resetSchema>;
