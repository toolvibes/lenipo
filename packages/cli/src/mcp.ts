import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Io, Session } from './session.js';

/**
 * A local stdio MCP server that forwards every message to the instance's /mcp (D-MCP-02,
 * E-117), for clients that only start programs; the token is refreshed as needed.
 */
export async function bridge(session: Session, io: Io): Promise<void> {
  const remote = new StreamableHTTPClientTransport(new URL(`${session.url}/mcp`), {
    fetch: session.authorizedFetch,
  });
  const local = new StdioServerTransport(
    io.stdin as NodeJS.ReadStream | undefined,
    io.stdout as NodeJS.WriteStream | undefined,
  );
  local.onmessage = (message) => {
    remote.send(message).catch((error: unknown) => io.err(`MCP: ${String(error)}`));
  };
  remote.onmessage = (message) => {
    void local.send(message);
  };
  remote.onerror = (error) => io.err(`MCP: ${error.message}`);
  await remote.start();
  await local.start();
  // The client ends the session by closing stdin.
  const input = (io.stdin ?? process.stdin) as NodeJS.ReadableStream;
  await new Promise<void>((resolve) => {
    local.onclose = () => resolve();
    input.once('end', () => void local.close());
  });
  await remote.close();
}
