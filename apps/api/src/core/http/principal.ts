import type { TokenScope } from '@toolvibes/shared';

/**
 * Who is making a request, resolved by the AuthGuard from a session cookie or a bearer token.
 * MCP tools act as the token's owner with its scopes, marked as `mcp` in history (E-52).
 */
export type Principal =
  | { userId: string; via: 'session'; sessionId: string; stage?: string }
  | { userId: string; via: 'token' | 'mcp'; tokenId: string; scopes: readonly TokenScope[] }
  /** Automation rules act as their built-in actor (TL-22, E-103). */
  | { userId: string; via: 'automation'; ruleId: string }
  /** The sender of a mail to a project's mailbox, with that person's rights (TL-53, E-142). */
  | { userId: string; via: 'mail'; projectId: string };

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
