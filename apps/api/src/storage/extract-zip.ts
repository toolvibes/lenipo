import { closeSync, createReadStream, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';

/** Unpacks a ZIP into a directory, entry by entry, leaving out names that are not `wanted`. */
export function extractZip(
  zipPath: string,
  target: string,
  wanted: (name: string) => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let failed = false;
    const fail = (error: Error) => {
      failed = true;
      reject(error);
    };
    const unzip = new Unzip((file) => {
      const name = file.name;
      if (!wanted(name)) return;
      const path = join(target, name);
      mkdirSync(dirname(path), { recursive: true });
      const fd = openSync(path, 'w');
      file.ondata = (error, chunk, final) => {
        if (failed) return;
        if (error) return fail(error);
        writeSync(fd, chunk);
        if (final) closeSync(fd);
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    unzip.register(UnzipPassThrough);
    const input = createReadStream(zipPath);
    input.on('data', (chunk) => {
      try {
        unzip.push(chunk as Uint8Array);
      } catch (error) {
        input.destroy();
        fail(error as Error);
      }
    });
    input.on('end', () => {
      unzip.push(new Uint8Array(0), true);
      if (!failed) resolve();
    });
    input.on('error', fail);
  });
}
