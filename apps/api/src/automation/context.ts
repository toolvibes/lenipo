import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The rule whose actions are running (TL-22, E-103). Events written meanwhile carry its id and
 * the chain depth, so the engine can stop loops without threading this through every service.
 */
export interface AutomationContext {
  ruleId: string;
  depth: number;
}

export const automationContext = new AsyncLocalStorage<AutomationContext>();
