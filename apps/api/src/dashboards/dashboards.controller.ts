import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  AddGadgetRequest,
  ArrangeGadgetsRequest,
  AverageAge,
  ControlChart,
  CopyDashboardRequest,
  CreateDashboardRequest,
  CreatedResolved,
  CreatedResolvedRequest,
  Dashboard,
  DashboardListQuery,
  DashboardSummary,
  FieldSeries,
  FieldSeriesRequest,
  PeriodRequest,
  ScopeProgress,
  ScopeProgressRequest,
  Statistics,
  StatisticsRequest,
  TimePivot,
  TimePivotRequest,
  TimeReport,
  TimeReportRequest,
  UpdateDashboardRequest,
  UpdateGadgetRequest,
} from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { AnalysisService } from './analysis.service.js';
import { DashboardService } from './dashboard.service.js';
import { StatisticsService } from './statistics.service.js';

/** Unknown and malformed ids are both "not found". */
const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@RequireModule('dashboards')
@Controller()
export class DashboardsController {
  constructor(
    @Inject(DashboardService) private readonly dashboards: DashboardService,
    @Inject(StatisticsService) private readonly statistics: StatisticsService,
    @Inject(AnalysisService) private readonly analysis: AnalysisService,
  ) {}

  @Endpoint({
    tag: 'Dashboards',
    summary: 'List dashboards the caller can see',
    response: z.array(DashboardSummary),
  })
  @Get('dashboards')
  list(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(DashboardListQuery) query: DashboardListQuery,
  ): Promise<DashboardSummary[]> {
    return this.dashboards.list(principal, query.scope);
  }

  @Endpoint({
    tag: 'Dashboards',
    summary: 'Create a dashboard',
    description: 'Sharing requires the global permission `share-filters`.',
    response: Dashboard,
  })
  @Post('dashboards')
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateDashboardRequest) body: CreateDashboardRequest,
  ): Promise<Dashboard> {
    return this.dashboards.create(principal, body);
  }

  @Endpoint({ tag: 'Dashboards', summary: 'Get a dashboard with its gadgets', response: Dashboard })
  @Get('dashboards/:id')
  get(@CurrentPrincipal() principal: Principal, @Param('id', Uuid) id: string): Promise<Dashboard> {
    return this.dashboards.get(principal, id);
  }

  @Endpoint({
    tag: 'Dashboards',
    summary: 'Change name, layout or shares (owner or administrator)',
    response: Dashboard,
  })
  @Patch('dashboards/:id')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @ValidBody(UpdateDashboardRequest) body: UpdateDashboardRequest,
  ): Promise<Dashboard> {
    return this.dashboards.update(principal, id, body);
  }

  @Endpoint({ tag: 'Dashboards', summary: 'Delete a dashboard (owner or administrator)' })
  @Delete('dashboards/:id')
  @HttpCode(204)
  delete(@CurrentPrincipal() principal: Principal, @Param('id', Uuid) id: string): Promise<void> {
    return this.dashboards.delete(principal, id);
  }

  @Endpoint({
    tag: 'Dashboards',
    summary: 'Copy a dashboard one can see as one’s own',
    response: Dashboard,
  })
  @Post('dashboards/:id/copy')
  @HttpCode(201)
  copy(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @ValidBody(CopyDashboardRequest) body: CopyDashboardRequest,
  ): Promise<Dashboard> {
    return this.dashboards.copy(principal, id, body);
  }

  @Endpoint({ tag: 'Dashboards', summary: 'Use a dashboard as one’s start page' })
  @Put('dashboards/:id/home')
  @HttpCode(204)
  home(@CurrentPrincipal() principal: Principal, @Param('id', Uuid) id: string): Promise<void> {
    return this.dashboards.setHome(principal, id, true);
  }

  @Endpoint({ tag: 'Dashboards', summary: 'Go back to the usual start page' })
  @Delete('dashboards/:id/home')
  @HttpCode(204)
  unhome(@CurrentPrincipal() principal: Principal, @Param('id', Uuid) id: string): Promise<void> {
    return this.dashboards.setHome(principal, id, false);
  }

  @Endpoint({
    tag: 'Dashboards',
    summary: 'Add a gadget on top of a column',
    response: Dashboard,
  })
  @Post('dashboards/:id/gadgets')
  @HttpCode(201)
  addGadget(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @ValidBody(AddGadgetRequest) body: AddGadgetRequest,
  ): Promise<Dashboard> {
    return this.dashboards.addGadget(principal, id, body);
  }

  @Endpoint({
    tag: 'Dashboards',
    summary: 'Change a gadget’s title or settings',
    response: Dashboard,
  })
  @Patch('dashboards/:id/gadgets/:gadgetId')
  updateGadget(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Param('gadgetId', Uuid) gadgetId: string,
    @ValidBody(UpdateGadgetRequest) body: UpdateGadgetRequest,
  ): Promise<Dashboard> {
    return this.dashboards.updateGadget(principal, id, gadgetId, body);
  }

  @Endpoint({ tag: 'Dashboards', summary: 'Remove a gadget' })
  @Delete('dashboards/:id/gadgets/:gadgetId')
  @HttpCode(204)
  removeGadget(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Param('gadgetId', Uuid) gadgetId: string,
  ): Promise<void> {
    return this.dashboards.removeGadget(principal, id, gadgetId);
  }

  @Endpoint({ tag: 'Dashboards', summary: 'Rearrange the gadgets', response: Dashboard })
  @Put('dashboards/:id/arrangement')
  arrange(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @ValidBody(ArrangeGadgetsRequest) body: ArrangeGadgetsRequest,
  ): Promise<Dashboard> {
    return this.dashboards.arrange(principal, id, body);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Count issues of a TQL query by one or two fields',
    response: Statistics,
  })
  @Post('reports/statistics')
  @HttpCode(200)
  stats(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(StatisticsRequest) body: StatisticsRequest,
  ): Promise<Statistics> {
    return this.statistics.statistics(principal, body);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Issues created and resolved per day for a TQL query',
    response: CreatedResolved,
  })
  @Post('reports/created-vs-resolved')
  @HttpCode(200)
  createdResolved(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreatedResolvedRequest) body: CreatedResolvedRequest,
  ): Promise<CreatedResolved> {
    return this.statistics.createdResolved(principal, body);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Issues per value of a field at the end of each day (cumulative flow)',
    response: FieldSeries,
  })
  @Post('reports/field-series')
  @HttpCode(200)
  fieldSeries(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(FieldSeriesRequest) body: FieldSeriesRequest,
  ): Promise<FieldSeries> {
    return this.analysis.fieldSeries(principal, body);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Lead and cycle time of issues resolved in a period',
    response: ControlChart,
  })
  @Post('reports/control-chart')
  @HttpCode(200)
  controlChart(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(PeriodRequest) body: PeriodRequest,
  ): Promise<ControlChart> {
    return this.analysis.controlChart(principal, body);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Open issues and their average age per day',
    response: AverageAge,
  })
  @Post('reports/average-age')
  @HttpCode(200)
  averageAge(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(PeriodRequest) body: PeriodRequest,
  ): Promise<AverageAge> {
    return this.analysis.averageAge(principal, body);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Release burndown or epic report: scope and done work per closed sprint',
    response: ScopeProgress,
  })
  @Post('reports/scope-progress')
  @HttpCode(200)
  scopeProgress(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(ScopeProgressRequest) body: ScopeProgressRequest,
  ): Promise<ScopeProgress> {
    return this.analysis.scopeProgress(principal, body);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Estimates, time spent and time logged per issue and person',
    response: TimeReport,
  })
  @Post('reports/time-tracking')
  @HttpCode(200)
  timeReport(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(TimeReportRequest) body: TimeReportRequest,
  ): Promise<TimeReport> {
    return this.analysis.timeReport(principal, body);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Logged time grouped by issue, project, person or epic, per period',
    response: TimePivot,
  })
  @Post('reports/time-pivot')
  @HttpCode(200)
  timePivot(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(TimePivotRequest) body: TimePivotRequest,
  ): Promise<TimePivot> {
    return this.analysis.timePivot(principal, body);
  }
}
