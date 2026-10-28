import type { TokenScope } from '@tasklore/shared';

/** Who is making a request, resolved by the AuthGuard from a session cookie or a bearer token. */
export type Principal =
  | { userId: string; via: 'session'; sessionId: string }
  | { userId: string; via: 'token'; tokenId: string; scopes: readonly TokenScope[] };

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
