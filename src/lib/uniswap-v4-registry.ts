import type { Address } from "viem";
import { sepolia } from "viem/chains";

export interface V4ChainAddresses {
  poolManager?: Address;
  positionManager?: Address;
  stateView?: Address;
  universalRouter?: Address;
  permit2?: Address;
  weth9?: Address;
  notes?: string;
}

export const PERMIT2_ADDRESS =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;

export const V4_REGISTRY: Record<number, V4ChainAddresses> = {
  [sepolia.id]: {
    poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    positionManager: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4",
    stateView: "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c",
    universalRouter: "0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b",
    permit2: PERMIT2_ADDRESS,
    notes: "Uniswap Foundation v4 test interface deployment (Sepolia)",
  },
};

export function getV4Addresses(chainId: number): V4ChainAddresses | null {
  return V4_REGISTRY[chainId] ?? null;
}

export function isV4Supported(chainId: number): boolean {
  const entry = getV4Addresses(chainId);
  return Boolean(entry?.poolManager && entry?.positionManager && entry?.stateView);
}

export function getPermit2(chainId: number): Address | null {
  return getV4Addresses(chainId)?.permit2 ?? PERMIT2_ADDRESS;
}
