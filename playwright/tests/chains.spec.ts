/**
 * /chains endpoint tests
 *
 * Foundation spec — chains data underpins all routing.
 * Response is cached via LiFiApiClient.
 */

import { test, expect } from '@playwright/test';
import { LiFiApiClient } from '../helpers/api-client';
import {
  assertOk,
  assertBadRequest,
  assertChainShape,
  assertResponseTime,
  assertNoSensitiveDataLeaked,
} from '../helpers/assertions';
import { CHAINS, SECURITY_PAYLOADS } from '../helpers/test-data';

test.describe('/chains endpoint', () => {
  let client: LiFiApiClient;

  test.beforeEach(({ request }) => {
    client = new LiFiApiClient(request);
  });

  test.describe('basic response', () => {
    test('returns 200 with array of chains', async ({ request }) => {
      const start = Date.now();
      const response = await request.get('https://li.quest/v1/chains');
      assertOk(response);
      assertResponseTime(start, 3000);

      const data = await response.json();
      const chains = data.chains ?? data;
      expect(Array.isArray(chains)).toBe(true);
      expect(chains.length).toBeGreaterThan(0);
    });

    test('each chain has required fields', async () => {
      const chains = await client.getChains();
      const sample = chains.slice(0, 10);
      for (const chain of sample) {
        assertChainShape(chain);
      }
    });

    test('includes Ethereum mainnet (id: 1)', async () => {
      const chains = await client.getChains();
      const eth = chains.find(c => c.id === 1);
      expect(eth).toBeDefined();
      expect(eth!.key.toLowerCase()).toBe('eth');
    });

    test('includes Polygon (id: 137)', async () => {
      const chains = await client.getChains();
      const polygon = chains.find(c => c.id === parseInt(CHAINS.POLYGON));
      expect(polygon).toBeDefined();
    });

    test('includes Arbitrum (id: 42161)', async () => {
      const chains = await client.getChains();
      const arb = chains.find(c => c.id === parseInt(CHAINS.ARBITRUM));
      expect(arb).toBeDefined();
    });

    test('response does not contain sensitive data', async ({ request }) => {
      const response = await request.get('https://li.quest/v1/chains');
      const body = await response.text();
      assertNoSensitiveDataLeaked(body);
    });
  });

  test.describe('chainTypes filter', () => {
    test('returns only EVM chains when chainTypes=EVM', async ({ request }) => {
      const response = await request.get('https://li.quest/v1/chains?chainTypes=EVM');
      assertOk(response);
      const data = await response.json();
      const chains = data.chains ?? data;
      for (const chain of chains) {
        expect(chain.chainType).toBe('EVM');
      }
    });

    test('handles unknown chainType gracefully', async ({ request }) => {
      const response = await request.get('https://li.quest/v1/chains?chainTypes=UNKNOWN');
      expect([200, 400]).toContain(response.status());
    });
  });

  test.describe('native token', () => {
    test('each chain has a nativeToken with required fields', async () => {
      const chains = await client.getChains();
      const sample = chains.slice(0, 5);
      for (const chain of sample) {
        expect(chain.nativeToken).toBeDefined();
        expect(chain.nativeToken.symbol).toBeTruthy();
        expect(chain.nativeToken.decimals).toBeGreaterThanOrEqual(0);
      }
    });

    test('Ethereum nativeToken is ETH', async () => {
      const chains = await client.getChains();
      const eth = chains.find(c => c.id === 1);
      expect(eth!.nativeToken.symbol).toBe('ETH');
      expect(eth!.nativeToken.decimals).toBe(18);
    });
  });

  test.describe('security', () => {
    test('handles SQL injection in chainTypes gracefully', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/chains?chainTypes=${encodeURIComponent(SECURITY_PAYLOADS.SQL_INJECTION)}`
      );
      expect(response.status()).not.toBe(500);
    });

    test('handles XSS payload in chainTypes gracefully', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/chains?chainTypes=${encodeURIComponent(SECURITY_PAYLOADS.XSS)}`
      );
      const body = await response.text();
      expect(body).not.toContain('<script>');
    });
  });

  test.describe('performance', () => {
    test('completes within 3 seconds', async ({ request }) => {
      const start = Date.now();
      const response = await request.get('https://li.quest/v1/chains');
      assertOk(response);
      assertResponseTime(start, 3000);
    });

    test('cached second call is instant', async () => {
      const start1 = Date.now();
      await client.getChains();
      const first = Date.now() - start1;

      const start2 = Date.now();
      await client.getChains();
      const second = Date.now() - start2;

      expect(second).toBeLessThan(first);
      expect(second).toBeLessThan(10);
    });
  });
});
