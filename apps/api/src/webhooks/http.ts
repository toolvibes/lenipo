import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

/** Addresses webhooks may not reach unless private networks are allowed (SSRF, E-45). */
const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv6');
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  // IPv4 addresses written as IPv6 (::ffff:127.0.0.1) are checked as IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped?.[1]) return PRIVATE.check(mapped[1], 'ipv4');
  return PRIVATE.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class BlockedAddressError extends Error {
  constructor(address: string) {
    super(`The target resolves to the private address ${address}, which webhooks may not reach`);
  }
}

/** DNS lookup that refuses private addresses, used when connecting (no DNS-rebinding gap). */
function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number | string },
  callback: (error: Error | null, address: string | LookupAddress[], family?: number) => void,
): void {
  dnsLookup(hostname, { ...options, all: true } as { all: true }, (error, addresses) => {
    if (error) {
      callback(error, '');
      return;
    }
    const blocked = addresses.find((entry) => isPrivateAddress(entry.address));
    if (blocked) {
      callback(new BlockedAddressError(blocked.address), '');
      return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0]?.address ?? '', addresses[0]?.family);
  });
}

export interface PostResult {
  status: number;
  body: string;
  durationMs: number;
}

const BODY_LIMIT = 1_024;

/**
 * POSTs a JSON body without following redirects, with a timeout, keeping only the start of
 * the response for the delivery log.
 */
export function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
  options: { allowPrivate: boolean; timeoutMs: number },
): Promise<PostResult> {
  const target = new URL(url);
  const host = target.hostname.replace(/^\[|\]$/g, '');
  if (!options.allowPrivate && isIP(host) && isPrivateAddress(host)) {
    return Promise.reject(new BlockedAddressError(host));
  }
  const started = Date.now();
  const client = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      target,
      {
        method: 'POST',
        headers: { ...headers, 'content-length': Buffer.byteLength(body) },
        ...(options.allowPrivate ? {} : { lookup: guardedLookup as never }),
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          if (size < BODY_LIMIT) chunks.push(chunk);
          size += chunk.length;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8').slice(0, BODY_LIMIT),
            durationMs: Date.now() - started,
          }),
        );
        response.on('error', reject);
      },
    );
    request.setTimeout(options.timeoutMs, () =>
      request.destroy(new Error(`No answer within ${options.timeoutMs / 1000} s`)),
    );
    request.on('error', reject);
    request.end(body);
  });
}
