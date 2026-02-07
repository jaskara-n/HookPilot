import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from 'wagmi/chains';

export const chains = [mainnet, base, optimism, arbitrum, polygon, sepolia] as const;

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const config = getDefaultConfig({
  appName: 'HookWizard',
  projectId: projectId || 'YOUR_PROJECT_ID',
  chains,
  ssr: false,
});

// Mock HookRegistry Contract
export const HOOK_REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890' as const;
export const POOL_MANAGER_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;

export const HOOK_REGISTRY_ABI = [
  {
    name: 'getAuditedHook',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'hookFlags', type: 'uint256' }],
    outputs: [{ name: 'hookAddress', type: 'address' }],
  },
  {
    name: 'deployHook',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'hookFlags', type: 'uint256' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: 'hookAddress', type: 'address' }],
  },
] as const;

export const POOL_MANAGER_ABI = [
  {
    name: 'initialize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'key', type: 'tuple', components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
      ]},
      { name: 'sqrtPriceX96', type: 'uint160' },
    ],
    outputs: [{ name: 'tick', type: 'int24' }],
  },
] as const;
