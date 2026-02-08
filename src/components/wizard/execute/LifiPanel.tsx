import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RefreshCw, AlertTriangle } from "lucide-react";
import { useLifi } from "@/hooks/useLifi";

interface LifiPanelProps {
  defaultToAddress?: string;
  onTx?: (hash: string, explorerBase?: string) => void;
  isTestnet: boolean;
}

export function LifiPanel({ defaultToAddress, onTx, isTestnet }: LifiPanelProps) {
  const {
    fromChainId,
    setFromChainId,
    toChainId,
    setToChainId,
    fromToken,
    setFromToken,
    toToken,
    setToToken,
    amount,
    setAmount,
    toAddress,
    setToAddress,
    quote,
    status,
    error,
    fetchQuote,
    executeQuote,
  } = useLifi(defaultToAddress);

  const [executionStatus, setExecutionStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [executionError, setExecutionError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultToAddress) {
      setToAddress(defaultToAddress);
    }
  }, [defaultToAddress, setToAddress]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">LI.FI Cross-Chain USDC Refill</p>
          <p className="text-xs text-muted-foreground">
            Bridge/swap USDC from another chain into your pool treasury or a custom address.
          </p>
        </div>
        <Badge variant="secondary">API</Badge>
      </div>

      {isTestnet && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div>
            LI.FI does not support testnets. Switch to a mainnet chain to execute a real route.
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs">From Chain ID</Label>
          <Input
            value={fromChainId}
            onChange={(e) => setFromChainId(e.target.value)}
            className="font-mono text-xs"
            placeholder="1"
          />
        </div>
        <div>
          <Label className="text-xs">To Chain ID</Label>
          <Input
            value={toChainId}
            onChange={(e) => setToChainId(e.target.value)}
            className="font-mono text-xs"
            placeholder="10"
          />
        </div>
        <div>
          <Label className="text-xs">From Token (address)</Label>
          <Input
            value={fromToken}
            onChange={(e) => setFromToken(e.target.value)}
            className="font-mono text-xs"
            placeholder="USDC address on source chain"
          />
        </div>
        <div>
          <Label className="text-xs">To Token (address)</Label>
          <Input
            value={toToken}
            onChange={(e) => setToToken(e.target.value)}
            className="font-mono text-xs"
            placeholder="USDC address on destination chain"
          />
        </div>
        <div>
          <Label className="text-xs">Amount (raw units)</Label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono text-xs"
            placeholder="1000000 for 1 USDC"
          />
        </div>
        <div>
          <Label className="text-xs">Settlement Receiver (Treasury)</Label>
          <Input
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="font-mono text-xs"
            placeholder="Treasury or pool wallet"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Defaults to your pool treasury. Use a custom address if you want a separate receiver.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => fetchQuote()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Get Quote
        </Button>
        <Button
          onClick={async () => {
            setExecutionStatus("pending");
            setExecutionError(null);
            try {
              const hash = await executeQuote();
              onTx?.(hash, Number(fromChainId) === 1 ? "https://etherscan.io" : undefined);
              setExecutionStatus("success");
            } catch (err) {
              const message = err instanceof Error ? err.message : "Execution failed";
              setExecutionError(message);
              setExecutionStatus("error");
            }
          }}
          disabled={!quote?.transactionRequest}
          className="bg-gradient-to-r from-secondary to-accent"
        >
          Execute Quote
        </Button>
      </div>

      {status === "pending" && (
        <p className="text-xs text-muted-foreground">Fetching quote...</p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {quote?.estimate && (
        <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
          <p className="text-muted-foreground">Estimated Output</p>
          <p className="font-mono">
            toAmount: {quote.estimate.toAmount ?? "-"} (min {quote.estimate.toAmountMin ?? "-"})
          </p>
        </div>
      )}

      {executionStatus === "success" && (
        <p className="text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> LI.FI route executed
        </p>
      )}
      {executionStatus === "error" && (
        <p className="text-xs text-destructive">{executionError}</p>
      )}
    </div>
  );
}
