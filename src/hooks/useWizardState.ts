import { useState, useCallback } from "react";
import {
  queryHookRegistry,
  type HookFlags,
  type AuditedHook,
  NEW_DEPLOY_GAS_ESTIMATE,
} from "@/lib/hook-registry";
import type { PoolConfig } from "@/components/wizard/PoolSelectStep";
import { mainnet } from "viem/chains";

export interface WizardState {
  currentStep: number;
  poolConfig: PoolConfig;
  flags: HookFlags;
  agentPrompt: string;
  auditedHook: AuditedHook | null;
  deployChoice: "existing" | "custom" | null;
  deployedAddress: string | null;
}

const initialState: WizardState = {
  currentStep: 0,
  poolConfig: {
    chainId: mainnet.id,
    tokenAInput: "",
    tokenBInput: "",
    feeTier: 3000,
    tokenAAddress: "",
    tokenBAddress: "",
    tickSpacing: 60,
    stablecoinInput: "",
    stablecoinAddress: "",
    treasuryAddress: "",
  },
  flags: {
    feeThreshold: false,
    limitOrders: false,
  },
  agentPrompt: "",
  auditedHook: null,
  deployChoice: null,
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
        const auditedHook = queryHookRegistry(prev.flags, prev.poolConfig.chainId);
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

  const setDeployedAddress = useCallback((deployedAddress: string | null) => {
    setState((prev) => ({ ...prev, deployedAddress }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const canProceed = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 0: {
          const { poolConfig } = state;
          if (!poolConfig.tokenAAddress || !poolConfig.tokenBAddress) {
            return false;
          }
          if (!poolConfig.stablecoinAddress) {
            return false;
          }
          if (!/^0x[a-fA-F0-9]{40}$/.test(poolConfig.treasuryAddress)) {
            return false;
          }
          return (
            poolConfig.tokenAAddress.toLowerCase() !==
            poolConfig.tokenBAddress.toLowerCase()
          );
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
    setDeployedAddress,
    reset,
    canProceed,
    getGasEstimate,
  };
}
