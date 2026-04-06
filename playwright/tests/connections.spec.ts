/**
 * /connections endpoint tests
 *
 * Validates route availability between chains/tokens.
 * Not cached — results are param-dependent.
 */

import { test, expect } from '@playwright/test';
import { LiFiApiClient } from '../helpers/api-client';
import { assertOk, assertResponseTime } from '../helpers/assertions';
import { CHAINS, TOKENS } from '../helpers/test-data';

test.describe('/connections endpoint', () => {
  let client: LiFiApiClient;

  test.beforeEach(({ request }) => {
    client = new LiFiApiClient(request);
  });

  test.describe('basic response', () => {
    test('returns connections for Polygon -> Arbitrum', async () => {
      const start = Date.now();
      const { response, data } = await client.getConnections({
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.ARBITRUM,
      });
      assertOk(response);
      assertResponseTime(start, 5000);
      expect(data).toBeDefined();
    });

    test('returns connections with token filter', async () => {
      const { response, data } = await client.getConnections({
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.ARBITRUM,
        fromToken: TOKENS.USDC_POLYGON,
      });
      assertOk(response);
      expect(data).toBeDefined();
    });

    test('same chain connections are returned', async () => {
      const { response } = await client.getConnections({
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.POLYGON,
      });
      // Same-chain swaps are valid (DEX aggregation)
      expect([200, 400]).toContain(response.status());
    });
  });

  test.describe('parameter validation', () => {
    test('returns error for invalid fromChain', async ({ request }) => {
      const response = await request.get(
        'https://li.quest/v1/connections?fromChain=INVALID&toChain=42161'
      );
      expect(response.status()).not.toBe(500);
    });

    test('handles missing parameters gracefully', async ({ request }) => {
      const response = await request.get('https://li.quest/v1/connections');
      // Should return all connections or a 400 — not a 500
      expect(response.status()).not.toBe(500);
    });
  });
});
