# LI.FI API Testing Suite (2026)

![API Tests](https://github.com/DuskaT021/lifi-api-test-suite/actions/workflows/api-tests.yml/badge.svg)

A comprehensive API test suite for [LI.FI](https://li.fi) endpoints, built with **Playwright + TypeScript** and **Postman/Newman**, with **MCP server parity tests** and **AI-assisted scenario generation**.

---

## What's in this repo

| Layer | Tool | Purpose |
|-------|------|---------|
| Playwright + TypeScript | `playwright/tests/` | Automated regression suite, CI/CD |
| Postman collections | `postman/collections/` | Manual/exploratory API validation |
| MCP parity tests | `playwright/tests/mcp-parity.spec.ts` | Validates LI.FI MCP server against REST API |
| AI scenario generator | `mcp/mcp-test-scenarios.ts` | Claude generates edge case test data |
| GitHub Actions | `.github/workflows/` | CI on PR + daily scheduled health monitor |

---

## Endpoints covered

| Endpoint | Tests | Notes |
|----------|-------|-------|
| `GET /tokens` | tokens.spec.ts | Cached — see caching strategy below |
| `GET /chains` | chains.spec.ts | Cached |
| `GET /tools` | tools.spec.ts | Cached |
| `GET /connections` | connections.spec.ts | Not cached — param-dependent |
| `GET /quote` | quote.spec.ts | Never cached — real-time routing |
| `GET /quote` (Composer) | composer.spec.ts | Composer deposit flows |
| MCP tools | mcp-parity.spec.ts | get-chains, get-quote, get-tokens parity |

---

## Caching strategy

The original Postman suite fetched `/tokens` on every test, resulting in repeated
heavy payloads (~100k tokens across 60+ chains). This suite caches static-data
endpoints for the duration of each test run:

```
/tokens  → cached (data changes infrequently, large payload)
/chains  → cached (chain list is stable)
/tools   → cached (bridge/DEX list is stable)
/quote   → NEVER cached (real-time routing, must be fresh)
/routes  → NEVER cached (real-time routing, must be fresh)
```

The `LiFiApiClient` class in `playwright/helpers/api-client.ts` handles this automatically.
The caching test in `tokens.spec.ts` explicitly validates that the second call is <10ms.

---

## MCP Integration

LI.FI launched their own MCP server in March 2026 at `https://mcp.li.quest/mcp`.
This wraps the REST API into tools for AI agents (Claude, Cursor, Windsurf, etc).

`mcp-parity.spec.ts` validates that the MCP server returns data consistent with
the underlying REST API — catching any divergence between the two surfaces.

To connect LI.FI's MCP server to Claude Desktop, add to your config:
```json
{
  "mcpServers": {
    "lifi": {
      "type": "http",
      "url": "https://mcp.li.quest/mcp"
    }
  }
}
```

---

## AI-assisted test scenario generation

`mcp/mcp-test-scenarios.ts` uses an LLM (Claude by default) to generate diverse
edge case test scenarios across multiple endpoints — `/quote`, `/connections`,
`/tokens`, `/chains`, and `/tools`.

```bash
npm run scenarios
```

Output is saved to `mcp/generated-scenarios.json`. The Playwright test suite
consumes these scenarios automatically via
`playwright/helpers/agentic-scenarios.ts` → `getAgentScenarios(endpoint)`:

- `quote.spec.ts` — loads `/quote` scenarios (positive + negative + edge cases)
- `connections.spec.ts` — loads `/connections` scenarios

**Deterministic fallback:** if the JSON file is missing or the LLM call fails,
the tests skip the agentic block gracefully — the deterministic suite still runs.
To regenerate scenarios, set `ANTHROPIC_API_KEY` in `.env` and run
`npm run scenarios`.

Postman/Newman can run the same generated scenarios by first producing iteration
data and then running the `Agentic Scenarios` folder:

```bash
npm run postman:data:agentic
npm run test:postman:agentic
```

This keeps AI-driven tests deterministic in CI by using checked-in JSON inputs.

Each generated scenario includes:
| Field | Description |
|-------|-------------|
| `endpoint` | Target API path, e.g. `/quote` |
| `params` | Query parameters passed to the endpoint |
| `expectedStatus` | Allowed HTTP status codes |
| `expectedBehaviour` | `valid_route \| no_route \| error \| schema_violation` |
| `notes` | Why this scenario is an interesting edge case |

<p align="center">
  <video src="https://github.com/user-attachments/assets/350adddb-7990-4c81-8bbf-77f2a0227414" width="80%" controls></video>
</p>


---

## Setup

```bash
npm install
npx playwright install --with-deps chromium
```

Copy the environment template and fill in your keys:
```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `LIFI_API_KEY` | No | Increases rate limits (200 req/2h → 200 req/min) |
| `ANTHROPIC_API_KEY` | Only for `npm run scenarios` | Claude-assisted scenario generation |

---

## Running tests

For a fast demo flow, see `docs/POSTMAN-RUNBOOK.md`.

```bash
# All Playwright tests
npm test

# Single suite
npm run test:tokens
npm run test:quote
npm run test:composer
npm run test:mcp

# Postman collections via Newman
npm run test:postman
npm run test:postman:quote
npm run test:postman:connections
npm run test:postman:chains
npm run test:postman:tools

# AI scenario generation
npm run scenarios
npm run postman:data:agentic
npm run test:postman:agentic

# Staging environment (placeholder URL by default)
node scripts/newman-run.js --env=staging

# Type-check without running tests
npx tsc --noEmit

# View HTML report
npm run report
```

---

## CI/CD

GitHub Actions runs on:
- Every pull request to `main`
- Every push to `main`
- Daily at 08:00 UTC (live API health monitor)

Results are uploaded as artifacts and available in the Actions tab.

---

## Project structure

```
lifi-api-test-suite/
├── playwright/
│   ├── tests/
│   │   ├── tokens.spec.ts
│   │   ├── chains.spec.ts
│   │   ├── tools.spec.ts
│   │   ├── connections.spec.ts
│   │   ├── quote.spec.ts
│   │   ├── composer.spec.ts
│   │   └── mcp-parity.spec.ts
│   └── helpers/
│       ├── api-client.ts       # Centralised client with caching + type definitions
│       ├── assertions.ts       # Shared custom assertions
│       ├── agentic-scenarios.ts # Loader for AI-generated scenario JSON
│       └── test-data.ts        # Chain IDs, token addresses, test wallets
├── postman/
│   ├── collections/
│   ├── environments/
│   └── data/
├── mcp/
│   ├── mcp-test-scenarios.ts   # AI-assisted scenario generator
│   └── generated-scenarios.json
├── scripts/
│   ├── newman-run.js           # Newman CLI runner
│   └── generate-postman-agentic-data.js
├── .github/workflows/
│   └── api-tests.yml
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── docs/
│   └── TEST-PLAN.md
├── AGENTS.md                   # Context for AI agents and reviewers
├── playwright.config.ts
├── .env.example
└── package.json
```
