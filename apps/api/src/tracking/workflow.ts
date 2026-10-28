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
