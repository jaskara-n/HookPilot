import type { HookFlags } from "./mock-registry";
import feeThresholdHook from "../../contracts/src/brand-token/FeeThresholdHook.sol?raw";
import limitOrderHook from "../../contracts/src/brand-token/LimitOrderOnlyHook.sol?raw";
import combinedHook from "../../contracts/src/brand-token/LimitOrderhook.sol?raw";

export function generateHookCode(flags: HookFlags, agentPrompt: string): string {
  let code = "";

  if (flags.feeThreshold && flags.limitOrders) {
    code = combinedHook;
  } else if (flags.feeThreshold) {
    code = feeThresholdHook;
  } else if (flags.limitOrders) {
    code = limitOrderHook;
  } else {
    code = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Select a feature to generate hook code.`;
  }

  if (!agentPrompt.trim()) {
    return code;
  }

  return `${code}

/* -------------------------------------------------------------
 * Agent Prompt (for reference)
 * ${agentPrompt.replace(/\n/g, "\n * ")}
 * ------------------------------------------------------------- */
`;
}
