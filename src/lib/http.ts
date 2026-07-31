import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { success: false, error: { message, code: code ?? null } },
    { status },
  );
}

/** Standard mapping for thrown errors inside route handlers. */
export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: err.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }
  if (err instanceof HttpError) {
    return fail(err.message, err.status, err.code);
  }
  console.error('Unhandled API error:', err);
  return fail('Internal server error', 500, 'INTERNAL_ERROR');
}

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
