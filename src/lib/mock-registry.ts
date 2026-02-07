// Mock Hook Registry - simulates on-chain lookup
// User will implement real contract calls later

export interface HookFlags {
  feeThreshold: boolean;
  limitOrders: boolean;
}

export interface AuditedHook {
  address: string;
  name: string;
  auditor: string;
  gasEstimate: number;
}

// Mock database of audited hooks
const AUDITED_HOOKS: Record<string, AuditedHook> = {
  // Fee Threshold only
  '10': {
    address: '0x1111111111111111111111111111111111111111',
    name: 'FeeThresholdHook v1.0',
    auditor: 'OpenZeppelin',
    gasEstimate: 42000,
  },
  // Limit Orders only
  '01': {
    address: '0x2222222222222222222222222222222222222222',
    name: 'LimitOrderHook v1.0',
    auditor: 'Trail of Bits',
    gasEstimate: 52000,
  },
  // Fee Threshold + Limit Orders
  '11': {
    address: '0x3333333333333333333333333333333333333333',
    name: 'FeeThresholdLimitOrderHook v1.0',
    auditor: 'Consensys Diligence',
    gasEstimate: 68000,
  },
};

function flagsToKey(flags: HookFlags): string {
  return `${flags.feeThreshold ? '1' : '0'}${flags.limitOrders ? '1' : '0'}`;
}

export function queryHookRegistry(flags: HookFlags): AuditedHook | null {
  const key = flagsToKey(flags);
  return AUDITED_HOOKS[key] || null;
}

export function generateCREATE2Salt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateMockHookAddress(salt: string): string {
  // Simulate CREATE2 address derivation
  const hash = salt.slice(2, 42);
  return `0x${hash}`;
}

export const NEW_DEPLOY_GAS_ESTIMATE = 2100000;
