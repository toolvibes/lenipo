import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import '../app.module.js';
import { buildOpenApiDocument } from './document.js';

type Operation = {
  security?: unknown[];
  parameters?: Array<{ name: string }>;
  requestBody?: unknown;
  responses: Record<string, unknown>;
};
const document = buildOpenApiDocument('test') as {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
};

describe('OpenAPI document', () => {
  it('describes every identity route under /api/v1', () => {
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/me',
        '/api/v1/auth/login',
        '/api/v1/setup',
        '/api/v1/me/tokens/{id}',
        '/api/v1/admin/groups/{name}/members/{userId}',
      ]),
    );
  });

  it('marks public routes as needing no credentials', () => {
    expect(document.paths['/api/v1/auth/login']?.post?.security).toEqual([]);
    expect(document.paths['/api/v1/me']?.get?.security).toBeUndefined();
  });

  it('declares path parameters and request bodies', () => {
    const operation = document.paths['/api/v1/admin/groups/{name}/members/{userId}']?.delete;
    expect(operation?.parameters?.map((parameter) => parameter.name)).toEqual(['name', 'userId']);
    expect(document.paths['/api/v1/me/tokens']?.post?.requestBody).toBeDefined();
    expect(document.paths['/api/v1/auth/logout']?.post?.responses['204']).toBeDefined();
  });

  it('only references components that exist', () => {
    const refs = [
      ...JSON.stringify(document).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g),
    ].map((match) => match[1]);
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of refs) {
      expect(document.components.schemas).toHaveProperty(ref as string);
    }
  });
});
