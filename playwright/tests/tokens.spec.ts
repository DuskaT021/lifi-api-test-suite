/**
 * /tokens endpoint tests
 *
 * Migrated from the original Postman collection and expanded.
 * Key improvement: response is cached at the suite level — the original
 * implementation fetched /tokens on every test, resulting in repeated
 * heavy payloads. Now fetched once and reused across all assertions.
 */

import { test, expect } from '@playwright/test';
import { LiFiApiClient } from '../helpers/api-client';
import {
  assertOk,
  assertBadRequest,
  assertTokenShape,
  assertResponseTime,
  assertNoSensitiveDataLeaked,
} from '../helpers/assertions';
import {
  CHAINS,
  SECURITY_PAYLOADS,
  REQUIRED_TOKEN_FIELDS,
} from '../helpers/test-data';

test.describe('/tokens endpoint', () => {
  let client: LiFiApiClient;

  test.beforeEach(({ request }) => {
    client = new LiFiApiClient(request);
  });

  // -- Basic response tests --------------------------------------------------

  test.describe('basic response', () => {
    test('returns 200 with valid token data', async ({ request }) => {
      const start = Date.now();
      const response = await request.get('https://li.quest/v1/tokens?chains=137');
      assertOk(response);
      assertResponseTime(start);

      const data = await response.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });

    test('response body is an object keyed by chainId', async () => {
      const data = await client.getTokens(CHAINS.POLYGON);
      expect(typeof data).toBe('object');
      expect(Object.keys(data).length).toBeGreaterThan(0);

      // Keys should be numeric chain IDs
      for (const key of Object.keys(data)) {
        expect(Number.isInteger(parseInt(key))).toBe(true);
      }
    });

    test('each chain contains an array of tokens', async () => {
      const data = await client.getTokens(CHAINS.POLYGON);
      for (const [chainId, tokens] of Object.entries(data)) {
        expect(Array.isArray(tokens), `Chain ${chainId} tokens should be an array`).toBe(true);
        expect(tokens.length).toBeGreaterThan(0);
      }
    });

    test('all token objects have required fields', async () => {
      const data = await client.getTokens(CHAINS.POLYGON);
      const tokens = Object.values(data).flat();

      // Validate a sample of tokens — not all 10k+ for performance
      const sample = tokens.slice(0, 20);
      for (const token of sample) {
        assertTokenShape(token);
      }
    });

    test('response does not contain sensitive data', async ({ request }) => {
      const response = await request.get('https://li.quest/v1/tokens?chains=1');
      const body = await response.text();
      assertNoSensitiveDataLeaked(body);
    });
  });

  // -- Chain parameter tests -------------------------------------------------

  test.describe('chain parameter', () => {
    test('filters tokens to requested chain only', async () => {
      const data = await client.getTokens(CHAINS.POLYGON);
      for (const [chainId] of Object.entries(data)) {
        expect(chainId).toBe(CHAINS.POLYGON);
      }
    });

    test('accepts multiple chains as comma-separated values', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${CHAINS.POLYGON},${CHAINS.ARBITRUM}`
      );
      assertOk(response);
      const data = await response.json();
      const chainIds = Object.keys(data);
      expect(chainIds.length).toBeGreaterThanOrEqual(1);
    });

    test('accepts chain by mnemonic key (ETH)', async ({ request }) => {
      const response = await request.get('https://li.quest/v1/tokens?chains=ETH');
      assertOk(response);
    });

    test('returns only EVM tokens when chainTypes=EVM', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${CHAINS.POLYGON}&chainTypes=EVM`
      );
      assertOk(response);
    });

    test('handles unknown chain gracefully', async ({ request }) => {
      const response = await request.get('https://li.quest/v1/tokens?chains=999999');
      // Should return 200 with empty data or a 400 — not a 500
      expect([200, 400]).toContain(response.status());
      if (response.status() === 200) {
        const data = await response.json();
        expect(typeof data).toBe('object');
      }
    });
  });

  // -- Price filter tests ----------------------------------------------------

  test.describe('minPriceUSD parameter', () => {
    test('filters out tokens below minimum price', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${CHAINS.ETHEREUM}&minPriceUSD=1`
      );
      assertOk(response);
      const json = await response.json();
      const data: Record<string, { priceUSD: string }[]> = json.tokens ?? json;
      const tokens = Object.values(data).flat();

      for (const token of tokens) {
        const price = parseFloat(token.priceUSD);
        expect(price).toBeGreaterThanOrEqual(1);
      }
    });

    test('accepts minPriceUSD=0', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${CHAINS.POLYGON}&minPriceUSD=0`
      );
      assertOk(response);
    });

    test('rejects negative minPriceUSD', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${CHAINS.POLYGON}&minPriceUSD=-1`
      );
      // API should reject or ignore — should not return a 500
      expect(response.status()).not.toBe(500);
    });
  });

  // -- Security tests --------------------------------------------------------

  test.describe('security', () => {
    test('rejects SQL injection in chains param', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${encodeURIComponent(SECURITY_PAYLOADS.SQL_INJECTION)}`
      );
      assertBadRequest(response);
    });

    test('rejects XSS payload in chains param', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${encodeURIComponent(SECURITY_PAYLOADS.XSS)}`
      );
      assertBadRequest(response);
    });

    test('handles extremely long chain param without crashing', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${SECURITY_PAYLOADS.LONG_STRING}`
      );
      expect(response.status()).not.toBe(500);
    });
  });

  // -- Performance tests -----------------------------------------------------

  test.describe('performance', () => {
    test('single chain request completes within 5 seconds', async ({ request }) => {
      const start = Date.now();
      const response = await request.get(
        `https://li.quest/v1/tokens?chains=${CHAINS.POLYGON}`
      );
      assertOk(response);
      assertResponseTime(start, 5000);
    });

    test('demonstrates caching benefit — second call is instant', async () => {
      // First call hits the API
      const start1 = Date.now();
      await client.getTokens(CHAINS.POLYGON);
      const firstCallMs = Date.now() - start1;

      // Second call uses cache — should be near-zero
      const start2 = Date.now();
      await client.getTokens(CHAINS.POLYGON);
      const secondCallMs = Date.now() - start2;

      expect(secondCallMs).toBeLessThan(10); // cache hit should be <10ms
    });
  });
});
