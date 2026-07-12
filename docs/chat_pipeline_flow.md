# Chat Pipeline Flow

The runtime now uses an ordered multi-node chat pipeline instead of a single hardcoded `trigger -> respond` path.

## Routes
- `ignore`: stop early without generating chat
- `reply`: generate and publish a persona message
- `action`: reserve the request for future tool/action execution

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
    G --> J[Reserved for future tool execution]
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
- `ToolPlanningNode` exposes action candidates when persona actions are enabled.
- `ActionRouteNode` is currently a stubbed alternate route so the pipeline can grow without another architecture rewrite.
