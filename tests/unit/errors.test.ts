import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, forbidden, notFound, toErrorResponse } from '@/lib/errors';

describe('toErrorResponse', () => {
  it('passes an AppError through with its status and user message', () => {
    const r = toErrorResponse(forbidden());
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
    expect(r.body.error.message).toBeTruthy();
  });

  it('maps ZodError to 400 with a human message', () => {
    const parsed = z.object({ amount: z.number().positive() }).safeParse({ amount: -1 });
    expect(parsed.success).toBe(false);
    const r = toErrorResponse(parsed.error);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION');
    expect(r.body.error.message).not.toMatch(/ZodError/);
  });

  it('maps Prisma P2002 (unique) to 409 without leaking the code', () => {
    const err = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P2002',
      clientVersion: '6',
    });
    const r = toErrorResponse(err);
    expect(r.status).toBe(409);
    expect(r.body.error.message).not.toMatch(/P2002/);
  });

  it('maps Prisma P2025 (not found) to 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P2025',
      clientVersion: '6',
    });
    expect(toErrorResponse(err).status).toBe(404);
  });

  it('maps an unknown error to a generic 500 (no internals)', () => {
    const r = toErrorResponse(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    expect(r.status).toBe(500);
    expect(r.body.error.message).not.toMatch(/ECONNREFUSED/);
    expect(r.body.error.message).toBe('Что-то пошло не так. Попробуйте ещё раз.');
  });

  it('notFound carries a custom message', () => {
    expect(toErrorResponse(notFound('Проект не найден')).body.error.message).toBe(
      'Проект не найден',
    );
  });
});

describe('AppError', () => {
  it('is an Error with structured fields', () => {
    const e = new AppError({ code: 'X', httpStatus: 418, userMessage: 'teapot' });
    expect(e).toBeInstanceOf(Error);
    expect(e.httpStatus).toBe(418);
  });
});
