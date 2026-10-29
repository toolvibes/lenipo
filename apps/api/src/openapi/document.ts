import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { Problem } from '@tasklore/shared';
import { z } from 'zod';
import { REQUIRED_GLOBAL } from '../access/require-global.js';
import { IS_PUBLIC } from '../core/http/decorators.js';
import { bodySchemas, endpointRegistry, querySchemas } from '../core/http/endpoint.js';

const METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;
const API_PREFIX = '/api/v1';

type JsonSchema = Record<string, unknown>;

/** Collects named schemas (Zod `.meta({ id })`) as OpenAPI components and returns references. */
class Components {
  readonly schemas: Record<string, JsonSchema> = {};

  /** Converts a schema; `$defs` become components, refs are rewritten to point at them. */
  add(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
    const converted = z.toJSONSchema(schema, {
      io,
      target: 'draft-2020-12',
      unrepresentable: 'any',
    }) as JsonSchema;
    const defs = (converted.$defs ?? {}) as Record<string, JsonSchema>;
    delete converted.$defs;
    delete converted.$schema;

    const rewriteWith =
      (renames: Map<string, string>) =>
      (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(rewriteWith(renames));
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([key, inner]) => {
              if (key === '$ref' && typeof inner === 'string' && inner.startsWith('#/$defs/')) {
                const name = inner.slice('#/$defs/'.length);
                return [key, `#/components/schemas/${renames.get(name) ?? name}`];
              }
              return [key, rewriteWith(renames)(inner)];
            }),
          );
        }
        return value;
      };

    // The same id can differ between request (input) and response (output), e.g. with defaults.
    // Compare in component form; a differing variant gets an Input/Output suffix.
    const plain = rewriteWith(new Map());
    const renames = new Map<string, string>();
    for (const [name, definition] of Object.entries(defs)) {
      const existing = this.schemas[name];
      const differs =
        existing !== undefined && JSON.stringify(existing) !== JSON.stringify(plain(definition));
      renames.set(name, differs ? `${name}${io === 'input' ? 'Input' : 'Output'}` : name);
    }
    const rewrite = rewriteWith(renames);
    for (const [name, definition] of Object.entries(defs)) {
      this.schemas[renames.get(name) ?? name] = rewrite(definition) as JsonSchema;
    }
    return rewrite(converted) as JsonSchema;
  }
}

function joinPath(...parts: Array<string | undefined>): string {
  const path = parts
    .flatMap((part) => (part ?? '').split('/'))
    .filter(Boolean)
    .map((segment) => (segment.startsWith(':') ? `{${segment.slice(1)}}` : segment))
    .join('/');
  return `${API_PREFIX}/${path}`;
}

function defaultStatus(method: string): number {
  return method === 'post' ? 201 : 200;
}

/** Builds the OpenAPI 3.1 document from Nest route metadata, @Endpoint and @ValidBody. */
export function buildOpenApiDocument(version: string): Record<string, unknown> {
  const components = new Components();
  const problemRef = components.add(Problem, 'output');
  const paths: Record<string, Record<string, unknown>> = {};

  const sorted = [...endpointRegistry].sort((a, b) => a.spec.tag.localeCompare(b.spec.tag));
  for (const { controller, handler, spec } of sorted) {
    const method = (controller as { prototype: Record<string, object> }).prototype[handler];
    if (!method) continue;
    const verb = METHODS[Reflect.getMetadata(METHOD_METADATA, method) as number];
    if (!verb) throw new Error(`Unsupported HTTP method on ${handler}`);
    const path = joinPath(
      Reflect.getMetadata(PATH_METADATA, controller),
      Reflect.getMetadata(PATH_METADATA, method),
    );
    const status =
      (Reflect.getMetadata(HTTP_CODE_METADATA, method) as number | undefined) ??
      defaultStatus(verb);
    const isPublic =
      Reflect.getMetadata(IS_PUBLIC, method) ?? Reflect.getMetadata(IS_PUBLIC, controller) ?? false;
    const permission =
      Reflect.getMetadata(REQUIRED_GLOBAL, method) ??
      Reflect.getMetadata(REQUIRED_GLOBAL, controller);
    const body = bodySchemas.get(controller)?.get(handler);

    const pathParameters = [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const query = querySchemas.get(controller)?.get(handler);
    const queryParameters = query
      ? Object.entries(query.shape).map(([name, field]) => ({
          name,
          in: 'query',
          required: !(field as z.ZodType).safeParse(undefined).success,
          schema: components.add(field as z.ZodType, 'input'),
        }))
      : [];
    const parameters = [...pathParameters, ...queryParameters];
    const description = [
      spec.description,
      permission ? `Requires the global permission \`${permission}\`.` : undefined,
    ]
      .filter(Boolean)
      .join('\n\n');

    paths[path] ??= {};
    paths[path][verb] = {
      operationId: `${spec.tag}.${handler}`,
      summary: spec.summary,
      ...(description ? { description } : {}),
      tags: [spec.tag],
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(isPublic ? { security: [] } : {}),
      ...(body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: components.add(body, 'input') } },
            },
          }
        : {}),
      ...(spec.upload
        ? {
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: { [spec.upload]: { type: 'string', format: 'binary' } },
                    required: [spec.upload],
                  },
                },
              },
            },
          }
        : {}),
      responses: {
        [String(status)]: spec.binary
          ? {
              description: 'The file content',
              content: {
                'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
              },
            }
          : spec.response
            ? {
                description: 'Success',
                content: {
                  'application/json': { schema: components.add(spec.response, 'output') },
                },
              }
            : { description: 'Success, no content' },
        default: {
          description: 'Error (RFC 9457 problem details)',
          content: { 'application/problem+json': { schema: problemRef } },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Tasklore API',
      version,
      description:
        'REST API of Tasklore. Browsers authenticate with the session cookie; scripts, the CLI and MCP clients with a personal access token (`Authorization: Bearer tl_pat_…`).',
    },
    servers: [{ url: '/' }],
    security: [{ sessionCookie: [] }, { bearerToken: [] }],
    paths,
    components: {
      schemas: components.schemas,
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'tl_session' },
        bearerToken: {
          type: 'http',
          scheme: 'bearer',
          description: 'Personal access token (tl_pat_…)',
        },
      },
    },
  };
}
