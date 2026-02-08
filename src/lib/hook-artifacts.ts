import type { Abi, Hex } from "viem";
import limitOrderHookArtifact from "../../contracts/out/LimitOrderhook.sol/LimitOrderhook.json";
import limitOrderOnlyArtifact from "../../contracts/out/LimitOrderOnlyHook.sol/LimitOrderOnlyHook.json";
import feeThresholdArtifact from "../../contracts/out/FeeThresholdHook.sol/FeeThresholdHook.json";
import hookFactoryArtifact from "../../contracts/out/HookFactory.sol/HookFactory.json";
import simpleSwapRouterArtifact from "../../contracts/out/SimpleSwapRouter.sol/SimpleSwapRouter.json";

export interface HookArtifact {
  abi: Abi;
  bytecode: Hex;
}

export const LIMIT_ORDER_HOOK: HookArtifact = {
  abi: limitOrderHookArtifact.abi as Abi,
  bytecode: limitOrderHookArtifact.bytecode.object as Hex,
};

export const LIMIT_ORDER_ONLY_HOOK: HookArtifact = {
  abi: limitOrderOnlyArtifact.abi as Abi,
  bytecode: limitOrderOnlyArtifact.bytecode.object as Hex,
};

export const FEE_THRESHOLD_HOOK: HookArtifact = {
  abi: feeThresholdArtifact.abi as Abi,
  bytecode: feeThresholdArtifact.bytecode.object as Hex,
};

export const HOOK_FACTORY: HookArtifact = {
  abi: hookFactoryArtifact.abi as Abi,
  bytecode: hookFactoryArtifact.bytecode.object as Hex,
};

export const SIMPLE_SWAP_ROUTER: HookArtifact = {
  abi: simpleSwapRouterArtifact.abi as Abi,
  bytecode: simpleSwapRouterArtifact.bytecode.object as Hex,
};
