import { Controller, Get } from '@nestjs/common';
import { Public } from '../core/http/decorators.js';
import { buildOpenApiDocument } from './document.js';
import { API_VERSION } from './version.js';

@Public()
@Controller()
export class OpenApiController {
  private document: Record<string, unknown> | undefined;

  /** The machine-readable API description used by the SDK, the CLI and MCP tooling. */
  @Get('openapi.json')
  openapi(): Record<string, unknown> {
    this.document ??= buildOpenApiDocument(API_VERSION);
    return this.document;
  }
}
