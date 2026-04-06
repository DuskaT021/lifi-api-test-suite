/**
 * /quote endpoint tests
 *
 * This is LI.FI's most critical endpoint — it powers all cross-chain swaps.
 * Tests cover happy paths, parameter validation, routing logic,
 * and security. Quote responses are NEVER cached.
 */

import { test, expect } from '@playwright/test';
import { LiFiApiClient } from '../helpers/api-client';
import {
  assertOk,
  assertBadRequest,
  assertQuoteShape,
  assertResponseTime,
} from '../helpers/assertions';
import {
  CHAINS,
  TOKENS,
  TEST_WALLET,
  TEST_AMOUNT_USDC,
  TEST_AMOUNT_ETH,
  SECURITY_PAYLOADS,
} from '../helpers/test-data';

test.describe('/quote endpoint', () => {
  let client: LiFiApiClient;

  test.beforeEach(({ request }) => {
    client = new LiFiApiClient(request);
  });

  // -- Happy path tests ------------------------------------------------------

  test.describe('happy path', () => {
    test('returns valid quote for USDC Polygon -> USDC Arbitrum', async () => {
      const start = Date.now();
      const { response, data } = await client.getQuote({
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.ARBITRUM,
        fromToken: TOKENS.USDC_POLYGON,
        toToken: 'USDC',
        fromAddress: TEST_WALLET,
        fromAmount: TEST_AMOUNT_USDC,
      });

      assertOk(response);
      assertResponseTime(start, 10000);
      assertQuoteShape(data);
    });

    test('returns valid quote for ETH same-chain swap', async () => {
      const { response, data } = await client.getQuote({
        fromChain: CHAINS.ETHEREUM,
        toChain: CHAINS.ETHEREUM,
        fromToken: TOKENS.ETH_NATIVE,
        toToken: TOKENS.USDC_ETHEREUM,
        fromAddress: TEST_WALLET,
        fromAmount: TEST_AMOUNT_ETH,
      });

      assertOk(response);
      assertQuoteShape(data);
    });

    test('toAmount is greater than zero', async () => {
      const { response, data } = await client.getQuote({
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.ARBITRUM,
        fromToken: TOKENS.USDC_POLYGON,
        toToken: 'USDC',
        fromAddress: TEST_WALLET,
        fromAmount: TEST_AMOUNT_USDC,
      });

      assertOk(response);
      expect(parseFloat(data.estimate.toAmount)).toBeGreaterThan(0);
    });

    test('quote includes transactionRequest for execution', async () => {
      const { response, data } = await client.getQuote({
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.ARBITRUM,
        fromToken: TOKENS.USDC_POLYGON,
        toToken: 'USDC',
        fromAddress: TEST_WALLET,
        fromAmount: TEST_AMOUNT_USDC,
      });

      assertOk(response);
      expect(data.transactionRequest).toBeDefined();
      expect(data.transactionRequest.to).toBeTruthy();
      expect(data.transactionRequest.data).toBeTruthy();
      expect(data.transactionRequest.chainId).toBe(parseInt(CHAINS.POLYGON));
    });

    test('approvalAddress is a valid Ethereum address', async () => {
      const { response, data } = await client.getQuote({
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.ARBITRUM,
        fromToken: TOKENS.USDC_POLYGON,
        toToken: 'USDC',
        fromAddress: TEST_WALLET,
        fromAmount: TEST_AMOUNT_USDC,
      });

      assertOk(response);
      expect(data.estimate.approvalAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  // -- Order preference tests ------------------------------------------------

  test.describe('order parameter', () => {
    for (const order of ['RECOMMENDED', 'FASTEST', 'CHEAPEST', 'SAFEST'] as const) {
      test(`returns valid quote with order=${order}`, async () => {
        const { response, data } = await client.getQuote({
          fromChain: CHAINS.POLYGON,
          toChain: CHAINS.ARBITRUM,
          fromToken: TOKENS.USDC_POLYGON,
          toToken: 'USDC',
          fromAddress: TEST_WALLET,
          fromAmount: TEST_AMOUNT_USDC,
          order,
        });

        assertOk(response);
        assertQuoteShape(data);
      });
    }
  });

  // -- Slippage tests --------------------------------------------------------

  test.describe('slippage parameter', () => {
    test('accepts valid slippage of 0.03 (3%)', async () => {
      const { response } = await client.getQuote({
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.ARBITRUM,
        fromToken: TOKENS.USDC_POLYGON,
        toToken: 'USDC',
        fromAddress: TEST_WALLET,
        fromAmount: TEST_AMOUNT_USDC,
        slippage: '0.03',
      });
      assertOk(response);
    });

    test('rejects slippage greater than 1', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/quote?fromChain=${CHAINS.POLYGON}&toChain=${CHAINS.ARBITRUM}` +
        `&fromToken=${TOKENS.USDC_POLYGON}&toToken=USDC&fromAddress=${TEST_WALLET}` +
        `&fromAmount=${TEST_AMOUNT_USDC}&slippage=2`
      );
      expect(response.status()).not.toBe(200);
    });
  });

  // -- Missing parameter tests -----------------------------------------------

  test.describe('missing required parameters', () => {
    const requiredParams = ['fromChain', 'toChain', 'fromToken', 'toToken', 'fromAddress', 'fromAmount'];

    for (const missingParam of requiredParams) {
      test(`returns error when ${missingParam} is missing`, async ({ request }) => {
        const params = new URLSearchParams({
          fromChain: CHAINS.POLYGON,
          toChain: CHAINS.ARBITRUM,
          fromToken: TOKENS.USDC_POLYGON,
          toToken: 'USDC',
          fromAddress: TEST_WALLET,
          fromAmount: TEST_AMOUNT_USDC,
        });
        params.delete(missingParam);

        const response = await request.get(`https://li.quest/v1/quote?${params}`);
        assertBadRequest(response);
      });
    }
  });

  // -- Invalid value tests ---------------------------------------------------

  test.describe('invalid parameter values', () => {
    test('returns error for invalid fromChain', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/quote?fromChain=INVALID&toChain=${CHAINS.ARBITRUM}` +
        `&fromToken=${TOKENS.USDC_POLYGON}&toToken=USDC&fromAddress=${TEST_WALLET}` +
        `&fromAmount=${TEST_AMOUNT_USDC}`
      );
      assertBadRequest(response);
    });

    test('returns error for invalid wallet address', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/quote?fromChain=${CHAINS.POLYGON}&toChain=${CHAINS.ARBITRUM}` +
        `&fromToken=${TOKENS.USDC_POLYGON}&toToken=USDC&fromAddress=not_a_wallet` +
        `&fromAmount=${TEST_AMOUNT_USDC}`
      );
      assertBadRequest(response);
    });

    test('returns error for zero amount', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/quote?fromChain=${CHAINS.POLYGON}&toChain=${CHAINS.ARBITRUM}` +
        `&fromToken=${TOKENS.USDC_POLYGON}&toToken=USDC&fromAddress=${TEST_WALLET}` +
        `&fromAmount=0`
      );
      expect(response.status()).not.toBe(200);
    });
  });

  // -- Security tests --------------------------------------------------------

  test.describe('security', () => {
    test('does not reflect XSS in error response', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/quote?fromChain=${encodeURIComponent(SECURITY_PAYLOADS.XSS)}` +
        `&toChain=${CHAINS.ARBITRUM}&fromToken=USDC&toToken=USDC` +
        `&fromAddress=${TEST_WALLET}&fromAmount=${TEST_AMOUNT_USDC}`
      );
      const body = await response.text();
      expect(body).not.toContain('<script>');
    });

    test('handles SQL injection in token param safely', async ({ request }) => {
      const response = await request.get(
        `https://li.quest/v1/quote?fromChain=${CHAINS.POLYGON}&toChain=${CHAINS.ARBITRUM}` +
        `&fromToken=${encodeURIComponent(SECURITY_PAYLOADS.SQL_INJECTION)}&toToken=USDC` +
        `&fromAddress=${TEST_WALLET}&fromAmount=${TEST_AMOUNT_USDC}`
      );
      expect(response.status()).not.toBe(500);
    });
  });
});
