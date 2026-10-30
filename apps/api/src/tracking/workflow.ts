import { type ProjectRole, TransitionRules } from '@tasklore/shared';

/** A published workflow version (decision E-31); stored as JSONB in workflow_versions. */
export interface WorkflowDefinition {
  statusIds: string[];
  initialStatusId: string;
  transitions: WorkflowTransition[];
}

export interface WorkflowTransition {
  id: string;
  name: string;
  /** Source statuses; "*" allows the transition from every status. */
  from: string[] | '*';
  to: string;
  /** Only stored when something is set (TL-11, E-85). */
  rules?: TransitionRules;
}

/** Transitions available from a status, never to the status the issue is already in. */
export function transitionsFrom(
  definition: WorkflowDefinition,
  statusId: string,
): WorkflowTransition[] {
  return definition.transitions.filter(
    (transition) =>
      transition.to !== statusId && (transition.from === '*' || transition.from.includes(statusId)),
  );
}

/** Who looks at the issue, for the conditions of a transition. */
export interface RuleViewer {
  userId: string;
  isAdmin: boolean;
  roles: Set<ProjectRole>;
}

/** Why the conditions of a transition keep it from this viewer, or null when it is offered. */
export function blockedBy(
  rules: TransitionRules | undefined,
  issue: { assigneeId: string | null; openSubtasks: number; openBlockers: number },
  viewer: RuleViewer,
): string | null {
  if (!rules) return null;
  if (rules.onlyAssignee && issue.assigneeId !== viewer.userId) {
    return 'Only the assignee may make this transition';
  }
  if (
    rules.roles.length > 0 &&
    !viewer.isAdmin &&
    !rules.roles.some((role) => viewer.roles.has(role))
  ) {
    return `Only the project roles ${rules.roles.join(', ')} may make this transition`;
  }
  if (rules.subtasksDone && issue.openSubtasks > 0) {
    return 'All subtasks need to be done first';
  }
  if (rules.blockersDone && issue.openBlockers > 0) {
    return 'All blocking issues need to be done first';
  }
  return null;
}

/** Rules that do something; anything else is not stored. */
export function hasRules(rules: TransitionRules | undefined): rules is TransitionRules {
  return (
    !!rules &&
    (rules.onlyAssignee ||
      rules.roles.length > 0 ||
      rules.subtasksDone ||
      rules.blockersDone ||
      rules.requiredFields.length > 0 ||
      rules.dueNotPast ||
      rules.assign !== 'keep' ||
      rules.fieldActions.length > 0 ||
      rules.watch)
  );
}

/**
 * A stored definition with every rule completed by its defaults, so versions published before a
 * rule existed read like new ones (TL-75).
 */
export function readDefinition(stored: unknown): WorkflowDefinition {
  const definition = stored as WorkflowDefinition;
  if (!definition.transitions.some((transition) => transition.rules)) return definition;
  return {
    ...definition,
    transitions: definition.transitions.map((transition) =>
      transition.rules
        ? { ...transition, rules: TransitionRules.parse(transition.rules) }
        : transition,
    ),
  };
}

/**
 * Where an issue lands in another workflow (TL-76, E-87): its status if the workflow has it, else
 * the first status of the same category, else the initial status.
 */
export function landingStatus(
  definition: WorkflowDefinition,
  statusId: string,
  categoryOf: (statusId: string) => string | undefined,
): string {
  if (definition.statusIds.includes(statusId)) return statusId;
  const category = categoryOf(statusId);
  return (
    definition.statusIds.find((candidate) => categoryOf(candidate) === category) ??
    definition.initialStatusId
  );
}
