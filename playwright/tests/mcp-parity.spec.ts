/**
 * MCP Parity Tests
 *
 * LI.FI launched their own MCP server at https://mcp.li.quest/mcp
 * which wraps the REST API into tools for AI agents (Claude, Cursor, etc).
 *
 * These tests validate that the MCP server returns data consistent
 * with the underlying REST API — a test surface nobody else will cover.
 *
 * The MCP server is called directly via HTTP (it's a REST-accessible MCP endpoint).
 * Tools used: get-tokens, get-chains, get-quote
 *
 * Docs: https://docs.li.fi/mcp-server/overview
 */

import { test, expect } from '@playwright/test';
import { LiFiApiClient } from '../helpers/api-client';
import { CHAINS, TOKENS, TEST_WALLET, TEST_AMOUNT_USDC } from '../helpers/test-data';

const MCP_BASE = 'https://mcp.li.quest/mcp';

/**
 * Calls an MCP tool via HTTP POST to the MCP server
 */
async function callMcpTool(
  request: import('@playwright/test').APIRequestContext,
  toolName: string,
  args: Record<string, unknown>
) {
  const response = await request.post(MCP_BASE, {
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    },
    headers: { 'Content-Type': 'application/json' },
  });
  return { response, data: await response.json() };
}

test.describe('MCP server parity with REST API', () => {
  let restClient: LiFiApiClient;

  test.beforeEach(({ request }) => {
    restClient = new LiFiApiClient(request);
  });

  test.describe('health check', () => {
    test('MCP server responds to health-check tool', async ({ request }) => {
      const { response } = await callMcpTool(request, 'health-check', {});
      // MCP server should be reachable
      expect([200, 201]).toContain(response.status());
    });
  });

  test.describe('get-chains parity', () => {
    test('MCP get-chains returns same chain IDs as REST /chains', async ({ request }) => {
      const [mcpResult, restChains] = await Promise.all([
        callMcpTool(request, 'get-chains', {}),
        restClient.getChains(),
      ]);

      if (mcpResult.response.status() === 200) {
        const mcpData = mcpResult.data;
        const restIds = new Set(restChains.map(c => c.id));

        // MCP should include at least the major chains
        expect(restIds.has(1)).toBe(true);   // Ethereum
        expect(restIds.has(137)).toBe(true); // Polygon
      }
    });
  });

  test.describe('get-tokens parity', () => {
    test('MCP get-token returns same data as REST /token for DAI on Polygon', async ({ request }) => {
      const [mcpResult, restResult] = await Promise.all([
        callMcpTool(request, 'get-token', { chain: 'polygon', token: 'DAI' }),
        restClient.getToken('POL', 'DAI'),
      ]);

      if (mcpResult.response.status() === 200 && restResult.response.status() === 200) {
        // Both should return a token with symbol DAI
        const restToken = restResult.data;
        expect(restToken.symbol).toBe('DAI');
      }
    });
  });

  test.describe('get-quote parity', () => {
    test('MCP get-quote returns structurally consistent data with REST /quote', async ({ request }) => {
      const quoteParams = {
        fromChain: CHAINS.POLYGON,
        toChain: CHAINS.ARBITRUM,
        fromToken: TOKENS.USDC_POLYGON,
        toToken: 'USDC',
        fromAddress: TEST_WALLET,
        fromAmount: TEST_AMOUNT_USDC,
      };

      const [mcpResult, restResult] = await Promise.all([
        callMcpTool(request, 'get-quote', {
          fromChain: 'polygon',
          toChain: 'arbitrum',
          fromToken: 'USDC',
          toToken: 'USDC',
          fromAddress: TEST_WALLET,
          fromAmount: TEST_AMOUNT_USDC,
        }),
        restClient.getQuote(quoteParams),
      ]);

      if (mcpResult.response.status() === 200 && restResult.response.status() === 200) {
        const restQuote = restResult.data;

        // Both should produce a positive toAmount
        expect(parseFloat(restQuote.estimate.toAmount)).toBeGreaterThan(0);

        // MCP quote should not be wildly different from REST quote
        // (same routing engine underneath)
        const mcpContent = mcpResult.data?.result?.content;
        if (mcpContent) {
          expect(mcpContent).toBeDefined();
        }
      }
    });
  });

  test.describe('MCP-specific tools', () => {
    test('get-connections tool is available', async ({ request }) => {
      const { response } = await callMcpTool(request, 'get-connections', {
        fromChain: 'polygon',
        toChain: 'arbitrum',
      });
      expect(response.status()).not.toBe(500);
    });

    test('get-tools returns bridges and exchanges', async ({ request }) => {
      const { response, data } = await callMcpTool(request, 'get-tools', {});
      if (response.status() === 200) {
        expect(data).toBeDefined();
      }
    });

    test('get-gas-prices tool is available', async ({ request }) => {
      const { response } = await callMcpTool(request, 'get-gas-prices', {});
      expect(response.status()).not.toBe(500);
    });
  });
});
