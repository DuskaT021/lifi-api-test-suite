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
 * Output: A JSON file of generated test cases that Playwright can consume.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createProvider } from './llm-provider';

// -- Types --------------------------------------------------------------------

export interface GeneratedScenario {
  name: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  expectedBehaviour: 'valid_route' | 'no_route' | 'error';
  reason: string;
}

// -- Validation ---------------------------------------------------------------

/** Type guard — returns true only when obj satisfies every GeneratedScenario field. */
export function isValidScenario(obj: unknown): obj is GeneratedScenario {
  if (obj === null || obj === undefined || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;

  const requiredStrings: Array<keyof GeneratedScenario> = [
    'name', 'fromChain', 'toChain', 'fromToken', 'toToken', 'fromAmount', 'reason',
  ];
  for (const field of requiredStrings) {
    if (typeof s[field] !== 'string') return false;
  }

  return (
    s.expectedBehaviour === 'valid_route' ||
    s.expectedBehaviour === 'no_route' ||
    s.expectedBehaviour === 'error'
  );
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

const PROMPT = `You are a QA engineer testing the LI.FI cross-chain swap API.

LI.FI supports swaps across 60+ chains including Ethereum (1), Polygon (137),
Arbitrum (42161), Optimism (10), Base (8453), BSC (56), Avalanche (43114).

Common token symbols: USDC, USDT, DAI, ETH, MATIC, BNB, AVAX.
Native ETH address: 0x0000000000000000000000000000000000000000

Generate exactly 8 diverse edge case test scenarios for the /quote endpoint.
Mix of: unusual chain pairs, cross-ecosystem swaps, high/low amounts,
same-chain swaps, stablecoin to native token, native to stablecoin.

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "name": "descriptive test name",
    "fromChain": "chain id as string",
    "toChain": "chain id as string",
    "fromToken": "token symbol or address",
    "toToken": "token symbol or address",
    "fromAmount": "amount in smallest unit as string",
    "expectedBehaviour": "valid_route" | "no_route" | "error",
    "reason": "why this is an interesting edge case"
  }
]`;

// -- Core generation ----------------------------------------------------------

async function generateQuoteScenarios(): Promise<GeneratedScenario[]> {
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
    scenarios = await generateQuoteScenarios();
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
    console.log(`  [${s.expectedBehaviour}] ${s.name}`);
    console.log(`    Reason: ${s.reason}`);
  }
}

main().catch(console.error);
