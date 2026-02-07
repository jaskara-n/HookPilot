import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateHookCode } from "@/lib/hook-code-generator";
import type { HookFlags, AuditedHook } from "@/lib/mock-registry";
import { resolveTokenInput } from "@/lib/tokens";
import { FileCode, Send, Wallet, CheckCircle2 } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useConnection } from "wagmi";

interface ExecuteStepProps {
  tokenInputs: { tokenA: string; tokenB: string; chainId: number };
  flags: HookFlags;
  agentPrompt: string;
  feeTier: number;
  deployChoice: "existing" | "custom" | null;
  auditedHook: AuditedHook | null;
  deployedAddress: string | null;
}

export function ExecuteStep({
  tokenInputs,
  flags,
  agentPrompt,
  feeTier,
  deployChoice,
  auditedHook,
  deployedAddress,
}: ExecuteStepProps) {
  const [code, setCode] = useState("");
  const connection = useConnection();

  useEffect(() => {
    const generatedCode = generateHookCode(flags, agentPrompt);
    setCode(generatedCode);
  }, [flags, agentPrompt]);

  const hookAddress =
    deployChoice === "existing" && auditedHook
      ? auditedHook.address
      : deployedAddress || "0x0000000000000000000000000000000000000000";

  const tokenAResolved = resolveTokenInput(
    tokenInputs.tokenA,
    tokenInputs.chainId,
  );
  const tokenBResolved = resolveTokenInput(
    tokenInputs.tokenB,
    tokenInputs.chainId,
  );

  const txSummary = {
    contract: "PoolManager",
    address: "",
    method: "initialize",
    params: {
      key: {
        currency0: tokenAResolved?.address ?? "",
        currency1: tokenBResolved?.address ?? "",
        fee: feeTier,
        tickSpacing: 60,
        hooks: hookAddress,
      },
      sqrtPriceX96: "79228162514264337593543950336", // 1:1 price
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
      {/* Left: Transaction Summary */}
      <Card className="border-primary/30 cyber-glow overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Send className="w-5 h-5" />
            Transaction Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto h-[calc(100%-80px)]">
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Contract
              </p>
              <p className="font-mono text-sm text-primary">
                {txSummary.contract}
              </p>
              <code className="text-xs text-muted-foreground break-all">
                {txSummary.address}
              </code>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Method
              </p>
              <p className="font-mono text-sm text-secondary">
                {txSummary.method}()
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Parameters
              </p>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">currency0: </span>
                  <span className="text-foreground break-all">
                    {txSummary.params.key.currency0}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">currency1: </span>
                  <span className="text-foreground break-all">
                    {txSummary.params.key.currency1}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">fee: </span>
                  <span className="text-foreground">
                    {txSummary.params.key.fee}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">tickSpacing: </span>
                  <span className="text-foreground">
                    {txSummary.params.key.tickSpacing}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">hooks: </span>
                  <span className="text-primary break-all">
                    {txSummary.params.key.hooks}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            {connection.isConnected ? (
              <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Sign & Execute Transaction
              </Button>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <Button
                    onClick={openConnectModal}
                    disabled={!mounted}
                    className="w-full bg-gradient-to-r from-secondary to-accent hover:opacity-90"
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

      {/* Right: Monaco Editor */}
      <Card className="border-secondary/30 cyber-glow-purple overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-secondary">
            <FileCode className="w-5 h-5" />
            Hook Solidity Code
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100%-60px)]">
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
