# Magnus Agents

## Package Manager
- Use `pnpm`. The repo was migrated from npm (note the leftover `package-lock.json`).
- Node 26 for local/runtime parity (`Dockerfile` uses `node:26-alpine`).

## ESM + TypeScript
- This is ESM (`"type": "module"`) with `moduleResolution: "NodeNext"`. In `.ts` files, local import specifiers must end in `.js`.

## Commands
- `pnpm run dev` — `tsx watch src/main.ts`
- `pnpm run build` — `tsc` (outputs to `dist/`)
- `pnpm run start` — `node dist/main.js`
- `pnpm run typecheck` — `tsc --noEmit`
- `pnpm test` — `vitest run`
- Focused test: `npx vitest run tests/<file>.test.ts`
- Focused test by name: `npx vitest run tests/<file>.test.ts -t "<name>"`

## Verification
- Reliable verification today: `pnpm run typecheck` then `pnpm test`.
- `pnpm run lint` exists but no checked-in root ESLint config — do not assume lint works.

## Source Of Truth
- Do not edit `dist/`; it is generated from `src/` and gitignored.
- `tsconfig.json` compiles only `src/**/*.ts` (excludes `tests/`).
- Runtime entrypoint: `src/main.ts`
- Persona schema: `src/config/persona.ts`
- Env validation: `src/config/env.ts`

## Runtime Setup
- The app reads `process.env` directly — no dotenv loader. `.env.example` is a template only.
- Required env: `MAGNUS_MESSAGE_SIGNING_SECRET`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `PERSONA_CONFIG_PATH`.
- Persona configs: `personas/*.yaml`
- Health endpoint: `GET /` on `HEALTH_PORT` (default 3000), returns `{"status":"ok","uptime":...}`.

## Magnus Integration
- Integration is Redis pub/sub (not HTTP). Channels: `magnus:chat` and `magnus:playerlist`.
- Signed message format: `signature|timestamp|payload` (HMAC-SHA256, base64).
- Outbound persona chat: `playerUuid = persona:<id>`, `serverName = agent:<personaId>`.
- `ChatSubscriber` ignores messages with `persona:` UUIDs for loop prevention.
- Redis client is shared across publish and both subscriptions in `main.ts`.

## Runtime Behavior
- `TriggerEngine` uses only `allowedInputServers`, `triggers.onMention`, and `triggers.onQuestion`.
- Cooldowns: global + per-player.
- Loop guard: suppresses the same normalized reply on the 3rd repeat.
- LLM context: system prompt + recent chat messages.

## Stubs / Gotchas
- `actions.enabled` only logs a warning — no actions are registered yet.
- `triggers.onJoinBurst` and `style.roleplay` are in the config schema but unused by runtime.
- `PersonaMessage.targetServers` is defined but unused by publishing/runtime.
- If persona YAML omits `model`, runtime sends `"default"` to the LLM API instead of env `LLM_MODEL`.
- Docker build is suspect: `Dockerfile` runs `npm ci` but does not copy `package-lock.json`.

## Test Scope
- Existing tests: protocol encode/decode, message signing, cooldowns, trigger evaluation.
- No tests for `main.ts`, Redis integration, env/persona loading, LLM calls, or Docker.
