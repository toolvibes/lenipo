import { Controller, Get, Inject, Put } from '@nestjs/common';
import { WorkingTime } from '@tasklore/shared';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { WorkingTimeService } from './working-time.service.js';

@RequireGlobal('admin')
@Controller('admin/time-tracking')
export class TimeTrackingController {
  constructor(@Inject(WorkingTimeService) private readonly workingTime: WorkingTimeService) {}

  @Endpoint({
    tag: 'Admin',
    summary: 'Get the working time used for durations',
    response: WorkingTime,
  })
  @Get()
  get(): Promise<WorkingTime> {
    return this.workingTime.get();
  }

  @Endpoint({
    tag: 'Admin',
    summary: 'Change the working time used for durations',
    description:
      'Stored values stay in seconds; "1d" and "1w" are read and shown with the new lengths from now on.',
    response: WorkingTime,
  })
  @Put()
  set(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(WorkingTime) body: WorkingTime,
  ): Promise<WorkingTime> {
    return this.workingTime.set(principal, body);
  }
}
