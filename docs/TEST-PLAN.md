# Test Plan — LI.FI API Testing Suite

**Version:** 2.0
**Last updated:** April 2026
**Scope:** LI.FI REST API (`https://li.quest/v1`) and MCP server (`https://mcp.li.quest/mcp`)

---

## Objectives

- Validate reliability, correctness, and security of LI.FI's public API endpoints
- Ensure MCP server returns data consistent with the underlying REST API
- Provide a scheduled health monitor for early detection of API regressions
- Document caching strategy to reduce unnecessary load on the API

---

## Scope

### In scope
- `GET /tokens` — token discovery and filtering
- `GET /token` — single token lookup
- `GET /chains` — supported blockchain networks
- `GET /tools` — available bridges and DEX aggregators
- `GET /connections` — route availability between chains
- `GET /quote` — single-step route (core business logic)
- `POST /advanced/routes` — multi-route comparison
- `GET /quote` with Composer params — vault deposit flows
- LI.FI MCP server tool parity

### Out of scope
- Transaction execution (requires funded wallet)
- `GET /status` (requires a real txHash from an executed transaction)
- Widget integration testing
- SDK unit tests

---

## Test strategy

### Test levels

| Level | Approach | Tools |
|-------|----------|-------|
| Functional | Happy path + parameter validation | Playwright, Postman |
| Integration | Cross-endpoint data consistency | Playwright |
| Security | Injection, XSS, malformed input | Playwright |
| Performance | Response time thresholds | Playwright |
| Parity | MCP vs REST consistency | Playwright |

### Caching strategy

Endpoints are divided into two categories based on data freshness requirements:

**Static endpoints (cached for test run duration):**
- `/tokens` — large payload, data changes infrequently. Fetching without chain
  filter returns 100k+ tokens and is slow. Always filter by chain.
- `/chains` — chain list is stable between releases
- `/tools` — bridge/DEX list changes only when new integrations are added

**Dynamic endpoints (never cached):**
- `/quote` — real-time routing, prices change by the second
- `/routes` — same as above

### Risk-based prioritisation

| Priority | Endpoint | Risk |
|----------|----------|------|
| P1 | `/quote` | Core revenue path — routing errors cause direct financial loss |
| P1 | `/tokens` | Token data errors cause failed swaps |
| P2 | `/chains` | Chain availability affects all routing |
| P2 | `/tools` | Bridge unavailability affects route options |
| P3 | `/connections` | Route availability pre-check |
| P3 | Composer | New product surface, vault deposit flows |
| P4 | MCP parity | New surface, lower volume |

---

## Test environments

| Environment | Base URL | Notes |
|-------------|----------|-------|
| Production | `https://li.quest/v1` | All tests run here by default |
| Staging | `https://staging.li.quest/v1` | Available for pre-release validation |

---

## Security test approach

Each endpoint is tested with:
- SQL injection payloads in string parameters
- XSS payloads in string parameters
- Null bytes and control characters
- Extremely long strings (1000+ chars)
- Missing required parameters
- Type mismatches (string where integer expected)

Expected outcomes:
- API returns 400/422, never 500
- Error responses do not reflect payloads back
- No sensitive data (private keys, secrets) in responses

---

## Performance thresholds

| Endpoint | Max response time |
|----------|-------------------|
| `/tokens` (single chain) | 5000ms |
| `/chains` | 3000ms |
| `/tools` | 3000ms |
| `/quote` | 10000ms |
| Cached endpoints (2nd call) | <10ms |

---

## CI/CD integration

Tests run automatically via GitHub Actions:

- **On pull request** — full suite, blocks merge on failure
- **On push to main** — full suite
- **Daily at 08:00 UTC** — scheduled health monitor

Reports are uploaded as artifacts and retained for 7 days.

---

## AI-assisted scenario generation

`mcp/mcp-test-scenarios.ts` uses Claude to generate diverse edge case test
scenarios for the `/quote` endpoint. This addresses the challenge of covering
unusual chain/token combinations systematically rather than relying solely
on manually authored test cases.

Generated scenarios cover:
- Unusual chain pairs (e.g. BSC to Avalanche)
- High and low amounts
- Native to stablecoin and vice versa
- Same-chain swaps
- Cross-ecosystem routes

---

## Known limitations

- Transaction execution tests are out of scope (require funded wallet)
- Rate limiting may affect bulk test runs without an API key
- MCP parity tests depend on MCP server availability
- Composer vault addresses may change as LI.FI updates their product
