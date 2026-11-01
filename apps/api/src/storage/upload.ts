import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import busboy from 'busboy';
import type { Request } from 'express';

/** Raster formats shown inline; recognised by magic bytes, never by name or declared type. */
export function sniffImage(head: Buffer): string | null {
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  const ascii = head.subarray(0, 12).toString('latin1');
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return 'image/gif';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;

/** The type stored for a file: detected images and PDFs, otherwise the declared type if sane. */
export function contentTypeOf(head: Buffer, declared: string): { type: string; image: boolean } {
  const image = sniffImage(head);
  if (image) return { type: image, image: true };
  if (head.subarray(0, 5).toString('latin1') === '%PDF-')
    return { type: 'application/pdf', image: false };
  const normalized = declared.toLowerCase().split(';')[0]?.trim() ?? '';
  return { type: MIME.test(normalized) ? normalized : 'application/octet-stream', image: false };
}

/** A display name without path parts or control characters. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const printable = [...base].filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x20 && code !== 0x7f;
  });
  const cleaned = printable.join('').trim().slice(0, 200);
  return cleaned || 'datei';
}

export interface SpooledUpload {
  path: string;
  fileName: string;
  declaredType: string;
  size: number;
  sha256: string;
  /** The first bytes, for type detection. */
  head: Buffer;
}

/**
 * Receives one file from a multipart/form-data request (field "file") into a temporary file,
 * hashing it on the way. Larger files than `maxBytes` are refused with 413.
 */
export function receiveUpload(request: Request, maxBytes: number): Promise<SpooledUpload> {
  return new Promise((resolve, reject) => {
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: request.headers,
        limits: { files: 1, fileSize: maxBytes, fields: 5, parts: 6 },
        defParamCharset: 'utf8',
      });
    } catch {
      reject(new BadRequestException('Expected a multipart/form-data upload with a "file" field'));
      return;
    }

    const path = join(tmpdir(), `lenipo-upload-${randomUUID()}`);
    let upload: SpooledUpload | null = null;
    let written: Promise<void> | null = null;
    let tooLarge = false;
    const fail = (error: unknown) => {
      void rm(path, { force: true });
      reject(error);
    };

    parser.on('file', (field, stream, info) => {
      if (field !== 'file' || upload) {
        stream.resume();
        return;
      }
      const hash = createHash('sha256');
      const chunks: Buffer[] = [];
      let size = 0;
      let headLength = 0;
      const output = createWriteStream(path);
      stream.on('data', (chunk: Buffer) => {
        hash.update(chunk);
        size += chunk.length;
        if (headLength < 16) {
          chunks.push(chunk);
          headLength += chunk.length;
        }
      });
      stream.on('limit', () => {
        tooLarge = true;
      });
      written = new Promise((done, failed) => {
        output.on('finish', () => done());
        output.on('error', failed);
        stream.on('error', failed);
      });
      stream.pipe(output);
      upload = {
        path,
        fileName: cleanFileName(info.filename ?? ''),
        declaredType: info.mimeType ?? '',
        get size() {
          return size;
        },
        get sha256() {
          return hash.copy().digest('hex');
        },
        get head() {
          return Buffer.concat(chunks).subarray(0, 16);
        },
      };
    });

    parser.on('error', (error) => fail(new BadRequestException(`Upload failed: ${String(error)}`)));
    parser.on('close', () => {
      void (async () => {
        if (written) await written;
        if (tooLarge) {
          fail(
            new PayloadTooLargeException(
              `Files may be at most ${Math.round(maxBytes / 1024 / 1024)} MB`,
            ),
          );
          return;
        }
        if (!upload) {
          fail(new BadRequestException('The upload contains no "file" field'));
          return;
        }
        const finished = upload as SpooledUpload;
        if (finished.size === 0) {
          fail(new BadRequestException('The file is empty'));
          return;
        }
        resolve({
          path,
          fileName: finished.fileName,
          declaredType: finished.declaredType,
          size: finished.size,
          sha256: finished.sha256,
          head: finished.head,
        });
      })().catch(fail);
    });
    request.pipe(parser);
  });
}
