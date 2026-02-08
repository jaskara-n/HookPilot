import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  concatHex,
  encodeAbiParameters,
  keccak256,
  parseUnits,
  formatUnits,
  type Address,
  type Hex,
} from "viem";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { generateHookCode } from "@/lib/hook-code-generator";
import type { HookFlags, AuditedHook } from "@/lib/hook-registry";
import type { PoolConfig } from "@/components/wizard/PoolSelectStep";
import {
  getV4Addresses,
  getPermit2,
  isV4Supported,
} from "@/lib/uniswap-v4-registry";
import {
  buildPoolKey,
  computePoolId,
  ZERO_ADDRESS,
} from "@/lib/uniswap-v4-utils";
import {
  ERC20_ABI,
  HOOK_FACTORY_ABI,
  HOOK_METRICS_ABI,
  PERMIT2_ABI,
  POOL_MANAGER_ABI,
  POSITION_MANAGER_ABI,
  SIMPLE_SWAP_ROUTER_ABI,
  STATE_VIEW_ABI,
} from "@/lib/uniswap-v4-abi";
import {
  FEE_THRESHOLD_HOOK,
  HOOK_FACTORY,
  LIMIT_ORDER_HOOK,
  LIMIT_ORDER_ONLY_HOOK,
  SIMPLE_SWAP_ROUTER,
} from "@/lib/hook-artifacts";
import {
  encodeSqrtPriceX96,
  getLiquidityForAmounts,
  getSqrtRatioAtTick,
  maxUsableTick,
  minUsableTick,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "@/lib/v4-math";
import { mineHookSalt } from "@/lib/hook-miner";

import {
  CheckCircle2,
  FileCode,
  Info,
  Loader2,
  RefreshCw,
  Rocket,
  Send,
  Settings2,
  Wallet,
} from "lucide-react";

interface ExecuteStepProps {
  poolConfig: PoolConfig;
  flags: HookFlags;
  agentPrompt: string;
  deployChoice: "existing" | "custom" | null;
  auditedHook: AuditedHook | null;
  deployedAddress: string | null;
  onDeployedAddressChange: (address: string | null) => void;
}

const ACTION_MINT_POSITION = 0x02;
const ACTION_SETTLE_PAIR = 0x0d;

export function ExecuteStep({
  poolConfig,
  flags,
  agentPrompt,
  deployChoice,
  auditedHook,
  deployedAddress,
  onDeployedAddressChange,
}: ExecuteStepProps) {
  const [code, setCode] = useState("");
  const { address: walletAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: poolConfig.chainId });
  const { data: walletClient } = useWalletClient({
    chainId: poolConfig.chainId,
  });

  const registry = getV4Addresses(poolConfig.chainId);

  const [addressOverrides, setAddressOverrides] = useState({
    poolManager: "",
    positionManager: "",
    stateView: "",
    permit2: "",
  });

  const [hookFactoryAddress, setHookFactoryAddress] = useState("");
  const [isMining, setIsMining] = useState(false);
  const [minedSalt, setMinedSalt] = useState<Hex | null>(null);
  const [predictedHook, setPredictedHook] = useState<Address | null>(null);
  const [hookDeploying, setHookDeploying] = useState(false);

  const [poolInitStatus, setPoolInitStatus] = useState<string | null>(null);
  const [initialPrice, setInitialPrice] = useState("1.0");

  const [amount0Input, setAmount0Input] = useState("");
  const [amount1Input, setAmount1Input] = useState("");
  const [slippageBps, setSlippageBps] = useState("50");
  const [liquidityStatus, setLiquidityStatus] = useState<string | null>(null);

  const [token0Decimals, setToken0Decimals] = useState(18);
  const [token1Decimals, setToken1Decimals] = useState(18);

  const [swapRouterAddress, setSwapRouterAddress] = useState("");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapZeroForOne, setSwapZeroForOne] = useState(true);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [swapApprovalStatus, setSwapApprovalStatus] = useState<string | null>(
    null,
  );

  const [metrics, setMetrics] = useState<{
    sqrtPriceX96?: bigint;
    tick?: number;
    liquidity?: bigint;
    feesCollected?: bigint;
    feesDistributed?: bigint;
    feesAccrued?: bigint;
    executedOrders?: bigint;
  }>({});

  const [lookup, setLookup] = useState({
    tokenA: "",
    tokenB: "",
    fee: "3000",
    tickSpacing: "60",
    hook: "",
    poolId: "",
  });
  const [lookupResult, setLookupResult] = useState<{
    sqrtPriceX96?: bigint;
    tick?: number;
    liquidity?: bigint;
  } | null>(null);

  useEffect(() => {
    setCode(generateHookCode(flags, agentPrompt));
  }, [flags, agentPrompt]);

  useEffect(() => {
    setAddressOverrides({
      poolManager: registry?.poolManager ?? "",
      positionManager: registry?.positionManager ?? "",
      stateView: registry?.stateView ?? "",
      permit2: registry?.permit2 ?? getPermit2(poolConfig.chainId),
    });
  }, [poolConfig.chainId, registry]);

  useEffect(() => {
    if (!swapRouterAddress && registry?.universalRouter) {
      setSwapRouterAddress(registry.universalRouter);
    }
  }, [registry, swapRouterAddress]);

  useEffect(() => {
    if (walletAddress && !poolConfig.treasuryAddress) {
      // Autopopulate treasury if empty
      // Note: only for local UI state; user can override in step 1
    }
  }, [walletAddress, poolConfig.treasuryAddress]);

  type ReadContractParams =
    Parameters<NonNullable<typeof publicClient>["readContract"]>[0];
  const readContract = async <T,>(params: ReadContractParams) => {
    if (!publicClient) throw new Error("Public client not ready");
    console.groupCollapsed("[HookWizard] readContract");
    console.log(params);
    console.groupEnd();
    return (await publicClient.readContract({
      authorizationList: [],
      ...params,
    } as ReadContractParams & { authorizationList: readonly unknown[] })) as T;
  };

  const logTx = (label: string, payload: Record<string, unknown>) => {
    console.groupCollapsed(`[HookWizard] ${label}`);
    console.log(payload);
    console.groupEnd();
  };

  const poolManagerAddress = (addressOverrides.poolManager || "") as Address;
  const positionManagerAddress = (addressOverrides.positionManager ||
    "") as Address;
  const stateViewAddress = (addressOverrides.stateView || "") as Address;
  const permit2Address = (addressOverrides.permit2 ||
    getPermit2(poolConfig.chainId)) as Address;

  const selectedHookArtifact = useMemo(() => {
    if (flags.feeThreshold && flags.limitOrders) return LIMIT_ORDER_HOOK;
    if (flags.feeThreshold) return FEE_THRESHOLD_HOOK;
    if (flags.limitOrders) return LIMIT_ORDER_ONLY_HOOK;
    return null;
  }, [flags]);

  const hookAddress = useMemo(() => {
    if (deployChoice === "existing" && auditedHook)
      return auditedHook.address as Address;
    if (deployChoice === "custom") {
      return (deployedAddress || predictedHook || ZERO_ADDRESS) as Address;
    }
    return ZERO_ADDRESS;
  }, [deployChoice, auditedHook, deployedAddress, predictedHook]);

  const poolKey = useMemo(() => {
    if (!poolConfig.tokenAAddress || !poolConfig.tokenBAddress) return null;
    return buildPoolKey({
      tokenA: poolConfig.tokenAAddress as Address,
      tokenB: poolConfig.tokenBAddress as Address,
      fee: poolConfig.feeTier,
      tickSpacing: poolConfig.tickSpacing,
      hooks: hookAddress,
    });
  }, [poolConfig, hookAddress]);

  const poolId = useMemo(
    () => (poolKey ? computePoolId(poolKey) : null),
    [poolKey],
  );

  useEffect(() => {
    async function loadDecimals() {
      if (!publicClient || !poolKey) return;
      try {
        if (poolKey.currency0 === ZERO_ADDRESS) {
          setToken0Decimals(18);
        } else {
          const decimals = await readContract<bigint>({
            address: poolKey.currency0,
            abi: ERC20_ABI,
            functionName: "decimals",
          });
          setToken0Decimals(Number(decimals));
        }
      } catch {
        setToken0Decimals(18);
      }
      try {
        if (poolKey.currency1 === ZERO_ADDRESS) {
          setToken1Decimals(18);
        } else {
          const decimals = await readContract<bigint>({
            address: poolKey.currency1,
            abi: ERC20_ABI,
            functionName: "decimals",
          });
          setToken1Decimals(Number(decimals));
        }
      } catch {
        setToken1Decimals(18);
      }
    }

    loadDecimals();
  }, [publicClient, poolKey]);

  const initCodeHash = useMemo(() => {
    if (
      !selectedHookArtifact ||
      !poolManagerAddress ||
      !poolConfig.stablecoinAddress
    )
      return null;
    const constructorArgs =
      selectedHookArtifact === LIMIT_ORDER_ONLY_HOOK
        ? [poolManagerAddress, poolConfig.stablecoinAddress]
        : [
            poolManagerAddress,
            poolConfig.treasuryAddress,
            poolConfig.stablecoinAddress,
          ];
    const encodedArgs = encodeAbiParameters(
      selectedHookArtifact === LIMIT_ORDER_ONLY_HOOK
        ? [
            { name: "poolManager", type: "address" },
            { name: "stablecoin", type: "address" },
          ]
        : [
            { name: "poolManager", type: "address" },
            { name: "treasury", type: "address" },
            { name: "stablecoin", type: "address" },
          ],
      constructorArgs as readonly Address[],
    );
    const initCode = concatHex([selectedHookArtifact.bytecode, encodedArgs]);
    return keccak256(initCode);
  }, [
    selectedHookArtifact,
    poolManagerAddress,
    poolConfig.stablecoinAddress,
    poolConfig.treasuryAddress,
  ]);

  const initCode = useMemo(() => {
    if (
      !selectedHookArtifact ||
      !poolManagerAddress ||
      !poolConfig.stablecoinAddress
    )
      return null;
    const constructorArgs =
      selectedHookArtifact === LIMIT_ORDER_ONLY_HOOK
        ? [poolManagerAddress, poolConfig.stablecoinAddress]
        : [
            poolManagerAddress,
            poolConfig.treasuryAddress,
            poolConfig.stablecoinAddress,
          ];
    const encodedArgs = encodeAbiParameters(
      selectedHookArtifact === LIMIT_ORDER_ONLY_HOOK
        ? [
            { name: "poolManager", type: "address" },
            { name: "stablecoin", type: "address" },
          ]
        : [
            { name: "poolManager", type: "address" },
            { name: "treasury", type: "address" },
            { name: "stablecoin", type: "address" },
          ],
      constructorArgs as readonly Address[],
    );
    return concatHex([selectedHookArtifact.bytecode, encodedArgs]);
  }, [
    selectedHookArtifact,
    poolManagerAddress,
    poolConfig.stablecoinAddress,
    poolConfig.treasuryAddress,
  ]);

  const canDeployHook = Boolean(
    selectedHookArtifact &&
    hookFactoryAddress &&
    minedSalt &&
    initCode &&
    walletClient,
  );

  const handleDeployHookFactory = async () => {
    if (!walletClient || !publicClient) return;
    try {
      logTx("deployHookFactory", { abi: "HOOK_FACTORY", bytecode: "[bytecode]" });
      const txHash = await walletClient.deployContract({
        abi: HOOK_FACTORY.abi,
        bytecode: HOOK_FACTORY.bytecode,
        args: [],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      if (receipt.contractAddress) {
        setHookFactoryAddress(receipt.contractAddress);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleMineSalt = async () => {
    if (!hookFactoryAddress || !initCodeHash) return;
    setIsMining(true);
    setMinedSalt(null);
    setPredictedHook(null);

    logTx("mineHookSalt", {
      deployer: hookFactoryAddress,
      initCodeHash,
    });
    const result = await mineHookSalt({
      deployer: hookFactoryAddress as Address,
      initCodeHash,
      onProgress: () => {},
    });

    if (result) {
      setMinedSalt(result.salt);
      setPredictedHook(result.address);
    }
    setIsMining(false);
  };

  const handleDeployHook = async () => {
    if (!walletClient || !publicClient || !initCode || !minedSalt) return;
    setHookDeploying(true);
    try {
      logTx("deployHook", {
        factory: hookFactoryAddress,
        salt: minedSalt,
        initCodeHash,
      });
      const txHash = await walletClient.writeContract({
        address: hookFactoryAddress as Address,
        abi: HOOK_FACTORY_ABI,
        functionName: "deploy",
        args: [minedSalt, initCode],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (predictedHook) {
        onDeployedAddressChange(predictedHook);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setHookDeploying(false);
    }
  };

  const sqrtPriceX96 = useMemo(() => {
    const parsed = Number(initialPrice);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    const numerator = BigInt(Math.floor(parsed * 1e12));
    const denominator = 1_000_000_000_000n;
    return encodeSqrtPriceX96(numerator, denominator);
  }, [initialPrice]);

  const handleInitializePool = async () => {
    if (!walletClient || !publicClient || !poolKey || !sqrtPriceX96) return;
    if (!positionManagerAddress && !poolManagerAddress) return;
    setPoolInitStatus("pending");
    try {
      const args = [poolKey, sqrtPriceX96] as const;
      if (positionManagerAddress) {
        logTx("initializePool (posm)", {
          address: positionManagerAddress,
          args,
        });
        const txHash = await walletClient.writeContract({
          address: positionManagerAddress,
          abi: POSITION_MANAGER_ABI,
          functionName: "initializePool",
          args,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        logTx("initializePool (manager)", {
          address: poolManagerAddress,
          args,
        });
        const txHash = await walletClient.writeContract({
          address: poolManagerAddress,
          abi: POOL_MANAGER_ABI,
          functionName: "initialize",
          args,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      setPoolInitStatus("success");
    } catch (error) {
      console.error(error);
      setPoolInitStatus("error");
    }
  };

  const handleApproveToken = async (token: Address, spender: Address) => {
    if (!walletClient || !publicClient) return;
    if (token === ZERO_ADDRESS) return;
    try {
      logTx("approvePermit2", {
        token,
        spender: permit2Address,
      });
      const approveHash = await walletClient.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          permit2Address,
          BigInt(
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          ),
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      logTx("permit2Approve", {
        permit2: permit2Address,
        token,
        spender,
      });
      const permitHash = await walletClient.writeContract({
        address: permit2Address,
        abi: PERMIT2_ABI,
        functionName: "approve",
        args: [
          token,
          spender,
          BigInt("0xffffffffffffffffffff"),
          BigInt("0xffffffffffff"),
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: permitHash });
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddLiquidity = async () => {
    if (!walletClient || !publicClient || !poolKey || !poolId) return;
    if (!positionManagerAddress) return;
    if (!stateViewAddress) {
      setLiquidityStatus("error");
      return;
    }

    try {
      setLiquidityStatus("pending");
      const amount0 = parseUnits(amount0Input || "0", token0Decimals);
      const amount1 = parseUnits(amount1Input || "0", token1Decimals);
      const tickLower = minUsableTick(poolConfig.tickSpacing);
      const tickUpper = maxUsableTick(poolConfig.tickSpacing);

      const slot0 = await readContract<readonly [bigint, number, number, number]>({
        address: stateViewAddress,
        abi: STATE_VIEW_ABI,
        functionName: "getSlot0",
        args: [poolId],
      });
      const sqrtPriceX96 = slot0[0] as bigint;

      const sqrtPriceLower = getSqrtRatioAtTick(tickLower);
      const sqrtPriceUpper = getSqrtRatioAtTick(tickUpper);

      const liquidity = getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtPriceLower,
        sqrtPriceUpper,
        amount0,
        amount1,
      );

      const slippage = BigInt(slippageBps);
      const amount0Max = (amount0 * (10_000n + slippage)) / 10_000n;
      const amount1Max = (amount1 * (10_000n + slippage)) / 10_000n;

      const actionBytes = concatHex([
        `0x${ACTION_MINT_POSITION.toString(16).padStart(2, "0")}`,
        `0x${ACTION_SETTLE_PAIR.toString(16).padStart(2, "0")}`,
      ]);

      const params: Hex[] = [
        encodeAbiParameters(
          [
            {
              name: "key",
              type: "tuple",
              components: [
                { name: "currency0", type: "address" },
                { name: "currency1", type: "address" },
                { name: "fee", type: "uint24" },
                { name: "tickSpacing", type: "int24" },
                { name: "hooks", type: "address" },
              ],
            },
            { name: "tickLower", type: "int24" },
            { name: "tickUpper", type: "int24" },
            { name: "liquidity", type: "uint256" },
            { name: "amount0Max", type: "uint128" },
            { name: "amount1Max", type: "uint128" },
            { name: "recipient", type: "address" },
            { name: "hookData", type: "bytes" },
          ],
          [
            poolKey,
            tickLower,
            tickUpper,
            liquidity,
            amount0Max,
            amount1Max,
            walletAddress!,
            "0x",
          ],
        ),
        encodeAbiParameters(
          [
            { name: "currency0", type: "address" },
            { name: "currency1", type: "address" },
          ],
          [poolKey.currency0, poolKey.currency1],
        ),
      ];

      const unlockData = encodeAbiParameters(
        [
          { name: "actions", type: "bytes" },
          { name: "params", type: "bytes[]" },
        ],
        [actionBytes, params],
      );

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 900);
      const value = poolKey.currency0 === ZERO_ADDRESS ? amount0Max : 0n;

      logTx("modifyLiquidities", {
        positionManagerAddress,
        amount0: amount0.toString(),
        amount1: amount1.toString(),
        liquidity: liquidity.toString(),
        tickLower,
        tickUpper,
        amount0Max: amount0Max.toString(),
        amount1Max: amount1Max.toString(),
        deadline: deadline.toString(),
        value: value.toString(),
      });
      const txHash = await walletClient.writeContract({
        address: positionManagerAddress,
        abi: POSITION_MANAGER_ABI,
        functionName: "modifyLiquidities",
        args: [unlockData, deadline],
        value,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setLiquidityStatus("success");
    } catch (error) {
      console.error(error);
      setLiquidityStatus("error");
    }
  };

  const handleDeploySwapRouter = async () => {
    if (!walletClient || !publicClient || !poolManagerAddress) return;
    try {
      logTx("deploySwapRouter", { poolManagerAddress });
      const txHash = await walletClient.deployContract({
        abi: SIMPLE_SWAP_ROUTER.abi,
        bytecode: SIMPLE_SWAP_ROUTER.bytecode,
        args: [poolManagerAddress],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      if (receipt.contractAddress) {
        setSwapRouterAddress(receipt.contractAddress);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleApproveSwapToken = async (token: Address) => {
    if (!walletClient || !publicClient || !swapRouterAddress) return;
    if (token === ZERO_ADDRESS) return;
    try {
      setSwapApprovalStatus("pending");
      logTx("approveSwapToken", {
        token,
        spender: swapRouterAddress,
      });
      const approveHash = await walletClient.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          swapRouterAddress as Address,
          BigInt(
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          ),
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      setSwapApprovalStatus("success");
    } catch (error) {
      console.error(error);
      setSwapApprovalStatus("error");
    }
  };

  const handleSwap = async () => {
    if (!walletClient || !publicClient || !poolKey || !swapRouterAddress)
      return;
    try {
      setSwapStatus("pending");
      const decimals = swapZeroForOne ? token0Decimals : token1Decimals;
      const amountIn = parseUnits(swapAmount || "0", decimals);
      const sqrtPriceLimit = swapZeroForOne
        ? MIN_SQRT_RATIO + 1n
        : MAX_SQRT_RATIO - 1n;

      const value =
        swapZeroForOne && poolKey.currency0 === ZERO_ADDRESS
          ? amountIn
          : !swapZeroForOne && poolKey.currency1 === ZERO_ADDRESS
            ? amountIn
            : 0n;

      logTx("swapExactIn", {
        swapRouterAddress,
        poolKey,
        swapZeroForOne,
        amountIn: amountIn.toString(),
        sqrtPriceLimit: sqrtPriceLimit.toString(),
        value: value.toString(),
      });
      const txHash = await walletClient.writeContract({
        address: swapRouterAddress as Address,
        abi: SIMPLE_SWAP_ROUTER_ABI,
        functionName: "swapExactIn",
        args: [poolKey, swapZeroForOne, amountIn, sqrtPriceLimit, "0x"],
        value,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setSwapStatus("success");
    } catch (error) {
      console.error(error);
      setSwapStatus("error");
    }
  };

  const refreshMetrics = async () => {
    if (!publicClient || !poolId) return;
    let slot0: readonly [bigint, number, number, number] | undefined;
    let liquidity: bigint | undefined;
    let feesCollected: bigint | undefined;
    let feesDistributed: bigint | undefined;
    let feesAccrued: bigint | undefined;
    let executedOrders: bigint | undefined;

    logTx("refreshMetrics", { poolId, hookAddress });
    try {
      slot0 = await readContract<readonly [bigint, number, number, number]>({
        address: stateViewAddress,
        abi: STATE_VIEW_ABI,
        functionName: "getSlot0",
        args: [poolId],
      });
    } catch (error) {
      console.error(error);
    }

    try {
      liquidity = await readContract<bigint>({
        address: stateViewAddress,
        abi: STATE_VIEW_ABI,
        functionName: "getLiquidity",
        args: [poolId],
      });
    } catch (error) {
      console.error(error);
    }

    if (hookAddress !== ZERO_ADDRESS) {
      if (flags.feeThreshold) {
        try {
          feesCollected = await readContract<bigint>({
            address: hookAddress,
            abi: HOOK_METRICS_ABI,
            functionName: "totalFeesCollected",
            args: [poolId],
          });
        } catch (error) {
          console.error(error);
        }

        try {
          feesDistributed = await readContract<bigint>({
            address: hookAddress,
            abi: HOOK_METRICS_ABI,
            functionName: "totalFeesDistributed",
            args: [poolId],
          });
        } catch (error) {
          console.error(error);
        }

        try {
          feesAccrued = await readContract<bigint>({
            address: hookAddress,
            abi: HOOK_METRICS_ABI,
            functionName: "accumulatedFees",
            args: [poolId],
          });
        } catch (error) {
          console.error(error);
        }
      }

      if (flags.limitOrders) {
        try {
          executedOrders = await readContract<bigint>({
            address: hookAddress,
            abi: HOOK_METRICS_ABI,
            functionName: "executedOrdersCount",
            args: [poolId],
          });
        } catch (error) {
          console.error(error);
        }
      }
    }

    setMetrics({
      sqrtPriceX96: slot0?.[0],
      tick: slot0 ? Number(slot0[1]) : undefined,
      liquidity,
      feesCollected,
      feesDistributed,
      feesAccrued,
      executedOrders,
    });
  };

  const handleLookup = async () => {
    if (!publicClient || !stateViewAddress) return;
    try {
      const key = buildPoolKey({
        tokenA: lookup.tokenA as Address,
        tokenB: lookup.tokenB as Address,
        fee: Number(lookup.fee),
        tickSpacing: Number(lookup.tickSpacing),
        hooks: lookup.hook as Address,
      });
      const id = computePoolId(key);
      logTx("lookupPool", { key, id });
      setLookup((prev) => ({ ...prev, poolId: id }));
      const slot0 = await readContract<readonly [bigint, number, number, number]>({
        address: stateViewAddress,
        abi: STATE_VIEW_ABI,
        functionName: "getSlot0",
        args: [id],
      });
      const liquidity = await readContract<bigint>({
        address: stateViewAddress,
        abi: STATE_VIEW_ABI,
        functionName: "getLiquidity",
        args: [id],
      });
      setLookupResult({
        sqrtPriceX96: slot0[0] as bigint,
        tick: Number(slot0[1]),
        liquidity: liquidity as bigint,
      });
    } catch (error) {
      console.error(error);
      setLookupResult(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6">
      <Card className="border-primary/30 cyber-glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Send className="w-5 h-5" />
            Deploy & Manage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="deploy" className="w-full">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="deploy">Deploy</TabsTrigger>
              <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
              <TabsTrigger value="swap">Swap</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="deploy" className="space-y-6 pt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Registry Addresses</p>
                  {isV4Supported(poolConfig.chainId) ? (
                    <Badge variant="secondary">v4 ready</Badge>
                  ) : (
                    <Badge variant="outline">custom</Badge>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">PoolManager</Label>
                    <Input
                      value={addressOverrides.poolManager}
                      onChange={(e) =>
                        setAddressOverrides((prev) => ({
                          ...prev,
                          poolManager: e.target.value,
                        }))
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">PositionManager</Label>
                    <Input
                      value={addressOverrides.positionManager}
                      onChange={(e) =>
                        setAddressOverrides((prev) => ({
                          ...prev,
                          positionManager: e.target.value,
                        }))
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">StateView</Label>
                    <Input
                      value={addressOverrides.stateView}
                      onChange={(e) =>
                        setAddressOverrides((prev) => ({
                          ...prev,
                          stateView: e.target.value,
                        }))
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Permit2</Label>
                    <Input
                      value={addressOverrides.permit2}
                      onChange={(e) =>
                        setAddressOverrides((prev) => ({
                          ...prev,
                          permit2: e.target.value,
                        }))
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                {registry?.notes && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    {registry.notes}
                  </p>
                )}
              </div>

              {deployChoice === "custom" && selectedHookArtifact && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-secondary" />
                    <p className="text-sm font-semibold">Hook Deployment</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Hook Factory</Label>
                      <Input
                        value={hookFactoryAddress}
                        onChange={(e) => setHookFactoryAddress(e.target.value)}
                        placeholder="Deploy or paste factory"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleDeployHookFactory}
                        disabled={!walletClient}
                      >
                        Deploy Factory
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleMineSalt}
                      disabled={
                        !hookFactoryAddress || !initCodeHash || isMining
                      }
                      className="bg-gradient-to-r from-secondary to-accent"
                    >
                      {isMining ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Mining
                          Salt
                        </span>
                      ) : (
                        "Mine Hook Address"
                      )}
                    </Button>
                    {predictedHook && (
                      <div className="p-3 rounded-lg bg-muted/40 text-xs font-mono break-all">
                        Predicted Hook: {predictedHook}
                      </div>
                    )}
                    {minedSalt && (
                      <div className="p-3 rounded-lg bg-muted/40 text-xs font-mono break-all">
                        Salt: {minedSalt}
                      </div>
                    )}
                    <Button
                      onClick={handleDeployHook}
                      disabled={!canDeployHook || hookDeploying}
                      variant="outline"
                    >
                      {hookDeploying ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Deploying
                        </span>
                      ) : (
                        "Deploy Hook"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {deployChoice === "existing" && auditedHook && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <p className="text-sm font-semibold">
                      Audited Hook Selected
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 text-xs font-mono break-all">
                    {auditedHook.name}: {auditedHook.address}
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Initialize Pool</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">
                      Initial Price (token1 per token0)
                    </Label>
                    <Input
                      value={initialPrice}
                      onChange={(e) => setInitialPrice(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">SqrtPriceX96</Label>
                    <Input
                      value={sqrtPriceX96 ? sqrtPriceX96.toString() : ""}
                      readOnly
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 text-xs font-mono break-all">
                  Hook Address: {hookAddress}
                </div>
                <Button
                  onClick={handleInitializePool}
                  disabled={!walletClient || !sqrtPriceX96 || !poolKey}
                  className="bg-gradient-to-r from-primary to-secondary"
                >
                  Initialize Pool
                </Button>
                {poolInitStatus === "success" && (
                  <p className="text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Pool initialized
                  </p>
                )}
                {poolInitStatus === "error" && (
                  <p className="text-xs text-destructive">
                    Pool initialization failed.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="liquidity" className="space-y-6 pt-4">
              <div className="space-y-3">
                <p className="text-sm font-semibold">
                  Approve Tokens (Permit2)
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      poolKey &&
                      handleApproveToken(
                        poolKey.currency0,
                        positionManagerAddress,
                      )
                    }
                  >
                    Approve Token0
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      poolKey &&
                      handleApproveToken(
                        poolKey.currency1,
                        positionManagerAddress,
                      )
                    }
                  >
                    Approve Token1
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">
                  Add Full-Range Liquidity
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Amount Token0</Label>
                    <Input
                      value={amount0Input}
                      onChange={(e) => setAmount0Input(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Amount Token1</Label>
                    <Input
                      value={amount1Input}
                      onChange={(e) => setAmount1Input(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Slippage (bps)</Label>
                    <Input
                      value={slippageBps}
                      onChange={(e) => setSlippageBps(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddLiquidity}
                  disabled={
                    !walletClient || !poolKey || !amount0Input || !amount1Input
                  }
                  className="bg-gradient-to-r from-primary to-secondary"
                >
                  Add Liquidity
                </Button>
                {liquidityStatus === "success" && (
                  <p className="text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Liquidity added
                  </p>
                )}
                {liquidityStatus === "error" && (
                  <p className="text-xs text-destructive">
                    Liquidity addition failed.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="swap" className="space-y-6 pt-4">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Swap Router</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    value={swapRouterAddress}
                    onChange={(e) => setSwapRouterAddress(e.target.value)}
                    placeholder="Swap router address"
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" onClick={handleDeploySwapRouter}>
                    Deploy Simple Router
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Approve Tokens for Swap</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      poolKey && handleApproveSwapToken(poolKey.currency0)
                    }
                    disabled={!swapRouterAddress}
                  >
                    Approve Token0
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      poolKey && handleApproveSwapToken(poolKey.currency1)
                    }
                    disabled={!swapRouterAddress}
                  >
                    Approve Token1
                  </Button>
                </div>
                {swapApprovalStatus === "success" && (
                  <p className="text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Swap approvals set
                  </p>
                )}
                {swapApprovalStatus === "error" && (
                  <p className="text-xs text-destructive">
                    Swap approval failed.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Swap Exact In</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Amount In</Label>
                    <Input
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      variant={swapZeroForOne ? "default" : "outline"}
                      onClick={() => setSwapZeroForOne(true)}
                    >
                      0 → 1
                    </Button>
                    <Button
                      variant={!swapZeroForOne ? "default" : "outline"}
                      onClick={() => setSwapZeroForOne(false)}
                    >
                      1 → 0
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleSwap}
                  disabled={!walletClient || !swapRouterAddress || !swapAmount}
                  className="bg-gradient-to-r from-secondary to-accent"
                >
                  Execute Swap
                </Button>
                {swapStatus === "success" && (
                  <p className="text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Swap executed
                  </p>
                )}
                {swapStatus === "error" && (
                  <p className="text-xs text-destructive">Swap failed.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-6 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Pool & Hook Metrics</p>
                <Button variant="outline" size="sm" onClick={refreshMetrics}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-3 rounded-lg bg-muted/40 text-xs">
                  <p className="text-muted-foreground">Pool Id</p>
                  <p className="font-mono break-all">{poolId ?? "-"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 text-xs">
                  <p className="text-muted-foreground">Current Tick</p>
                  <p className="font-mono">{metrics.tick ?? "-"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 text-xs">
                  <p className="text-muted-foreground">Liquidity</p>
                  <p className="font-mono">
                    {metrics.liquidity?.toString() ?? "-"}
                  </p>
                </div>
                {flags.feeThreshold && (
                  <>
                    <div className="p-3 rounded-lg bg-muted/40 text-xs">
                      <p className="text-muted-foreground">Fees Collected</p>
                      <p className="font-mono">
                        {metrics.feesCollected?.toString() ?? "-"}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40 text-xs">
                      <p className="text-muted-foreground">Fees Distributed</p>
                      <p className="font-mono">
                        {metrics.feesDistributed?.toString() ?? "-"}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40 text-xs">
                      <p className="text-muted-foreground">Fees Pending</p>
                      <p className="font-mono">
                        {metrics.feesAccrued?.toString() ?? "-"}
                      </p>
                    </div>
                  </>
                )}
                {flags.limitOrders && (
                  <div className="p-3 rounded-lg bg-muted/40 text-xs">
                    <p className="text-muted-foreground">Orders Executed</p>
                    <p className="font-mono">
                      {metrics.executedOrders?.toString() ?? "-"}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Pool Lookup</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Token A"
                    value={lookup.tokenA}
                    onChange={(e) =>
                      setLookup((prev) => ({ ...prev, tokenA: e.target.value }))
                    }
                    className="font-mono text-xs"
                  />
                  <Input
                    placeholder="Token B"
                    value={lookup.tokenB}
                    onChange={(e) =>
                      setLookup((prev) => ({ ...prev, tokenB: e.target.value }))
                    }
                    className="font-mono text-xs"
                  />
                  <Input
                    placeholder="Fee"
                    value={lookup.fee}
                    onChange={(e) =>
                      setLookup((prev) => ({ ...prev, fee: e.target.value }))
                    }
                    className="font-mono text-xs"
                  />
                  <Input
                    placeholder="Tick Spacing"
                    value={lookup.tickSpacing}
                    onChange={(e) =>
                      setLookup((prev) => ({
                        ...prev,
                        tickSpacing: e.target.value,
                      }))
                    }
                    className="font-mono text-xs"
                  />
                  <Input
                    placeholder="Hook Address"
                    value={lookup.hook}
                    onChange={(e) =>
                      setLookup((prev) => ({ ...prev, hook: e.target.value }))
                    }
                    className="font-mono text-xs"
                  />
                </div>
                <Button variant="outline" onClick={handleLookup}>
                  Compute Pool Id
                </Button>
                {lookup.poolId && (
                  <div className="p-3 rounded-lg bg-muted/40 text-xs font-mono break-all">
                    {lookup.poolId}
                  </div>
                )}
                {lookupResult && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="p-3 rounded-lg bg-muted/40 text-xs">
                      <p className="text-muted-foreground">Tick</p>
                      <p className="font-mono">{lookupResult.tick ?? "-"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40 text-xs">
                      <p className="text-muted-foreground">Liquidity</p>
                      <p className="font-mono">
                        {lookupResult.liquidity?.toString() ?? "-"}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40 text-xs">
                      <p className="text-muted-foreground">SqrtPriceX96</p>
                      <p className="font-mono break-all">
                        {lookupResult.sqrtPriceX96?.toString() ?? "-"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="pt-4 border-t border-border">
            {isConnected ? (
              <Badge variant="secondary" className="text-xs">
                Connected as {walletAddress?.slice(0, 6)}...
                {walletAddress?.slice(-4)}
              </Badge>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <Button
                    onClick={openConnectModal}
                    disabled={!mounted}
                    className="w-full bg-gradient-to-r from-secondary to-accent"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet to Execute
                  </Button>
                )}
              </ConnectButton.Custom>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-secondary/30 cyber-glow-purple overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-secondary">
            <FileCode className="w-5 h-5" />
            Hook Solidity Code
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-[680px]">
          <Editor
            height="100%"
            language="sol"
            theme="vs-dark"
            value={code}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              padding: { top: 16, bottom: 16 },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
