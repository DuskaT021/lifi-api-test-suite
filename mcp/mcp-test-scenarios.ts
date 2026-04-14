/**
 * AI-Assisted Test Scenario Generator
 *
 * Uses an LLM provider (configured via LLM_PROVIDER env var) to dynamically
 * generate edge case test scenarios for LI.FI API endpoints.
 *
 * Resilience: if the LLM call fails for any reason (missing API key, network
 * error, rate limit, invalid response), the script falls back to the existing
 * mcp/generated-scenarios.json so the test suite can always proceed.
 *
 * Usage:
 *   npx ts-node mcp/mcp-test-scenarios.ts
 *
 * Output: A JSON file of generated test cases that Playwright can consume via
 *         `playwright/helpers/agentic-scenarios.ts` → `getAgentScenarios(endpoint)`.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createProvider } from './llm-provider';

// -- Types --------------------------------------------------------------------

/** Allowed API endpoints that agentic scenarios can target. */
export type ScenarioEndpoint = '/quote' | '/connections' | '/tokens' | '/chains' | '/tools';

/** Describes the expected outcome of running a scenario. */
export type ScenarioBehaviour = 'valid_route' | 'no_route' | 'error' | 'schema_violation';

export interface GeneratedScenario {
  /** Human-readable test name shown in the Playwright report. */
  name: string;
  /** Target API endpoint, e.g. "/quote" or "/connections". */
  endpoint: ScenarioEndpoint;
  /** Query/body parameters passed to the endpoint. All values are strings. */
  params: Record<string, string>;
  /** HTTP status codes the test should accept as valid outcomes. */
  expectedStatus: number[];
  /** Expected logical behaviour of the API for this scenario. */
  expectedBehaviour: ScenarioBehaviour;
  /** Human-readable explanation of why this scenario is interesting. */
  notes: string;
}

// -- Validation ---------------------------------------------------------------

const ALLOWED_ENDPOINTS: readonly ScenarioEndpoint[] = [
  '/quote', '/connections', '/tokens', '/chains', '/tools',
];

const ALLOWED_BEHAVIOURS: readonly ScenarioBehaviour[] = [
  'valid_route', 'no_route', 'error', 'schema_violation',
];

/** Type guard — returns true only when obj satisfies every GeneratedScenario field. */
export function isValidScenario(obj: unknown): obj is GeneratedScenario {
  if (obj === null || obj === undefined || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;

  // name must be a non-empty string
  if (typeof s.name !== 'string' || s.name.length === 0) return false;

  // endpoint must be one of the allowed values
  if (!ALLOWED_ENDPOINTS.includes(s.endpoint as ScenarioEndpoint)) return false;

  // params must be a non-null, non-array object with string values
  if (typeof s.params !== 'object' || s.params === null || Array.isArray(s.params)) return false;
  if (!Object.values(s.params as object).every(v => typeof v === 'string')) return false;

  // expectedStatus must be a non-empty array of numbers
  if (!Array.isArray(s.expectedStatus) || s.expectedStatus.length === 0) return false;
  if (!(s.expectedStatus as unknown[]).every(code => typeof code === 'number')) return false;

  // expectedBehaviour must be one of the allowed values
  if (!ALLOWED_BEHAVIOURS.includes(s.expectedBehaviour as ScenarioBehaviour)) return false;

  // notes must be a string
  if (typeof s.notes !== 'string') return false;

  return true;
}

// -- Retry with backoff -------------------------------------------------------

/**
 * Call fn up to `maxAttempts` times, waiting 1 s, 2 s, … between retries.
 * Throws the last error if every attempt fails.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      const delayMs = Math.pow(2, i - 1) * 1000;
      console.warn(`  Retrying in ${delayMs}ms (attempt ${i + 1}/${maxAttempts})...`);
      await new Promise<void>(resolve => setTimeout(resolve, delayMs));
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`  Attempt ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw lastError;
}

// -- Fallback -----------------------------------------------------------------

const FALLBACK_PATH = path.join(process.cwd(), 'mcp', 'generated-scenarios.json');

function loadFallbackScenarios(): GeneratedScenario[] {
  const raw = fs.readFileSync(FALLBACK_PATH, 'utf-8');
  return JSON.parse(raw) as GeneratedScenario[];
}

// -- Prompt -------------------------------------------------------------------

const PROMPT = `You are a QA engineer testing the LI.FI cross-chain swap REST API (https://li.quest/v1).

LI.FI supports swaps across 60+ chains including Ethereum (1), Polygon (137),
Arbitrum (42161), Optimism (10), Base (8453), BSC (56), Avalanche (43114).

Common token symbols: USDC, USDT, DAI, ETH, MATIC, BNB, AVAX.
Native ETH address: 0x0000000000000000000000000000000000000000
Test wallet address: 0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0

Generate exactly 12 diverse test scenarios spread across these endpoints:
  /quote, /connections, /tokens, /chains, /tools

Requirements:
- At least 5 scenarios for /quote (positive and negative)
- At least 3 scenarios for /connections (positive and negative)
- At least 1 scenario each for /tokens, /chains, /tools
- Include happy path cases (expectedStatus [200])
- Include negative/error cases with invalid params (expectedStatus [400, 422])
- Include extreme values (very large amounts, unknown chain IDs, malformed tokens)
- /quote scenarios MUST include fromAddress "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0" in params

Allowed expectedBehaviour values: "valid_route", "no_route", "error", "schema_violation"

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "name": "descriptive test name",
    "endpoint": "/quote",
    "params": { "fromChain": "137", "toChain": "42161", "fromToken": "USDC", "toToken": "USDC", "fromAddress": "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0", "fromAmount": "1000000" },
    "expectedStatus": [200],
    "expectedBehaviour": "valid_route",
    "notes": "why this is an interesting edge case"
  }
]`;

// -- Core generation ----------------------------------------------------------

async function generateScenarios(): Promise<GeneratedScenario[]> {
  const providerName = process.env.LLM_PROVIDER ?? 'anthropic';
  const provider = createProvider(providerName);

  const raw = await withRetry(() => provider.generateJSON(PROMPT));

  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(stripped) as unknown[];

  const valid: GeneratedScenario[] = [];
  for (const item of parsed) {
    if (isValidScenario(item)) {
      valid.push(item);
    } else {
      console.warn(`  Rejected invalid scenario: ${JSON.stringify(item)}`);
    }
  }

  if (valid.length === 0) {
    throw new Error('LLM returned no valid scenarios after filtering');
  }

  return valid;
}

// -- Main ---------------------------------------------------------------------

async function main() {
  console.log('Generating AI-assisted test scenarios...');

  let scenarios: GeneratedScenario[];

  try {
    scenarios = await generateScenarios();
    console.log(`Generated ${scenarios.length} scenario(s) via LLM.`);
  } catch (err) {
    console.warn(
      `\nWarning: LLM scenario generation failed — ${err instanceof Error ? err.message : String(err)}`
    );
    console.warn('Falling back to existing generated-scenarios.json.\n');

    try {
      scenarios = loadFallbackScenarios();
      console.log(`Using ${scenarios.length} fallback scenario(s).`);
    } catch (fallbackErr) {
      console.error(
        `Could not load fallback scenarios: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
      );
      return;
    }
  }

  const outputPath = path.join(process.cwd(), 'mcp', 'generated-scenarios.json');
  fs.writeFileSync(outputPath, JSON.stringify(scenarios, null, 2));

  console.log(`Saved to: ${outputPath}`);
  console.log('\nScenarios:');
  for (const s of scenarios) {
    console.log(`  [${s.endpoint}] [${s.expectedBehaviour}] ${s.name}`);
    console.log(`    Expected status: ${s.expectedStatus.join(', ')}`);
    console.log(`    Notes: ${s.notes}`);
  }
}

// Only run when invoked directly (npx ts-node mcp/mcp-test-scenarios.ts).
// Guarded so that importing this module for types/validation in tests
// does not trigger LLM calls or file writes.
if (require.main === module) {
  main().catch(console.error);
}
