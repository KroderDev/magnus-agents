# Chat Pipeline Flow

The runtime now uses an ordered multi-node chat pipeline instead of a single hardcoded `trigger -> respond` path.

## Routes
- `ignore`: stop early without generating chat
- `reply`: generate and publish a persona message
- `action`: execute one allowed read-only local action, then summarize the result as a persona reply

## Flowchart

```mermaid
flowchart TD
    A[Inbound Magnus Chat] --> B[Trigger Node]
    B -->|No trigger| I[Ignore Route]
    B -->|Triggered| C[Guard Node]
    C -->|Cooldown or command-like| I
    C -->|Pass| D[Decision Node]
    D -->|ignore| I
    D -->|reply| E[Context Node]
    D -->|action| F[Tool Planning Node]
    E --> F
    F -->|action route| G[Action Route Node]
    G --> J[Execute allowed read-only action]
    J --> H
    F -->|reply route| H[Draft Node]
    H --> K[Verify Node]
    K -->|fail| I
    K -->|pass| L[Publish Node]
    L --> M[Store assistant memory and cooldown]
```

## Current Notes
- `TriggerNode` still uses the existing trigger heuristics from `TriggerEngine`.
- `GuardNode` handles deterministic skips before any LLM call.
- `ContextNode` builds structured context from chat memory and Magnus player-list heartbeats.
- `ToolPlanningNode` exposes allowed action candidates when persona actions are enabled.
- `ActionRouteNode` executes one deterministic local action and turns the result into reply context.
