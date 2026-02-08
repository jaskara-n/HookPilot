HookWizard
==========

HookWizard is a Uniswap v4 hook builder and deployment cockpit for HackMoney 2026. It generates audited hooks, deploys pools, and connects off-chain agents to enforce policy and orchestrate liquidity across chains.

What it does
------------
- Build and deploy Uniswap v4 hooks with toggles:
  - Fee threshold hook
  - On-chain limit order hook
  - Arc USDC-only settlement hook (policy + events)
- Deploy ERC-20 tokens for quick test pools.
- Initialize pools and add liquidity on Sepolia.
- Cross-chain USDC refill using LI.FI API (off-chain).
- Agent-ready: hook events can be consumed by any off-chain agent (Eliza, custom bots, workflows).

Architecture overview
---------------------
1. Hook Wizard UI
   - Generates hook code based on toggles
   - Deploys hook + initializes pool
   - Shows metrics from the pool and hook contracts
2. Arc USDC-only hook (policy)
   - Enforces USDC-only pools
   - Emits Arc settlement requests
3. Off-chain agent (example script)
   - Listens to Arc settlement events
   - Fetches LI.FI quote for cross-chain USDC refill
   - Can trigger bridge + swap flows

Why Arc + LI.FI
--------------
- Arc provides a USDC-first settlement layer and a clear policy boundary for liquidity.
- LI.FI provides the cross-chain execution layer to refill USDC from any chain.

This satisfies the Arc and LI.FI hackathon tracks without putting cross-chain complexity on-chain.

Sponsors & stack
----------------
- Uniswap v4 hooks + PoolManager
- Arc testnet (USDC settlement policy)
- LI.FI API (cross-chain USDC refill)
- Wagmi + RainbowKit + Viem
- Foundry (contracts)

Setup
-----
Install:
```
npm install
```

Contracts:
```
cd contracts
forge build
```

Run UI:
```
npm run dev
```

Token deploy (optional)
-----------------------
The Pool Config step includes a simple ERC-20 deployer. The contract mints the full supply to the deployer wallet. This is intended for testing only; use your own production token contracts for real deployments.

Sepolia Uniswap v4 registry
---------------------------
These addresses are wired into the registry:
- PoolManager: 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543
- Universal Router: 0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b
- PositionManager: 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4
- StateView: 0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c
- Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3

Arc testnet registry
--------------------
Arc testnet chain id: 5042002

USDC (native): 0x3600000000000000000000000000000000000000  
Gateway Wallet: 0x0077777d7EBA4688BDeF3E311b846F25870A19B9  
Gateway Minter: 0x0022222ABE238Cc2C7Bb1f21003F0a260052475B  
CCTP TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA  
CCTP MessageTransmitterV2: 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275

Off-chain agent demo (Arc + LI.FI)
----------------------------------
This repo includes a small agent script that listens for Arc settlement events and requests a LI.FI quote.

Run:
```
ARC_RPC_URL=https://rpc.testnet.arc.network \
ARC_HOOK_ADDRESS=0xYourArcHook \
TO_ADDRESS=0xYourTreasury \
FROM_CHAIN_ID=8453 \
FROM_TOKEN=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 \
TO_CHAIN_ID=11155111 \
TO_TOKEN=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
AMOUNT=1000000 \
node scripts/arc-lifi-agent.mjs
```

Notes:
- LI.FI does not support testnets, so the script is used to demonstrate the cross-chain intent and payload.
- Plug the same payload into LI.FI on mainnet for real bridging.

Hooks
-----
- Fee Threshold Hook: accumulates fees and only transfers above a threshold.
- Limit Order Hook: on-chain limit order execution with price step traversal.
- Arc USDC-only Hook: enforces USDC-only pools and emits settlement requests.

Agent integrations
------------------
Any external agent can subscribe to hook events and respond:
- Eliza agent: monitor ArcSettlementRequested and trigger LI.FI or internal treasury moves.
- Custom automation: rebalancing, alerting, cross-chain funding.

Demo checklist (HackMoney)
--------------------------
- UI: build hook + deploy + initialize pool on Sepolia
- Arc: show USDC-only policy + settlement events
- LI.FI: show cross-chain quote and execution payload
- Repo: public with scripts and README

Prize track alignment
---------------------
- Uniswap Foundation: v4 hooks + pool deployments with on-chain policy enforcement.
- Arc: USDC-only liquidity policy + Arc settlement events + documented Arc registry usage.
- LI.FI: cross-chain USDC refill flow (quote + execution payload).

License
-------
MIT
