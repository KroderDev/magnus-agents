# magnus-agents

AI persona agents for the [Magnus](https://github.com/KroderDev/magnus) Minecraft mod.

This runtime listens to Magnus Redis channels, decides when a persona should respond, generates a reply through an OpenAI-compatible API, and publishes the signed chat message back into the Magnus network.

## What It Uses
- Magnus Redis pub/sub channels: `magnus:chat` and `magnus:playerlist`
- OpenAI-compatible chat completion API
- Persona YAML config in `personas/`

## Quick Start
1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env` and fill in the required values.
3. Start Redis, or use `docker-compose.yml`.
4. Run the agent: `pnpm run dev`

Required env:
- `MAGNUS_MESSAGE_SIGNING_SECRET`
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `PERSONA_CONFIG_PATH`

## Commands
- `pnpm run dev`
- `pnpm run build`
- `pnpm run start`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`

## Repo Notes
- Runtime entrypoint: `src/main.ts`
- Built output: `dist/`
- Persona schema: `src/config/persona.ts`
- Env schema: `src/config/env.ts`
- Chat pipeline flow: `docs/chat_pipeline_flow.md`

## Current Scope
- Responds to Magnus chat using configurable personas.
- Tracks cross-server player lists from Magnus heartbeats.
- Uses a multi-node chat pipeline with alternate routes for ignore, reply, and future action/tool execution.
- Has the beginnings of an action/tool system, but action execution is still reserved for future wiring.
