import { Controller, Get, Inject, Param, Put } from '@nestjs/common';
import { Presence, TeamMember, UpdatePresenceRequest } from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { PresenceService } from './presence.service.js';

/** Heartbeats and the team of a project (TL-93, E-145). */
@Controller()
export class PresenceController {
  constructor(@Inject(PresenceService) private readonly presence: PresenceService) {}

  @Endpoint({
    tag: 'Agents',
    summary: 'Send a heartbeat: state and what one is working on',
    description:
      'Mainly for agents, e.g. at the start and end of each run. Without a new heartbeat for 30 minutes the state counts as offline. `issueKey` and `branch` stay as they are when left out; null clears them.',
    response: Presence,
  })
  @Put('me/presence')
  beat(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(UpdatePresenceRequest) body: UpdatePresenceRequest,
  ): Promise<Presence> {
    return this.presence.beat(principal, body);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Get the own state from the last heartbeat',
    response: Presence,
  })
  @Get('me/presence')
  mine(@CurrentPrincipal() principal: Principal): Promise<Presence> {
    return this.presence.mine(principal);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Who works in the project',
    description:
      'People and agents who changed something in the project in the last 30 days, have open issues there or a fresh heartbeat on one of its issues; with state, current issue and branch, last activity and open issues. Agents first.',
    response: z.array(TeamMember),
  })
  @Get('projects/:key/team')
  team(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<TeamMember[]> {
    return this.presence.team(principal, key);
  }
}
