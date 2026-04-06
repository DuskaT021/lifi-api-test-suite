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
| `POST /advanced/routes` | routes.spec.ts | Never cached |
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

`mcp/mcp-test-scenarios.ts` uses Claude to generate diverse edge case scenarios
for the `/quote` endpoint — unusual chain pairs, cross-ecosystem swaps, extreme
amounts, and more.

```bash
npx ts-node mcp/mcp-test-scenarios.ts
```

Output is saved to `mcp/generated-scenarios.json` and can be imported
into the Playwright test suite.

---

## Setup

```bash
npm install
npx playwright install --with-deps chromium
```

Optional: add your LI.FI API key for higher rate limits:
```bash
export LIFI_API_KEY=your_key_here
```

---

## Running tests

```bash
# All tests
npm test

# Single suite
npm run test:tokens
npm run test:quote
npm run test:composer
npm run test:mcp

# Postman collections via Newman
npm run test:postman
npm run test:postman:quote

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
lifi-api-testing/
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
│       ├── api-client.ts      # Centralised client with caching
│       ├── assertions.ts      # Shared custom assertions
│       └── test-data.ts       # Chain IDs, token addresses, test wallets
├── postman/
│   ├── collections/
│   └── environments/
├── mcp/
│   ├── mcp-test-scenarios.ts  # AI-assisted scenario generator
│   └── generated-scenarios.json
├── .github/workflows/
│   └── api-tests.yml
├── docs/
│   └── TEST-PLAN.md
├── playwright.config.ts
└── package.json
```
