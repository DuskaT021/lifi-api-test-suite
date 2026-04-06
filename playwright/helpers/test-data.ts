/**
 * Shared test data — chain IDs, token addresses, test wallets, security payloads
 *
 * Centralised here so specs don't hardcode values and changes propagate everywhere.
 */

// -- Chain IDs ---------------------------------------------------------------

export const CHAINS = {
  ETHEREUM:  '1',
  POLYGON:   '137',
  ARBITRUM:  '42161',
  OPTIMISM:  '10',
  BASE:      '8453',
  BSC:       '56',
  AVALANCHE: '43114',
} as const;

// -- Token addresses ---------------------------------------------------------

export const TOKENS = {
  // Native ETH (used across EVM chains)
  ETH_NATIVE: '0x0000000000000000000000000000000000000000',

  // USDC — canonical addresses per chain
  USDC_ETHEREUM:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDC_POLYGON:   '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDC_ARBITRUM:  '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  USDC_OPTIMISM:  '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  USDC_BASE:      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',

  // USDT
  USDT_ETHEREUM:  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  USDT_POLYGON:   '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',

  // DAI
  DAI_ETHEREUM:   '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  DAI_POLYGON:    '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',

  // WETH
  WETH_ETHEREUM:  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  WETH_ARBITRUM:  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
} as const;

// -- Test wallet -------------------------------------------------------------

// Publicly known test wallet — no private key, safe to use in tests
export const TEST_WALLET = '0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0';

// -- Test amounts ------------------------------------------------------------

// 1 USDC = 1_000_000 (6 decimals)
export const TEST_AMOUNT_USDC = '1000000';

// 0.001 ETH = 1_000_000_000_000_000 (18 decimals)
export const TEST_AMOUNT_ETH = '1000000000000000';

// -- Required fields ---------------------------------------------------------

export const REQUIRED_TOKEN_FIELDS = [
  'address',
  'symbol',
  'decimals',
  'chainId',
  'name',
  'priceUSD',
] as const;

export const REQUIRED_CHAIN_FIELDS = [
  'id',
  'key',
  'name',
  'chainType',
  'coin',
  'nativeToken',
] as const;

export const REQUIRED_QUOTE_FIELDS = [
  'type',
  'id',
  'tool',
  'action',
  'estimate',
] as const;

// -- Security payloads -------------------------------------------------------

export const SECURITY_PAYLOADS = {
  SQL_INJECTION: "1' OR '1'='1",
  XSS:           '<script>alert(1)</script>',
  NULL_BYTE:     'polygon\x00',
  LONG_STRING:   'a'.repeat(1000),
} as const;
