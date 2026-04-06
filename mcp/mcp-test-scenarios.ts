/**
 * AI-Assisted Test Scenario Generator
 *
 * Uses Claude (via Anthropic API) to dynamically generate edge case
 * test scenarios for LI.FI API endpoints.
 *
 * This addresses two things:
 * 1. The feedback about "diverse and structured strategies for test scenarios"
 * 2. LI.FI's own investment in agentic/AI workflows
 *
 * Usage:
 *   npx ts-node mcp/mcp-test-scenarios.ts
 *
 * Output: A JSON file of generated test cases that Playwright can consume.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const client = new Anthropic();

interface GeneratedScenario {
  name: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  expectedBehaviour: 'valid_route' | 'no_route' | 'error';
  reason: string;
}

async function generateQuoteScenarios(): Promise<GeneratedScenario[]> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are a QA engineer testing the LI.FI cross-chain swap API.

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
]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  try {
    const scenarios = JSON.parse(content.text) as GeneratedScenario[];
    return scenarios;
  } catch {
    console.error('Failed to parse Claude response:', content.text);
    throw new Error('Claude returned invalid JSON');
  }
}

async function main() {
  console.log('Generating AI-assisted test scenarios via Claude...');

  const scenarios = await generateQuoteScenarios();

  const outputPath = path.join(__dirname, 'generated-scenarios.json');
  fs.writeFileSync(outputPath, JSON.stringify(scenarios, null, 2));

  console.log(`Generated ${scenarios.length} scenarios`);
  console.log(`Saved to: ${outputPath}`);

  console.log('\nScenarios:');
  for (const s of scenarios) {
    console.log(`  [${s.expectedBehaviour}] ${s.name}`);
    console.log(`    Reason: ${s.reason}`);
  }
}

main().catch(console.error);
