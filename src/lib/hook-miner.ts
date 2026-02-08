import { concatHex, keccak256, toHex, type Address, type Hex, hexToBigInt } from "viem";

const ALL_HOOK_MASK = (1n << 14n) - 1n;
const BEFORE_SWAP_FLAG = 1n << 7n;
const AFTER_SWAP_FLAG = 1n << 6n;

export const REQUIRED_HOOK_FLAGS = BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG;

export function isValidHookAddress(address: Address, requiredMask: bigint = REQUIRED_HOOK_FLAGS) {
  return (hexToBigInt(address) & ALL_HOOK_MASK) === requiredMask;
}

export function computeCreate2Address(
  deployer: Address,
  salt: Hex,
  initCodeHash: Hex,
): Address {
  const packed = concatHex(["0xff", deployer, salt, initCodeHash]);
  const hash = keccak256(packed);
  return ("0x" + hash.slice(-40)) as Address;
}

export function formatSalt(n: bigint): Hex {
  return toHex(n, { size: 32 });
}

export async function mineHookSalt(params: {
  deployer: Address;
  initCodeHash: Hex;
  requiredMask?: bigint;
  startNonce?: bigint;
  maxAttempts?: number;
  onProgress?: (attempts: number) => void;
}) {
  const {
    deployer,
    initCodeHash,
    requiredMask = REQUIRED_HOOK_FLAGS,
    startNonce = 1n,
    maxAttempts = 200000,
    onProgress,
  } = params;

  let attempts = 0;
  let nonce = startNonce;
  const chunkSize = 5000;

  while (attempts < maxAttempts) {
    for (let i = 0; i < chunkSize && attempts < maxAttempts; i++) {
      const salt = formatSalt(nonce);
      const address = computeCreate2Address(deployer, salt, initCodeHash);
      if (isValidHookAddress(address, requiredMask)) {
        return { salt, address, attempts };
      }
      attempts += 1;
      nonce += 1n;
    }

    onProgress?.(attempts);
    // Yield to the UI thread
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return null;
}
