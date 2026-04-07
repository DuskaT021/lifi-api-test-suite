# Agent Guide — LI.FI API Test Suite

This file gives AI agents and human reviewers the context needed to work effectively in this repo without re-discovering known quirks.

---

## What this repo does

Validates the [LI.FI](https://li.fi) REST API (`https://li.quest/v1`) across two test layers:

| Layer | Tool | When to use |
|-------|------|-------------|
| Playwright + TypeScript | `playwright/tests/` | CI/CD regression, type-safe assertions |
| Postman / Newman | `postman/collections/` | Exploratory, manual, or quick smoke tests |

A third layer (`playwright/tests/mcp-parity.spec.ts`) validates the LI.FI MCP server (`https://mcp.li.quest/mcp`) against the REST API to catch divergence between the two surfaces.

---

## Known API quirks — read before writing tests

### `/tokens` response is wrapped

The API returns:
```json
{ "tokens": { "137": [ ...tokens ] } }
```
Not the flat map directly. Always navigate `.tokens` before iterating chain keys or token arrays.

- In `LiFiApiClient.getTokens()` the unwrap is handled automatically — use the client wherever possible.
- If calling the API directly via `request.get()`, unwrap manually: `const data = json.tokens ?? json`.

### `/quote` Composer routes return 422

A `422 Unprocessable Entity` is a valid meaningful response for unsupported vault token routes (e.g. Jumper Earn vault on Base). It is not a server error. Tests must allow `[200, 400, 404, 422]`.

### `priceUSD` is a string, not a number

Token objects return `priceUSD` as a string (`"0.09364"`). Always `parseFloat()` before numeric comparisons.

### `coinKey` is optional

Not all tokens have a `coinKey` field. Do not assert it as required.

---

## Caching rules

| Endpoint | Cached | Reason |
|----------|--------|--------|
| `GET /tokens` | Yes | Large payload (~100k tokens), rarely changes |
| `GET /chains` | Yes | Chain list is stable |
| `GET /tools` | Yes | Bridge/DEX list is stable |
| `GET /quote` | **Never** | Real-time routing — must always be fresh |
| `POST /advanced/routes` | **Never** | Real-time routing — must always be fresh |

Cache lives in `LiFiApiClient` for the duration of a test run only.

---

## Type conventions

- `assertTokenShape(token: Token)` — parameter is `Token`, not `Record<string, unknown>`
- `assertChainShape(chain: Chain)` — parameter is `Chain`, not `Record<string, unknown>`
- Both types are exported from `playwright/helpers/api-client.ts`
- Do not use `as Record<string, unknown>` casts — fix the function signature instead

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `LIFI_API_KEY` | No | Increases rate limits (200 req/2h → 200 req/min) |
| `ANTHROPIC_API_KEY` | No | Enables live LLM scenario generation (`npm run scenarios`); falls back to `generated-scenarios.json` if absent or on failure |
| `LLM_PROVIDER` | No | Selects which LLM provider to use (default: `anthropic`). See `mcp/llm-provider.ts` for supported values |

Copy `.env.example` to `.env` and fill in values. Neither key is required to run the test suite.

---

## LLM provider abstraction (`mcp/llm-provider.ts`)

`npm run scenarios` uses a provider-agnostic interface so the underlying LLM can be swapped without touching scenario logic:

- **`LLMProvider` interface** — single method `generateJSON(prompt): Promise<string>`
- **`AnthropicProvider`** — current default, wraps `@anthropic-ai/sdk`
- **`createProvider(name)`** — factory selected by `LLM_PROVIDER` env var

To add a new provider (e.g. OpenAI):
1. Create a class implementing `LLMProvider` in `mcp/llm-provider.ts`
2. Add a `case` for it in `createProvider()`
3. Set `LLM_PROVIDER=openai` in your `.env`

### Fallback behaviour

If `generateJSON` fails for **any** reason — bad API key, network error, rate limit, malformed response, or all scenarios failing validation — the script automatically falls back to `mcp/generated-scenarios.json` and logs a clear warning. The script **never exits with a non-zero code** due to an LLM failure.

---

## Running tests

```bash
npm test                      # all Playwright tests
npm run test:tokens           # single suite
npm run test:postman          # Newman / Postman collection
npx tsc --noEmit              # type-check without running tests
```

---

## Key files

| File | Purpose |
|------|---------|
| `playwright/helpers/api-client.ts` | All API calls + caching + type definitions |
| `playwright/helpers/assertions.ts` | Shared shape/field assertions |
| `playwright/helpers/test-data.ts` | Chain IDs, token addresses, test wallet |
| `postman/collections/lifi_full_suite.postman_collection.json` | Newman test collection |
| `postman/environments/production.postman_environment.json` | Newman environment (base URL, test wallet) |
| `scripts/newman-run.js` | Newman CLI runner — writes reports to `newman-reports/` |
| `mcp/mcp-test-scenarios.ts` | LLM-assisted edge case generator for `/quote` (with fallback) |
| `mcp/llm-provider.ts` | `LLMProvider` interface + `AnthropicProvider` + `createProvider()` factory |
| `.github/workflows/api-tests.yml` | CI — runs on PR, push to main, daily at 08:00 UTC |
