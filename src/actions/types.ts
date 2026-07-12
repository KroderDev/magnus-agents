export interface ActionContext {
  personaId: string;
  sourceUuid: string;
  sourceName: string;
  sourceServer: string;
}

export interface ActionResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface AgentAction {
  readonly id: string;
  readonly description: string;
  execute(input: unknown, ctx: ActionContext): Promise<ActionResult>;
}
