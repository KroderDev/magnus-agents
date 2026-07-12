# Magnus Agents

## Toolchain
- Use `pnpm`.
- Use Node 26 locally and in CI/Docker.
- This repo is ESM with `moduleResolution: "NodeNext"`; local imports in `.ts` files must end in `.js`.

## Commands
- `pnpm run dev` - watch `src/main.ts` with `tsx`.
- `pnpm run build` - compile TypeScript to `dist/`.
- `pnpm run start` - run `dist/main.js`.
- `pnpm run lint` - ESLint is configured and used in CI.
- `pnpm run typecheck` - `tsc --noEmit`.
- `pnpm test` - run Vitest once.
- Focus one test file: `npx vitest run tests/<file>.test.ts`
- Focus one test name: `npx vitest run tests/<file>.test.ts -t "<name>"`

## Verification
- Match CI order: `pnpm run lint`, then `pnpm run typecheck`, then `pnpm test`.

## Source Of Truth
- Runtime entrypoint: `src/main.ts`.
- Env validation: `src/config/env.ts`.
- Persona schema/loading: `src/config/persona.ts`.
- Do not edit `dist/`; it is generated and gitignored.
- `tsconfig.json` compiles only `src/**/*.ts`; tests are excluded from build output.

## Runtime Wiring
- `main.ts` loads `.env` if present via `loadOptionalDotEnv()`, then validates `process.env`.
- `.env` values only fill missing vars; they do not override existing environment variables.
- Required env for startup: `MAGNUS_MESSAGE_SIGNING_SECRET`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `PERSONA_CONFIG_PATH`.
- Optional runtime env that changes behavior: `STARTUP_GREETING` and `STARTUP_GREETING_DELAY_MS`.
- Persona configs live under `personas/*.yaml`.
- Health endpoint: `GET /` on `HEALTH_PORT` (default `3000`) and returns JSON with `status` and `uptime`.

## Magnus Integration
- This app integrates with Magnus over Redis pub/sub, not HTTP.
- Channels used today: `magnus:chat` and `magnus:playerlist`.
- Signed payload format: `signature|timestamp|payload` using HMAC-SHA256.
- Outbound persona chat is published as `playerUuid = persona:<id>` and `serverName = agent:<personaId>`.
- `ChatSubscriber` ignores inbound `persona:` UUIDs to avoid agent echo loops.
- The agent already consumes Magnus player-list heartbeats; this is the main existing source for read-only tool data.

## Current Behavior
- `TriggerEngine` currently uses only `allowedInputServers`, `triggers.onMention`, and `triggers.onQuestion`.
- LLM context is system prompt plus recent chat memory.
- Cooldowns are global plus per-player.
- Loop guard suppresses the same normalized reply on the third repeat.
- If persona YAML omits `model`, the LLM provider falls back to env `LLM_MODEL`.

## Gaps And Gotchas
- `ActionRegistry` exists, but no actions/tools are wired into runtime yet.
- `actions.enabled` only produces a warning today.
- `triggers.onJoinBurst`, `style.roleplay`, and `PersonaMessage.targetServers` exist in schema/types but are currently unused by runtime.
- There is no end-to-end coverage for `main.ts`, live Redis integration, or real LLM calls.

## Useful Scripts
- `scripts/send-test-message.ts` publishes a signed fake player chat message to `magnus:chat` for smoke testing.
- `scripts/send-chat-message.ts` publishes a signed persona chat message using the same runtime env/config path.
