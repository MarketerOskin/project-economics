import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export interface AppErrorInit {
  code: string;
  httpStatus: number;
  /** Shown to the end user — must be human and in Russian. Never a stack trace or driver code. */
  userMessage: string;
  /** Optional internal detail for server logs only. */
  detail?: string;
}

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly userMessage: string;
  readonly detail?: string;

  constructor(init: AppErrorInit) {
    super(init.userMessage);
    this.name = 'AppError';
    this.code = init.code;
    this.httpStatus = init.httpStatus;
    this.userMessage = init.userMessage;
    this.detail = init.detail;
  }
}

export const badRequest = (msg = 'Некорректный запрос.') =>
  new AppError({ code: 'BAD_REQUEST', httpStatus: 400, userMessage: msg });

export const unauthorized = (msg = 'Требуется вход через Bitrix24.') =>
  new AppError({ code: 'UNAUTHORIZED', httpStatus: 401, userMessage: msg });

export const forbidden = (msg = 'Недостаточно прав для этого действия.') =>
  new AppError({ code: 'FORBIDDEN', httpStatus: 403, userMessage: msg });

export const notFound = (msg = 'Не найдено.') =>
  new AppError({ code: 'NOT_FOUND', httpStatus: 404, userMessage: msg });

export const conflict = (msg = 'Конфликт данных.') =>
  new AppError({ code: 'CONFLICT', httpStatus: 409, userMessage: msg });

export const upstream = (msg = 'Bitrix24 недоступен. Попробуйте позже.') =>
  new AppError({ code: 'UPSTREAM', httpStatus: 502, userMessage: msg });

export interface ErrorResponse {
  status: number;
  body: { error: { code: string; message: string; fields?: Record<string, string> } };
}

function zodToFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

const PRISMA_MAP: Record<string, { status: number; message: string; code: string }> = {
  P2002: { status: 409, message: 'Запись с такими данными уже существует.', code: 'CONFLICT' },
  P2025: { status: 404, message: 'Запись не найдена.', code: 'NOT_FOUND' },
  P2003: { status: 409, message: 'Нельзя выполнить: есть связанные записи.', code: 'CONFLICT' },
};

/**
 * Maps any thrown value to a safe HTTP response. Never leaks Prisma codes, stack traces,
 * connection strings or ZodError internals to the client (ТЗ §39).
 */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof AppError) {
    return { status: err.httpStatus, body: { error: { code: err.code, message: err.userMessage } } };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION',
          message: 'Проверьте правильность заполнения полей.',
          fields: zodToFields(err),
        },
      },
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_MAP[err.code];
    if (mapped) {
      return { status: mapped.status, body: { error: { code: mapped.code, message: mapped.message } } };
    }
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {
      status: 503,
      body: { error: { code: 'DB_UNAVAILABLE', message: 'База данных временно недоступна.' } },
    };
  }

  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: 'Что-то пошло не так. Попробуйте ещё раз.' } },
  };
}
