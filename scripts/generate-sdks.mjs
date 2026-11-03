#!/usr/bin/env node
// Python and Go clients from the same OpenAPI document as the TypeScript SDK (D-SDK-02).
// Needs uv (for Python) and Go. Generated code is committed; run after `pnpm api:generate`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = join(root, 'packages/sdk/openapi.json');
// Pinned: at least two weeks old, permissive licences (MIT, Apache-2.0).
const PYTHON_GENERATOR = 'openapi-python-client==0.29.1';
const GO_GENERATOR = 'github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.8.0';

function run(command, args, cwd) {
  if (!existsSync(cwd)) {
    console.error(`Missing directory ${cwd}`);
    process.exit(1);
  }
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const only = process.argv[2];
if (!only || only === 'python') {
  run(
    'uvx',
    [
      '--from',
      PYTHON_GENERATOR,
      'openapi-python-client',
      'generate',
      '--path',
      spec,
      '--config',
      'config.yaml',
      '--output-path',
      'client',
      '--overwrite',
    ],
    join(root, 'sdks/python'),
  );
}
if (!only || only === 'go') {
  run('go', ['run', GO_GENERATOR, '-config', 'oapi-codegen.yaml', spec], join(root, 'sdks/go'));
  run('go', ['mod', 'tidy'], join(root, 'sdks/go'));
}
