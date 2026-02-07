import { useState, useCallback } from "react";
import {
  queryHookRegistry,
  generateCREATE2Salt,
  generateMockHookAddress,
  type HookFlags,
  type AuditedHook,
  NEW_DEPLOY_GAS_ESTIMATE,
} from "@/lib/mock-registry";
import type { PoolConfig } from "@/components/wizard/PoolSelectStep";
import { mainnet } from "viem/chains";
import { resolveTokenInput } from "@/lib/tokens";

export interface WizardState {
  currentStep: number;
  poolConfig: PoolConfig;
  flags: HookFlags;
  agentPrompt: string;
  auditedHook: AuditedHook | null;
  deployChoice: "existing" | "custom" | null;
  isMining: boolean;
  create2Salt: string | null;
  deployedAddress: string | null;
}

const initialState: WizardState = {
  currentStep: 0,
  poolConfig: {
    chainId: mainnet.id,
    tokenAInput: "",
    tokenBInput: "",
    feeTier: 3000,
  },
  flags: {
    dynamicFees: false,
    limitOrders: false,
    timeLock: false,
    whitelist: false,
  },
  agentPrompt: "",
  auditedHook: null,
  deployChoice: null,
  isMining: false,
  create2Salt: null,
  deployedAddress: null,
};

export function useWizardState() {
  const [state, setState] = useState<WizardState>(initialState);

  const setPoolConfig = useCallback((poolConfig: PoolConfig) => {
    setState((prev) => ({ ...prev, poolConfig }));
  }, []);

  const setFlags = useCallback((flags: HookFlags) => {
    setState((prev) => ({ ...prev, flags }));
  }, []);

  const setAgentPrompt = useCallback((agentPrompt: string) => {
    setState((prev) => ({ ...prev, agentPrompt }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => {
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

  const selectDeployChoice = useCallback((choice: "existing" | "custom") => {
    setState((prev) => ({ ...prev, deployChoice: choice }));
  }, []);

  const startMining = useCallback(async () => {
    setState((prev) => ({ ...prev, isMining: true }));

    // Simulate 5-second mining animation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const salt = generateCREATE2Salt();
    const address = generateMockHookAddress(salt);

    setState((prev) => ({
      ...prev,
      isMining: false,
      create2Salt: salt,
      deployedAddress: address,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const canProceed = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 0: {
          const { poolConfig } = state;
          const tokenA = resolveTokenInput(
            poolConfig.tokenAInput,
            poolConfig.chainId,
          );
          const tokenB = resolveTokenInput(
            poolConfig.tokenBInput,
            poolConfig.chainId,
          );
          if (!tokenA?.address || !tokenB?.address) {
            return false;
          }
          return tokenA.address.toLowerCase() !== tokenB.address.toLowerCase();
        }
        case 1:
          return (
            Object.values(state.flags).some(Boolean) ||
            state.agentPrompt.length > 0
          );
        case 2:
          return state.deployChoice !== null;
        default:
          return true;
      }
    },
    [state],
  );

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
  };
}
