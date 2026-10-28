import type { z } from 'zod';

export interface EndpointSpec {
  /** One line, imperative, shown as the operation title. */
  summary: string;
  description?: string;
  tag: string;
  /** Success body; omit for 204 responses. */
  response?: z.ZodType;
}

export interface EndpointRecord {
  controller: object;
  handler: string;
  spec: EndpointSpec;
}

/** Collected at import time; the OpenAPI generator reads it together with Nest's route metadata. */
export const endpointRegistry: EndpointRecord[] = [];
export const bodySchemas = new Map<object, Map<string, z.ZodType>>();
export const querySchemas = new Map<object, Map<string, z.ZodObject>>();

/** Documents a route for OpenAPI, the SDK and MCP. Request bodies come from @ValidBody. */
export function Endpoint(spec: EndpointSpec): MethodDecorator {
  return (target, key) => {
    endpointRegistry.push({ controller: target.constructor, handler: String(key), spec });
  };
}

export function registerBodySchema(controller: object, handler: string, schema: z.ZodType): void {
  const handlers = bodySchemas.get(controller) ?? new Map<string, z.ZodType>();
  handlers.set(handler, schema);
  bodySchemas.set(controller, handlers);
}

export function registerQuerySchema(
  controller: object,
  handler: string,
  schema: z.ZodObject,
): void {
  const handlers = querySchemas.get(controller) ?? new Map<string, z.ZodObject>();
  handlers.set(handler, schema);
  querySchemas.set(controller, handlers);
}
