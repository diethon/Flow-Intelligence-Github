export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly context: Record<string, unknown>;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    context: Record<string, unknown> = {},
    retryable: boolean = false,
    retryAfter?: number
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
    this.retryable = retryable;
    this.retryAfter = retryAfter;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};
