# Postman Runbook

Use this runbook to demo the Postman/Newman layer quickly and consistently.
Important: `Agentic Scenarios` is iteration-data driven and must be run via
Postman Runner (or Newman) with `postman/data/agentic-scenarios.postman_data.json`.

## 1) Production smoke run

Runs the full Postman collection against production.

```bash
npm run test:postman
```

Expected outcome:
- Exit code `0`
- Summary table with `0 failed` requests/assertions
- JSON report path printed under `newman-reports/`

---

## 2) Endpoint-focused checks

Run only the parity folders added to match Playwright coverage.

```bash
npm run test:postman:connections
npm run test:postman:chains
npm run test:postman:tools
```

Expected outcome:
- Each command exits `0`
- Basic deterministic checks pass for status and shape

---

## 3) Agentic scenario flow (deterministic in CI)

Generate Newman iteration data from `mcp/generated-scenarios.json`, then execute
the `Agentic Scenarios` folder.

```bash
npm run postman:data:agentic
npm run test:postman:agentic
```

Expected outcome:
- Data file written to `postman/data/agentic-scenarios.postman_data.json`
- Agentic run executes each generated scenario row
- Assertions confirm:
  - response status is in `expectedStatusCsv`
  - response is never `500`

---

## 4) Staging placeholder run

This verifies staging wiring even before real staging access is granted.

```bash
node scripts/newman-run.js --env=staging --collection="Chains (/chains)"
```

Expected outcome:
- Runner prints a warning that staging URL is a placeholder
- Request may fail until real staging URL/access is available
- Behavior is intentional and documented

---

## 5) Useful options

Stop on first failure:

```bash
npm run test:postman:bail
```

Run only one folder manually:

```bash
node scripts/newman-run.js --collection="Connections (/connections)"
```

Run with custom iteration data:

```bash
node scripts/newman-run.js \
  --collection="Agentic Scenarios" \
  --iteration-data=postman/data/agentic-scenarios.postman_data.json
```

---

## Interview demo script (3-5 minutes)

1. `npm run test:postman:connections` (quick deterministic parity proof)
2. `npm run postman:data:agentic && npm run test:postman:agentic` (AI-driven coverage)
3. `node scripts/newman-run.js --env=staging --collection="Chains (/chains)"` (staging wiring + placeholder warning)

Talking points:
- Deterministic and agentic layers coexist
- Agentic execution is reproducible via checked-in scenario JSON + generated iteration data
- Staging is pre-wired without blocking day-to-day production validation
