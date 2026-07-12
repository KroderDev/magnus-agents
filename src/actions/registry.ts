import type { AgentAction, ActionContext, ActionResult } from "./types.js";

export class ActionRegistry {
  private readonly actions = new Map<string, AgentAction>();

  register(action: AgentAction): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action with id "${action.id}" is already registered`);
    }
    this.actions.set(action.id, action);
  }

  get(id: string): AgentAction | undefined {
    return this.actions.get(id);
  }

  async execute(id: string, input: unknown, ctx: ActionContext): Promise<ActionResult> {
    const action = this.actions.get(id);
    if (!action) {
      return { success: false, error: `Unknown action: ${id}` };
    }
    return action.execute(input, ctx);
  }

  list(): AgentAction[] {
    return [...this.actions.values()];
  }

  get count(): number {
    return this.actions.size;
  }
}
