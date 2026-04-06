/**
 * Shared custom assertions
 *
 * Wraps common Playwright expect() patterns into named functions
 * so test files read like a test plan, not a wall of expect() calls.
 */

import { APIResponse, expect } from '@playwright/test';
import { Chain, Token } from './api-client';
import { REQUIRED_CHAIN_FIELDS, REQUIRED_QUOTE_FIELDS, REQUIRED_TOKEN_FIELDS } from './test-data';

// -- HTTP status assertions --------------------------------------------------

export function assertOk(response: APIResponse) {
  expect(response.status(), `Expected 200, got ${response.status()}`).toBe(200);
}

export function assertBadRequest(response: APIResponse) {
  expect(
    [400, 422],
    `Expected 400/422, got ${response.status()}`
  ).toContain(response.status());
}

export function assertNotFound(response: APIResponse) {
  expect(response.status(), `Expected 404, got ${response.status()}`).toBe(404);
}

// -- Response time -----------------------------------------------------------

export function assertResponseTime(startMs: number, maxMs = 5000) {
  const elapsed = Date.now() - startMs;
  expect(elapsed, `Response took ${elapsed}ms, limit is ${maxMs}ms`).toBeLessThan(maxMs);
}

// -- Shape assertions --------------------------------------------------------

export function assertTokenShape(token: Token) {
  for (const field of REQUIRED_TOKEN_FIELDS) {
    expect(token, `Token missing field: ${field}`).toHaveProperty(field);
  }
  expect(typeof token.address).toBe('string');
  expect(token.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  expect(typeof token.symbol).toBe('string');
  expect(token.symbol.length).toBeGreaterThan(0);
  expect(typeof token.decimals).toBe('number');
  expect(token.decimals).toBeGreaterThanOrEqual(0);
  expect(typeof token.chainId).toBe('number');
  expect(typeof token.priceUSD).toBe('string');
}

export function assertChainShape(chain: Chain) {
  for (const field of REQUIRED_CHAIN_FIELDS) {
    expect(chain, `Chain missing field: ${field}`).toHaveProperty(field);
  }
  expect(typeof chain.id).toBe('number');
  expect(typeof chain.key).toBe('string');
  expect(typeof chain.name).toBe('string');
  expect(['EVM', 'SVM', 'MVM', 'UTXO']).toContain(chain.chainType);
}

export function assertQuoteShape(data: Record<string, unknown>) {
  for (const field of REQUIRED_QUOTE_FIELDS) {
    expect(data, `Quote missing field: ${field}`).toHaveProperty(field);
  }

  const estimate = data.estimate as Record<string, unknown>;
  expect(estimate).toHaveProperty('fromAmount');
  expect(estimate).toHaveProperty('toAmount');
  expect(estimate).toHaveProperty('toAmountMin');
  expect(estimate).toHaveProperty('approvalAddress');
  expect(estimate).toHaveProperty('executionDuration');

  expect(parseFloat(estimate.toAmount as string)).toBeGreaterThan(0);
  expect(parseFloat(estimate.toAmountMin as string)).toBeGreaterThan(0);
  expect(estimate.approvalAddress as string).toMatch(/^0x[a-fA-F0-9]{40}$/);
}

export function assertToolsShape(data: Record<string, unknown>) {
  expect(data).toHaveProperty('bridges');
  expect(data).toHaveProperty('exchanges');
  expect(Array.isArray(data.bridges)).toBe(true);
  expect(Array.isArray(data.exchanges)).toBe(true);
  expect((data.bridges as unknown[]).length).toBeGreaterThan(0);
  expect((data.exchanges as unknown[]).length).toBeGreaterThan(0);
}

// -- Security assertions -----------------------------------------------------

export function assertNoSensitiveDataLeaked(body: string) {
  const sensitivePatterns = [
    /private.?key/i,
    /secret/i,
    /password/i,
    /api.?key/i,
    /mnemonic/i,
    /seed.?phrase/i,
  ];
  for (const pattern of sensitivePatterns) {
    expect(body, `Response body matched sensitive pattern: ${pattern}`).not.toMatch(pattern);
  }
}

export function assertNoXssReflected(body: string) {
  expect(body).not.toContain('<script>');
  expect(body).not.toContain('alert(');
  expect(body).not.toContain('javascript:');
}
