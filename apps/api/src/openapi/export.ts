import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
// Importing the module tree registers every controller and its @Endpoint metadata.
import '../app.module.js';
import { buildOpenApiDocument } from './document.js';
import { API_VERSION } from './version.js';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node dist/openapi/export.js <output.json>');
  process.exit(1);
}
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(API_VERSION), null, 2)}\n`);
console.log(`Wrote ${target}`);
