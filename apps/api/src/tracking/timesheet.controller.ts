import { Controller, Delete, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import {
  StopTimerRequest,
  TimerState,
  Timesheet,
  TimesheetCellRequest,
  TimesheetQuery,
  Worklog,
} from '@tasklore/shared';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { TimesheetService } from './timesheet.service.js';

/** The weekly timesheet and the running timer (TL-24, E-105). */
@Controller()
export class TimesheetController {
  constructor(@Inject(TimesheetService) private readonly timesheets: TimesheetService) {}

  @Endpoint({
    tag: 'Time tracking',
    summary: "A person's logged time for one week, by issue and day",
    response: Timesheet,
  })
  @Get('timesheet')
  week(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(TimesheetQuery) query: TimesheetQuery,
  ): Promise<Timesheet> {
    return this.timesheets.week(principal, query);
  }

  @Endpoint({
    tag: 'Time tracking',
    summary: 'Set the time of one cell of one’s own timesheet',
    description: 'Creates the day’s worklog, changes it, or removes it with 0 seconds.',
    response: Timesheet,
  })
  @Put('timesheet/cells')
  setCell(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(TimesheetCellRequest) body: TimesheetCellRequest,
  ): Promise<Timesheet> {
    return this.timesheets.setCell(principal, body);
  }

  @Endpoint({ tag: 'Time tracking', summary: 'The caller’s running timer', response: TimerState })
  @Get('me/timer')
  async timer(@CurrentPrincipal() principal: Principal): Promise<TimerState> {
    return { timer: await this.timesheets.timer(principal) };
  }

  @Endpoint({ tag: 'Time tracking', summary: 'Start a timer on an issue', response: TimerState })
  @Post('issues/:key/timer')
  @HttpCode(201)
  async start(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<TimerState> {
    return { timer: await this.timesheets.start(principal, key.toUpperCase()) };
  }

  @Endpoint({
    tag: 'Time tracking',
    summary: 'Stop the timer and log the elapsed time',
    response: Worklog,
  })
  @Post('me/timer/stop')
  @HttpCode(200)
  stop(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(StopTimerRequest) body: StopTimerRequest,
  ): Promise<Worklog> {
    return this.timesheets.stop(principal, body.comment);
  }

  @Endpoint({ tag: 'Time tracking', summary: 'Discard the timer without logging' })
  @Delete('me/timer')
  @HttpCode(204)
  discard(@CurrentPrincipal() principal: Principal): Promise<void> {
    return this.timesheets.discard(principal);
  }
}
