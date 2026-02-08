export interface HookFlags {
  feeThreshold: boolean;
  limitOrders: boolean;
}

export interface AuditedHook {
  address: string;
  name: string;
  auditor: string;
  gasEstimate: number;
  chainId: number;
  flags: HookFlags;
}

const AUDITED_HOOKS: AuditedHook[] = [];

export function queryHookRegistry(flags: HookFlags, chainId: number): AuditedHook | null {
  return (
    AUDITED_HOOKS.find(
      (hook) =>
        hook.chainId === chainId &&
        hook.flags.feeThreshold === flags.feeThreshold &&
        hook.flags.limitOrders === flags.limitOrders,
    ) ?? null
  );
}

export const NEW_DEPLOY_GAS_ESTIMATE = 2_100_000;
