export type AppErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'invalid_credentials'
  | 'email_taken'
  | 'validation'
  | 'invoice_locked'
  | 'invalid_invite';

/** Error with a user-facing Portuguese message. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return 'Algo deu errado. Tente novamente.';
}
