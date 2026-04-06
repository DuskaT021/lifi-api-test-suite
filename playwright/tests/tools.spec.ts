/**
 * /tools endpoint tests
 *
 * Validates bridge and DEX aggregator availability.
 * Response is cached — bridge/DEX list changes only on new integrations.
 */

import { test, expect } from '@playwright/test';
import { LiFiApiClient } from '../helpers/api-client';
import {
  assertOk,
  assertToolsShape,
  assertResponseTime,
} from '../helpers/assertions';
import { CHAINS } from '../helpers/test-data';

test.describe('/tools endpoint', () => {
  let client: LiFiApiClient;

  test.beforeEach(({ request }) => {
    client = new LiFiApiClient(request);
  });

  test.describe('basic response', () => {
    test('returns 200 with bridges and exchanges', async ({ request }) => {
      const start = Date.now();
      const response = await request.get('https://li.quest/v1/tools');
      assertOk(response);
      assertResponseTime(start, 3000);

      const data = await response.json();
      assertToolsShape(data);
    });

    test('bridges array contains known integrations', async () => {
      const tools = await client.getTools();
      const bridgeKeys = tools.bridges.map(b => b.key);
      // LI.FI integrates Stargate, Across, Hop — at least one should be present
      const knownBridges = ['stargate', 'across', 'hop', 'connext', 'cbridge'];
      const hasKnown = knownBridges.some(b => bridgeKeys.includes(b));
      expect(hasKnown).toBe(true);
    });

    test('exchanges array contains known DEXs', async () => {
      const tools = await client.getTools();
      const exchangeKeys = tools.exchanges.map(e => e.key);
      const knownDexs = ['uniswap', '1inch', 'paraswap', 'openocean', 'sushiswap'];
      const hasKnown = knownDexs.some(d => exchangeKeys.includes(d));
      expect(hasKnown).toBe(true);
    });

    test('each tool has key and name', async () => {
      const tools = await client.getTools();
      for (const tool of [...tools.bridges, ...tools.exchanges]) {
        expect(tool.key).toBeTruthy();
        expect(tool.name).toBeTruthy();
      }
    });
  });

  test.describe('chain filter', () => {
    test('returns tools filtered to Polygon', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tools?chains=${CHAINS.POLYGON}`
      );
      assertOk(response);
      const data = await response.json();
      assertToolsShape(data);
    });

    test('returns tools filtered to multiple chains', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/tools?chains=${CHAINS.POLYGON},${CHAINS.ARBITRUM}`
      );
      assertOk(response);
    });
  });

  test.describe('performance', () => {
    test('completes within 3 seconds', async ({ request }) => {
      const start = Date.now();
      const response = await request.get('https://li.quest/v1/tools');
      assertOk(response);
      assertResponseTime(start, 3000);
    });

    test('cached second call is instant', async () => {
      const start1 = Date.now();
      await client.getTools();
      const first = Date.now() - start1;

      const start2 = Date.now();
      await client.getTools();
      const second = Date.now() - start2;

      expect(second).toBeLessThan(first);
      expect(second).toBeLessThan(10);
    });
  });
});
