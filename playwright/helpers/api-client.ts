/**
 * LI.FI API Client
 *
 * Centralises all API calls and implements response caching for
 * endpoints whose data changes infrequently (tokens, chains, tools).
 *
 * Caching strategy:
 * - /tokens  : cached for entire test run — large payload, rarely changes
 * - /chains  : cached for entire test run — chain list is stable
 * - /tools   : cached for entire test run — bridge/DEX list is stable
 * - /quote   : never cached — real-time routing data, must be fresh
 * - /routes  : never cached — real-time routing data, must be fresh
 */

import { APIRequestContext } from '@playwright/test';

export const BASE_URL = 'https://li.quest/v1';

// -- Types ------------------------------------------------------------------

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  name: string;
  coinKey: string;
  priceUSD: string;
  logoURI?: string;
}

export interface Chain {
  id: number;
  key: string;
  name: string;
  chainType: string;
  coin: string;
  mainnetId?: number;
  logoURI?: string;
  tokenlistUrl?: string;
  multicallAddress?: string;
  nativeToken: Token;
}

export interface Tool {
  key: string;
  name: string;
  logoURI?: string;
  supportedChains?: number[];
}

export interface ToolsResponse {
  bridges: Tool[];
  exchanges: Tool[];
}

export interface QuoteResponse {
  type: string;
  id: string;
  tool: string;
  toolDetails: Record<string, unknown>;
  action: Record<string, unknown>;
  estimate: {
    tool: string;
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    executionDuration: number;
    feeCosts: unknown[];
    gasCosts: unknown[];
  };
  transactionRequest?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
    chainId: number;
  };
}

// -- In-memory cache --------------------------------------------------------

const cache: {
  tokens?: Record<string, Token[]>;
  chains?: Chain[];
  tools?: ToolsResponse;
} = {};

// -- API Client -------------------------------------------------------------

export class LiFiApiClient {
  constructor(private request: APIRequestContext) {}

  /**
   * GET /tokens
   * Cached for the duration of the test run.
   * Filtered to specific chains to avoid fetching the entire token universe.
   */
  async getTokens(chains?: string): Promise<Record<string, Token[]>> {
    if (cache.tokens) return cache.tokens;

    const params = new URLSearchParams();
    // Always filter by chain to reduce payload size — fetching all tokens
    // without filtering returns 100k+ tokens and is slow
    if (chains) params.set('chains', chains);

    const response = await this.request.get(`${BASE_URL}/tokens?${params}`);
    const data = await response.json();
    cache.tokens = data;
    return data;
  }

  /**
   * GET /token
   * Single token lookup — not cached (low payload, used for targeted checks)
   */
  async getToken(chain: string, token: string) {
    const response = await this.request.get(
      `${BASE_URL}/token?chain=${chain}&token=${token}`
    );
    return { response, data: await response.json() };
  }

  /**
   * GET /chains
   * Cached for the duration of the test run.
   */
  async getChains(chainTypes?: string): Promise<Chain[]> {
    if (cache.chains) return cache.chains;

    const params = chainTypes ? `?chainTypes=${chainTypes}` : '';
    const response = await this.request.get(`${BASE_URL}/chains${params}`);
    const data = await response.json();
    cache.chains = data.chains ?? data;
    return cache.chains!;
  }

  /**
   * GET /tools
   * Cached for the duration of the test run.
   */
  async getTools(chains?: number[]): Promise<ToolsResponse> {
    if (cache.tools) return cache.tools;

    const params = chains ? `?chains=${chains.join(',')}` : '';
    const response = await this.request.get(`${BASE_URL}/tools${params}`);
    const data = await response.json();
    cache.tools = data;
    return data;
  }

  /**
   * GET /connections
   * Not cached — depends on filter params
   */
  async getConnections(params: {
    fromChain?: string;
    toChain?: string;
    fromToken?: string;
    toToken?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)) as Record<string, string>
    );
    const response = await this.request.get(`${BASE_URL}/connections?${query}`);
    return { response, data: await response.json() };
  }

  /**
   * GET /quote
   * Never cached — real-time routing data.
   */
  async getQuote(params: {
    fromChain: string;
    toChain: string;
    fromToken: string;
    toToken: string;
    fromAddress: string;
    fromAmount: string;
    slippage?: string;
    order?: 'RECOMMENDED' | 'FASTEST' | 'CHEAPEST' | 'SAFEST';
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)) as Record<string, string>
    );
    const response = await this.request.get(`${BASE_URL}/quote?${query}`);
    return { response, data: await response.json() };
  }

  /**
   * POST /advanced/routes
   * Never cached — real-time routing data.
   */
  async getRoutes(body: Record<string, unknown>) {
    const response = await this.request.post(`${BASE_URL}/advanced/routes`, {
      data: body,
      headers: { 'Content-Type': 'application/json' }
    });
    return { response, data: await response.json() };
  }

  /**
   * GET /status
   */
  async getStatus(txHash: string, bridge?: string, fromChain?: string, toChain?: string) {
    const params = new URLSearchParams({ txHash });
    if (bridge) params.set('bridge', bridge);
    if (fromChain) params.set('fromChain', fromChain);
    if (toChain) params.set('toChain', toChain);
    const response = await this.request.get(`${BASE_URL}/status?${params}`);
    return { response, data: await response.json() };
  }

  /** Clear the in-memory cache (useful between test suites if needed) */
  static clearCache() {
    delete cache.tokens;
    delete cache.chains;
    delete cache.tools;
  }
}
