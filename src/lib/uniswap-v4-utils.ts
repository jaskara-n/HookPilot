import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export function sortCurrencies(a: Address, b: Address): { currency0: Address; currency1: Address } {
  return a.toLowerCase() < b.toLowerCase() ? { currency0: a, currency1: b } : { currency0: b, currency1: a };
}

export function buildPoolKey(params: {
  tokenA: Address;
  tokenB: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}): PoolKey {
  const { currency0, currency1 } = sortCurrencies(params.tokenA, params.tokenB);
  return {
    currency0,
    currency1,
    fee: params.fee,
    tickSpacing: params.tickSpacing,
    hooks: params.hooks,
  };
}

export function computePoolId(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "currency0", type: "address" },
        { name: "currency1", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "tickSpacing", type: "int24" },
        { name: "hooks", type: "address" },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

export function isZeroAddress(address?: string | null): boolean {
  if (!address) return true;
  return address.toLowerCase() === ZERO_ADDRESS.toLowerCase();
}
