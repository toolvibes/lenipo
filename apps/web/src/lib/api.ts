import { createLenipoClient } from '@toolvibes/sdk';
import type { Problem } from '@toolvibes/shared';

/** A failed API call, carrying the server's problem details (RFC 9457). */
export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }

  get status(): number {
    return this.problem.status;
  }
}

/** Typed client generated from the OpenAPI document (E-22); the browser authenticates with the session cookie. */
export const client = createLenipoClient();

/** Returns the response body or throws an ApiError with the problem details. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) {
    throw new ApiError(
      (error as Problem | undefined) ?? {
        type: 'about:blank',
        title: response.statusText,
        status: response.status,
      },
    );
  }
  return data as T;
}
