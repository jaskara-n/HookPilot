import { useState, useCallback } from 'react';
import { queryHookRegistry, generateCREATE2Salt, generateMockHookAddress, type HookFlags, type AuditedHook, NEW_DEPLOY_GAS_ESTIMATE } from '@/lib/mock-registry';
import type { PoolConfig } from '@/components/wizard/PoolTypeSelector';
import { mainnet } from 'viem/chains';

export interface WizardState {
  currentStep: number;
  poolConfig: PoolConfig;
  flags: HookFlags;
  agentPrompt: string;
  auditedHook: AuditedHook | null;
  deployChoice: 'existing' | 'custom' | null;
  isMining: boolean;
  create2Salt: string | null;
  deployedAddress: string | null;
}

const initialState: WizardState = {
  currentStep: 0,
  poolConfig: {
    chainId: mainnet.id,
    tokenA: null,
    tokenB: null,
    tokenAAddress: '',
    tokenBAddress: '',
  },
  flags: {
    dynamicFees: false,
    limitOrders: false,
    timeLock: false,
    whitelist: false,
  },
  agentPrompt: '',
  auditedHook: null,
  deployChoice: null,
  isMining: false,
  create2Salt: null,
  deployedAddress: null,
};

export function useWizardState() {
  const [state, setState] = useState<WizardState>(initialState);

  const setPoolConfig = useCallback((poolConfig: PoolConfig) => {
    setState(prev => ({ ...prev, poolConfig }));
  }, []);

  const setFlags = useCallback((flags: HookFlags) => {
    setState(prev => ({ ...prev, flags }));
  }, []);

  const setAgentPrompt = useCallback((agentPrompt: string) => {
    setState(prev => ({ ...prev, agentPrompt }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState(prev => {
      // When moving to step 3 (Decision), query the registry
      if (step === 2) {
        const auditedHook = queryHookRegistry(prev.flags);
        return { ...prev, currentStep: step, auditedHook };
      }
      return { ...prev, currentStep: step };
    });
  }, []);

  const nextStep = useCallback(() => {
    goToStep(state.currentStep + 1);
  }, [state.currentStep, goToStep]);

  const prevStep = useCallback(() => {
    goToStep(Math.max(0, state.currentStep - 1));
  }, [state.currentStep, goToStep]);

  const selectDeployChoice = useCallback((choice: 'existing' | 'custom') => {
    setState(prev => ({ ...prev, deployChoice: choice }));
  }, []);

  const startMining = useCallback(async () => {
    setState(prev => ({ ...prev, isMining: true }));
    
    // Simulate 5-second mining animation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const salt = generateCREATE2Salt();
    const address = generateMockHookAddress(salt);
    
    setState(prev => ({
      ...prev,
      isMining: false,
      create2Salt: salt,
      deployedAddress: address,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const canProceed = useCallback((step: number): boolean => {
    switch (step) {
      case 0: {
        const { poolConfig } = state;
        if (poolConfig.tokenA && poolConfig.tokenB) {
          return poolConfig.tokenA !== poolConfig.tokenB;
        }
        return isValidAddress(poolConfig.tokenAAddress) && isValidAddress(poolConfig.tokenBAddress);
      }
      case 1:
        return Object.values(state.flags).some(Boolean) || state.agentPrompt.length > 0;
      case 2:
        return state.deployChoice !== null;
      default:
        return true;
    }
  }, [state]);

  const getGasEstimate = useCallback(() => {
    if (state.auditedHook) {
      return {
        existing: state.auditedHook.gasEstimate,
        custom: NEW_DEPLOY_GAS_ESTIMATE,
      };
    }
    return {
      existing: null,
      custom: NEW_DEPLOY_GAS_ESTIMATE,
    };
  }, [state.auditedHook]);

  // Helper to get display token names
  const getTokenDisplay = useCallback(() => {
    const { poolConfig } = state;
    const tokenA = poolConfig.tokenA || (poolConfig.tokenAAddress ? `${poolConfig.tokenAAddress.slice(0, 6)}...` : null);
    const tokenB = poolConfig.tokenB || (poolConfig.tokenBAddress ? `${poolConfig.tokenBAddress.slice(0, 6)}...` : null);
    return { tokenA, tokenB };
  }, [state.poolConfig]);

  return {
    state,
    setPoolConfig,
    setFlags,
    setAgentPrompt,
    goToStep,
    nextStep,
    prevStep,
    selectDeployChoice,
    startMining,
    reset,
    canProceed,
    getGasEstimate,
    getTokenDisplay,
  };
}
