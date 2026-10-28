import type { Problem } from '@tasklore/shared';

/** A failed API call, carrying the server's problem details (RFC 9457). */
export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }

  get status(): number {
    return this.problem.status;
  }
}

/**
 * Minimal JSON client for the Tasklore API using the session cookie.
 * Replaced by the generated openapi-fetch client once the OpenAPI document exists (E-22).
 */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(
      (data as Problem | undefined) ?? {
        type: 'about:blank',
        title: response.statusText,
        status: response.status,
      },
    );
  }
  return data as T;
}
