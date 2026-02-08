import { createPublicClient, http } from "viem";
import { ARC_TESTNET } from "../src/lib/arc-registry.js";

const ARC_RPC_URL = process.env.ARC_RPC_URL || ARC_TESTNET.rpcUrl;
const ARC_HOOK_ADDRESS = process.env.ARC_HOOK_ADDRESS;
const LIFI_API_KEY = process.env.LIFI_API_KEY || "";

const FROM_CHAIN_ID = process.env.FROM_CHAIN_ID || "8453";
const TO_CHAIN_ID = process.env.TO_CHAIN_ID || "11155111";
const FROM_TOKEN = process.env.FROM_TOKEN || "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const TO_TOKEN =
  process.env.TO_TOKEN || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const TO_ADDRESS = process.env.TO_ADDRESS || "";
const FROM_ADDRESS = process.env.FROM_ADDRESS || "";
const AMOUNT = process.env.AMOUNT || "1000000"; // 1 USDC (6 decimals)
const SLIPPAGE = process.env.SLIPPAGE || "0.3";

if (!ARC_HOOK_ADDRESS) {
  console.error("Missing ARC_HOOK_ADDRESS env var.");
  process.exit(1);
}
if (!TO_ADDRESS) {
  console.error("Missing TO_ADDRESS env var.");
  process.exit(1);
}

const ARC_HOOK_ABI = [
  {
    type: "event",
    name: "ArcSettlementRequested",
    inputs: [
      { indexed: true, name: "poolId", type: "bytes32" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "liquidityDelta", type: "int256" },
    ],
    anonymous: false,
  },
];

const client = createPublicClient({
  transport: http(ARC_RPC_URL),
});

async function fetchLifiQuote() {
  const params = new URLSearchParams({
    fromChain: FROM_CHAIN_ID,
    toChain: TO_CHAIN_ID,
    fromToken: FROM_TOKEN,
    toToken: TO_TOKEN,
    fromAmount: AMOUNT,
    fromAddress: FROM_ADDRESS || TO_ADDRESS,
    toAddress: TO_ADDRESS,
    slippage: SLIPPAGE,
  });

  const url = `https://li.quest/v1/quote?${params.toString()}`;
  const headers = LIFI_API_KEY ? { "x-lifi-api-key": LIFI_API_KEY } : {};

  console.log("[LI.FI] Quote request", {
    url,
    headers: LIFI_API_KEY ? "x-lifi-api-key set" : "no api key",
  });

  const response = await fetch(url, { headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  console.log("[LI.FI] Quote response", {
    tool: data.tool,
    fromChain: data.action?.fromChainId,
    toChain: data.action?.toChainId,
    fromAmount: data.action?.fromAmount,
    toAmount: data.estimate?.toAmount,
    approvalAddress: data.estimate?.approvalAddress,
  });

  return data;
}

console.log("[Arc Agent] Listening for ArcSettlementRequested");
console.log("[Arc Agent] Config", {
  arcRpc: ARC_RPC_URL,
  arcHook: ARC_HOOK_ADDRESS,
  fromChain: FROM_CHAIN_ID,
  toChain: TO_CHAIN_ID,
  fromToken: FROM_TOKEN,
  toToken: TO_TOKEN,
  toAddress: TO_ADDRESS,
  amount: AMOUNT,
});

client.watchContractEvent({
  address: ARC_HOOK_ADDRESS,
  abi: ARC_HOOK_ABI,
  eventName: "ArcSettlementRequested",
  onLogs: async (logs) => {
    for (const log of logs) {
      console.log("[Arc Agent] Settlement requested", {
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        poolId: log.args?.poolId,
        provider: log.args?.provider,
        liquidityDelta: log.args?.liquidityDelta?.toString(),
      });

      try {
        await fetchLifiQuote();
      } catch (error) {
        console.error("[Arc Agent] Quote failed", error);
      }
    }
  },
});
