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
  ApplyScenarioRequest,
  ApplyScenarioResult,
  CreatePlanRequest,
  CreateScenarioRequest,
  Plan,
  PlanScenario,
  PlanSummary,
  PlanView,
  ScenarioChange,
  SetCapacityRequest,
  UpdatePlanRequest,
} from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { PlanService } from './plan.service.js';

const PlanId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });
const ViewQuery = z.object({ scenario: z.uuid().optional() });
type ViewQuery = z.infer<typeof ViewQuery>;

/** Cross-project plans with capacity and scenarios (T-RDM-03, T-RDM-04, TL-46, E-136). */
@Controller('plans')
export class PlansController {
  constructor(@Inject(PlanService) private readonly plans: PlanService) {}

  @Endpoint({ tag: 'Plans', summary: 'List the plans', response: z.array(PlanSummary) })
  @Get()
  listPlans(@CurrentPrincipal() principal: Principal) {
    return this.plans.list(principal);
  }

  @Endpoint({ tag: 'Plans', summary: 'Create a plan over several projects', response: Plan })
  @Post()
  @HttpCode(201)
  createPlan(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreatePlanRequest) body: CreatePlanRequest,
  ) {
    return this.plans.create(principal, body);
  }

  @Endpoint({ tag: 'Plans', summary: 'Get a plan', response: Plan })
  @Get(':id')
  getPlan(@CurrentPrincipal() principal: Principal, @Param('id', PlanId) id: string) {
    return this.plans.get(principal, id);
  }

  @Endpoint({
    tag: 'Plans',
    summary: 'The plan: epics of its projects, capacity, scenarios; optionally as a scenario',
    response: PlanView,
  })
  @Get(':id/view')
  viewPlan(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PlanId) id: string,
    @ValidQuery(ViewQuery) query: ViewQuery,
  ) {
    return this.plans.view(principal, id, query.scenario ?? null);
  }

  @Endpoint({ tag: 'Plans', summary: 'Change a plan (owner and admins)', response: Plan })
  @Patch(':id')
  updatePlan(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PlanId) id: string,
    @ValidBody(UpdatePlanRequest) body: UpdatePlanRequest,
  ) {
    return this.plans.update(principal, id, body);
  }

  @Endpoint({ tag: 'Plans', summary: 'Delete a plan (owner and admins)' })
  @Delete(':id')
  @HttpCode(204)
  deletePlan(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PlanId) id: string,
  ): Promise<void> {
    return this.plans.remove(principal, id);
  }

  @Endpoint({ tag: 'Plans', summary: 'Set the capacity of a project for a month' })
  @Put(':id/capacity')
  @HttpCode(204)
  setCapacity(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PlanId) id: string,
    @ValidBody(SetCapacityRequest) body: SetCapacityRequest,
  ): Promise<void> {
    return this.plans.setCapacity(principal, id, body);
  }

  @Endpoint({ tag: 'Plans', summary: 'Add a what-if scenario', response: PlanScenario })
  @Post(':id/scenarios')
  @HttpCode(201)
  createScenario(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PlanId) id: string,
    @ValidBody(CreateScenarioRequest) body: CreateScenarioRequest,
  ) {
    return this.plans.createScenario(principal, id, body.name);
  }

  @Endpoint({ tag: 'Plans', summary: 'Delete a scenario with its changes' })
  @Delete(':id/scenarios/:scenarioId')
  @HttpCode(204)
  deleteScenario(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PlanId) id: string,
    @Param('scenarioId', PlanId) scenarioId: string,
  ): Promise<void> {
    return this.plans.removeScenario(principal, id, scenarioId);
  }

  @Endpoint({
    tag: 'Plans',
    summary: 'Record what the scenario changes on an issue',
    description: 'Start date, due date and story points; an empty object removes the change.',
    response: PlanScenario,
  })
  @Put(':id/scenarios/:scenarioId/changes/:key')
  setChange(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PlanId) id: string,
    @Param('scenarioId', PlanId) scenarioId: string,
    @Param('key') key: string,
    @ValidBody(ScenarioChange) body: ScenarioChange,
  ) {
    return this.plans.setChange(principal, id, scenarioId, key, body);
  }

  @Endpoint({
    tag: 'Plans',
    summary: 'Apply the scenario to the real issues',
    description:
      'All changes or the given issues. Changes the caller may not make, or to issues edited since, are skipped and listed.',
    response: ApplyScenarioResult,
  })
  @Post(':id/scenarios/:scenarioId/apply')
  @HttpCode(200)
  applyScenario(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PlanId) id: string,
    @Param('scenarioId', PlanId) scenarioId: string,
    @ValidBody(ApplyScenarioRequest) body: ApplyScenarioRequest,
  ) {
    return this.plans.apply(principal, id, scenarioId, body.issueKeys);
  }
}
