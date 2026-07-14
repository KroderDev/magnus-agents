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

export interface ActionRequest {
  id: string;
  input: unknown;
  reason: string;
}

export interface AgentAction {
  readonly id: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: Record<string, unknown>;
  readonly readOnly?: boolean;
  readonly timeoutMs?: number;
  execute(input: unknown, ctx: ActionContext): Promise<ActionResult>;
}
