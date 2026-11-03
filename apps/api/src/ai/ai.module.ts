import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { AiAdminController, SemanticStatusController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { SemanticService } from './semantic.service.js';

/** Language model, embeddings and semantic search (TL-49, E-139). */
@Module({
  imports: [IdentityModule],
  controllers: [AiAdminController, SemanticStatusController],
  providers: [AiService, SemanticService],
  exports: [AiService, SemanticService],
})
export class AiModule {}
