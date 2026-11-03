import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppsModule } from './apps/apps.module.js';
import { AutomationModule } from './automation/automation.module.js';
import { BoardsModule } from './boards/boards.module.js';
import type { AppConfig } from './core/config.js';
import { CoreModule } from './core/core.module.js';
import { ProblemFilter } from './core/http/problem.filter.js';
import type { Logger } from './core/logger.js';
import { DashboardsModule } from './dashboards/dashboards.module.js';
import type { DatabaseHandle } from './db/client.js';
import { EventsModule } from './events/events.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { GitModule } from './git/git.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { JiraCompatModule } from './jiracompat/jira-compat.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { OpenApiController } from './openapi/openapi.controller.js';
import { PersonalModule } from './personal/personal.module.js';
import { PlanningModule } from './planning/planning.module.js';
import { PresenceModule } from './presence/presence.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ReleasesModule } from './releases/releases.module.js';
import { ScimModule } from './scim/scim.module.js';
import { SearchModule } from './search/search.module.js';
import { ServiceDeskModule } from './servicedesk/servicedesk.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TrackingModule } from './tracking/tracking.module.js';
import { WikiModule } from './wiki/wiki.module.js';

export interface AppDependencies {
  config: AppConfig;
  database: DatabaseHandle;
  logger: Logger;
}

@Module({})
export class AppModule {
  static forRoot({ config, database, logger }: AppDependencies): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot(config, database, logger),
        LoggerModule.forRoot({
          pinoHttp: {
            logger,
            // Request logs carry no headers (cookies, tokens) and no query strings, where
            // feed, invitation and hook secrets travel (TL-44, E-125).
            serializers: {
              req: (request: { id?: unknown; method?: string; url?: string }) => ({
                id: request.id,
                method: request.method,
                url: request.url?.split('?')[0],
              }),
              res: (response: { statusCode?: number }) => ({ statusCode: response.statusCode }),
            },
          },
        }),
        HealthModule,
        StorageModule,
        IdentityModule,
        TrackingModule,
        SearchModule,
        PlanningModule,
        ServiceDeskModule,
        JiraCompatModule,
        AppsModule,
        ScimModule,
        ExportsModule,
        GitModule,
        ImportsModule,
        MaintenanceModule,
        InvitationsModule,
        EventsModule,
        PersonalModule,
        PresenceModule,
        BoardsModule,
        DashboardsModule,
        AutomationModule,
        ReleasesModule,
        WikiModule,
        OnboardingModule,
        McpModule,
        RealtimeModule,
      ],
      controllers: [OpenApiController],
      providers: [{ provide: APP_FILTER, useValue: new ProblemFilter(logger) }],
    };
  }
}
