import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { generateHookCode } from "@/lib/hook-code-generator";
import type { AuditedHook, HookFlags } from "@/lib/hook-registry";
import {
  Shield,
  Rocket,
  Fuel,
  CheckCircle2,
  AlertTriangle,
  FileCode,
} from "lucide-react";

interface DecisionStepProps {
  auditedHook: AuditedHook | null;
  deployChoice: "existing" | "custom" | null;
  onSelectChoice: (choice: "existing" | "custom") => void;
  gasEstimates: { existing: number | null; custom: number };
  flags: HookFlags;
  agentPrompt: string;
}

export function DecisionStep({
  auditedHook,
  deployChoice,
  onSelectChoice,
  gasEstimates,
  flags,
  agentPrompt,
}: DecisionStepProps) {
  const [code, setCode] = useState("");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setCode(generateHookCode(flags, agentPrompt));
    setFlash(true);
    const timeout = setTimeout(() => setFlash(false), 450);
    return () => clearTimeout(timeout);
  }, [flags, agentPrompt]);

  const formatGas = (gas: number) => {
    if (gas >= 1000000) {
      return `~${(gas / 1000000).toFixed(1)}M gas`;
    }
    return `~${(gas / 1000).toFixed(0)}k gas`;
  };

  return (
    <div className="space-y-6">
      {auditedHook ? (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 cyber-glow">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <div>
              <p className="font-semibold text-green-400">
                Verified Audited Hook Found!
              </p>
              <p className="text-sm text-muted-foreground">
                {auditedHook.name} at{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {auditedHook.address.slice(0, 10)}...
                  {auditedHook.address.slice(-8)}
                </code>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Audited by {auditedHook.auditor}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <div>
              <p className="font-semibold text-yellow-400">
                No Audited Hook Found
              </p>
              <p className="text-sm text-muted-foreground">
                Your configuration requires a custom deployment
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Use Existing Option */}
        <Card
          className={cn(
            "cursor-pointer transition-all duration-300 border-2",
            auditedHook
              ? deployChoice === "existing"
                ? "border-primary bg-primary/5 cyber-glow"
                : "border-border hover:border-primary/50"
              : "opacity-50 cursor-not-allowed",
          )}
          onClick={() => auditedHook && onSelectChoice("existing")}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Use On-chain Audited</CardTitle>
                <CardDescription>
                  Link to existing verified hook
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              <span className="text-green-400 font-mono">
                {gasEstimates.existing
                  ? formatGas(gasEstimates.existing)
                  : "N/A"}
              </span>
              <span className="text-muted-foreground">estimated</span>
            </div>
          </CardContent>
        </Card>

        {/* Deploy Custom Option */}
        <Card
          className={cn(
            "cursor-pointer transition-all duration-300 border-2",
            deployChoice === "custom"
              ? "border-secondary bg-secondary/5 cyber-glow-purple"
              : "border-border hover:border-secondary/50",
          )}
          onClick={() => onSelectChoice("custom")}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Rocket className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-lg">Deploy New Custom</CardTitle>
                <CardDescription>
                  Create and deploy your own hook
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              <span className="text-orange-400 font-mono">
                {formatGas(gasEstimates.custom)}
              </span>
              <span className="text-muted-foreground">estimated</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {deployChoice === "custom" && (
        <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/30">
          <div className="flex items-center gap-3">
            <Rocket className="w-6 h-6 text-secondary" />
            <div>
              <p className="font-semibold text-secondary">
                Custom Deployment Selected
              </p>
              <p className="text-sm text-muted-foreground">
                We will mine the CREATE2 salt and deploy the hook in the next
                step.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card
        className={cn(
          "border-secondary/30 cyber-glow-purple overflow-hidden relative",
          flash && "ring-2 ring-secondary/40 animate-pulse-glow",
        )}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20 animate-shimmer" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-secondary">
            <FileCode className="w-5 h-5" />
            Hook Solidity Code
          </CardTitle>
          <CardDescription></CardDescription>
        </CardHeader>
        <CardContent className="p-0 h-[640px]">
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
              padding: { top: 14, bottom: 14 },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
