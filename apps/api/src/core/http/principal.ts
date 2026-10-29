import type { TokenScope } from '@tasklore/shared';

/**
 * Who is making a request, resolved by the AuthGuard from a session cookie or a bearer token.
 * MCP tools act as the token's owner with its scopes, marked as `mcp` in history (E-52).
 */
export type Principal =
  | { userId: string; via: 'session'; sessionId: string }
  | { userId: string; via: 'token' | 'mcp'; tokenId: string; scopes: readonly TokenScope[] };

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
