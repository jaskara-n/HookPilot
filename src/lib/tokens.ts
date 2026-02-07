import type { Address } from "viem";
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from "viem/chains";

export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;
  chainId: number;
}

const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const EXTRA_TOKENS: Record<number, TokenInfo[]> = {
  [mainnet.id]: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      chainId: mainnet.id,
    },
    {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      chainId: mainnet.id,
    },
  ],
};

const SUPPORTED_CHAINS = [mainnet, base, optimism, arbitrum, polygon, sepolia] as const;

export function getCommonTokens(chainId: number): TokenInfo[] {
  const chain = SUPPORTED_CHAINS.find((item) => item.id === chainId);
  if (!chain) {
    return [];
  }

  const nativeToken: TokenInfo = {
    symbol: chain.nativeCurrency.symbol,
    name: chain.nativeCurrency.name,
    address: NATIVE_ADDRESS,
    chainId: chain.id,
  };

  return [nativeToken, ...(EXTRA_TOKENS[chain.id] ?? [])];
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function resolveTokenInput(input: string, chainId: number) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const tokens = getCommonTokens(chainId);
  const lower = trimmed.toLowerCase();

  const bySymbol = tokens.find((token) => token.symbol.toLowerCase() === lower);
  if (bySymbol) {
    return { address: bySymbol.address, token: bySymbol };
  }

  if (ADDRESS_REGEX.test(trimmed)) {
    const byAddress = tokens.find((token) => token.address.toLowerCase() === lower);
    return { address: trimmed as Address, token: byAddress };
  }

  return null;
}

export function formatTokenDisplay(input: string, chainId: number) {
  const resolved = resolveTokenInput(input, chainId);
  if (!resolved) {
    return null;
  }

  if (resolved.token) {
    return resolved.token.symbol;
  }

  return `${resolved.address.slice(0, 6)}...${resolved.address.slice(-4)}`;
}
