import type { Address } from "viem";
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  sepolia,
} from "viem/chains";
import { arcTestnet } from "@/lib/custom-chains";

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
  [base.id]: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      chainId: base.id,
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
      chainId: base.id,
    },
  ],
  [sepolia.id]: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      chainId: sepolia.id,
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      chainId: sepolia.id,
    },
  ],
  [arcTestnet.id]: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x3600000000000000000000000000000000000000",
      chainId: arcTestnet.id,
    },
  ],
};

const SUPPORTED_CHAINS = [
  mainnet,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
  arbitrum,
  polygon,
  sepolia,
  arcTestnet,
] as const;

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
    const byAddress = tokens.find(
      (token) => token.address.toLowerCase() === lower,
    );
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
