import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { generateHookCode } from "@/lib/hook-code-generator";
import type { HookFlags } from "@/lib/hook-registry";
import { Percent, ListOrdered, Sparkles, AlertTriangle, CheckCircle2, FileCode } from "lucide-react";

interface FeatureTogglesProps {
  flags: HookFlags;
  onFlagsChange: (flags: HookFlags) => void;
  agentPrompt: string;
  onAgentPromptChange: (prompt: string) => void;
}

const FEATURES = [
  {
    key: 'feeThreshold' as const,
    label: 'Fee Threshold',
    description: 'Collect fees and distribute once the threshold is reached',
    icon: Percent,
  },
  {
    key: 'limitOrders' as const,
    label: 'Limit Orders',
    description: 'Enable limit order functionality in the pool',
    icon: ListOrdered,
  },
];

export function FeatureToggles({
  flags,
  onFlagsChange,
  agentPrompt,
  onAgentPromptChange,
}: FeatureTogglesProps) {
  const [code, setCode] = useState("");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setCode(generateHookCode(flags, agentPrompt));
    setFlash(true);
    const timeout = setTimeout(() => setFlash(false), 450);
    return () => clearTimeout(timeout);
  }, [flags, agentPrompt]);

  const handleToggle = (key: keyof HookFlags) => {
    onFlagsChange({ ...flags, [key]: !flags[key] });
  };

  const hasActiveFlags = Object.values(flags).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Audit Recommendation Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20">
        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-primary">We recommend using audited hook implementations</p>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-audited hooks have been security reviewed and gas optimized. 
            Select features below to find matching audited hooks in our registry.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          const isActive = flags[feature.key];

          return (
            <div
              key={feature.key}
              className={cn(
                'flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300',
                isActive
                  ? 'border-primary bg-primary/5 glow-primary'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    isActive ? 'bg-primary/20' : 'bg-muted'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div>
                  <Label
                    htmlFor={feature.key}
                    className={cn(
                      'font-semibold cursor-pointer',
                      isActive && 'text-primary'
                    )}
                  >
                    {feature.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
              <Switch
                id={feature.key}
                checked={isActive}
                onCheckedChange={() => handleToggle(feature.key)}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "border border-secondary/30 rounded-xl overflow-hidden relative cyber-glow-purple",
          flash && "ring-2 ring-secondary/40 animate-pulse-glow"
        )}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20 animate-shimmer" />
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/10">
          <FileCode className="w-4 h-4 text-secondary" />
          <p className="text-sm font-semibold text-secondary">
            Live Hook Code (Updates With Toggles)
          </p>
        </div>
        <div className="h-[480px]">
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
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <Label className="font-semibold text-accent">Agent Mode</Label>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            AI-Powered
          </span>
        </div>
        
        <Textarea
          placeholder="Describe custom hook logic in natural language... e.g., 'Only allow swaps during UTC business hours' or 'Apply 0.1% fee discount for holders of NFT collection X'"
          value={agentPrompt}
          onChange={(e) => onAgentPromptChange(e.target.value)}
          className="min-h-[100px] resize-none bg-muted/50 border-accent/30 focus:border-accent placeholder:text-muted-foreground/50"
        />
        
        {/* Agent Mode Warning */}
        {agentPrompt.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">⚠️ AUDIT BEFORE DEPLOYMENT</p>
              <p className="text-sm text-muted-foreground mt-1">
                AI-generated hook code must be thoroughly audited by a security professional 
                before deploying to mainnet. Custom logic may contain vulnerabilities.
              </p>
            </div>
          </div>
        )}
        
        {agentPrompt.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Natural language input for AI-assisted hook generation. 
            Generated code requires security audit.
          </p>
        )}
      </div>
    </div>
  );
}
