import { Controller, Get, HttpCode, Inject, Post, Put } from '@nestjs/common';
import {
  AiSettings,
  AiTestResult,
  SemanticStatus,
  UpdateAiSettingsRequest,
} from '@toolvibes/shared';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { AiService } from './ai.service.js';
import { SemanticService } from './semantic.service.js';

/** Setting up the language model (TL-49, E-139). */
@RequireGlobal('admin')
@Controller('admin/ai')
export class AiAdminController {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(SemanticService) private readonly semantic: SemanticService,
  ) {}

  private async settings(): Promise<AiSettings> {
    const config = await this.ai.config();
    const [usedToday, vectorAvailable, indexed] = await Promise.all([
      this.ai.usedToday(),
      this.semantic.vectorAvailable(),
      this.semantic.indexedCounts(),
    ]);
    return {
      baseUrl: config.baseUrl,
      hasApiKey: config.apiKey !== '',
      chatModel: config.chatModel,
      embeddingModel: config.embeddingModel,
      dailyLimit: config.dailyLimit,
      usedToday,
      vectorAvailable,
      indexed,
    };
  }

  @Endpoint({
    tag: 'Admin',
    summary: 'The language model for semantic search and the AI action',
    response: AiSettings,
  })
  @Get()
  getAiSettings(): Promise<AiSettings> {
    return this.settings();
  }

  @Endpoint({ tag: 'Admin', summary: 'Set up the language model', response: AiSettings })
  @Put()
  async setAiSettings(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(UpdateAiSettingsRequest) body: UpdateAiSettingsRequest,
  ): Promise<AiSettings> {
    await this.ai.save(principal, body);
    return this.settings();
  }

  @Endpoint({
    tag: 'Admin',
    summary: 'Try the chat and the embedding model once',
    response: AiTestResult,
  })
  @Post('test')
  @HttpCode(200)
  testAi(): Promise<AiTestResult> {
    return this.ai.test();
  }
}

/** Whether searches by meaning work, for every signed-in person. */
@Controller('search')
export class SemanticStatusController {
  constructor(@Inject(SemanticService) private readonly semantic: SemanticService) {}

  @Endpoint({
    tag: 'Search',
    summary: 'Whether search by meaning is available',
    response: SemanticStatus,
  })
  @Get('semantic-status')
  async semanticStatus(): Promise<SemanticStatus> {
    return { available: await this.semantic.available() };
  }
}
