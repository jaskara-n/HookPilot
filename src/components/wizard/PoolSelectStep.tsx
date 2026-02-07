import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import type { Chain } from "viem";
import { ChainSelect } from "./ChainSelect";
import {
  formatTokenDisplay,
  getCommonTokens,
  resolveTokenInput,
} from "@/lib/tokens";

export interface PoolConfig {
  chainId: number;
  tokenAInput: string;
  tokenBInput: string;
  feeTier: number;
}

interface PoolSelectStepProps {
  config: PoolConfig;
  onChange: (config: PoolConfig) => void;
}

export function PoolSelectStep({ config, onChange }: PoolSelectStepProps) {
  const handleChainChange = (chain: Chain) => {
    onChange({
      ...config,
      chainId: chain.id,
    });
  };

  const handleTokenInputChange = (
    value: string,
    slot: "tokenAInput" | "tokenBInput",
  ) => {
    onChange({
      ...config,
      [slot]: value,
    });
  };

  const handleFeeTierChange = (value: string) => {
    const tier = Number(value);
    if (Number.isNaN(tier)) {
      return;
    }
    onChange({
      ...config,
      feeTier: tier,
    });
  };

  const commonTokens = getCommonTokens(config.chainId);
  const tokenAResolved = resolveTokenInput(config.tokenAInput, config.chainId);
  const tokenBResolved = resolveTokenInput(config.tokenBInput, config.chainId);
  const tokenADisplay = formatTokenDisplay(config.tokenAInput, config.chainId);
  const tokenBDisplay = formatTokenDisplay(config.tokenBInput, config.chainId);

  const renderHelper = (
    input: string,
    resolved: ReturnType<typeof resolveTokenInput>,
    display: string | null,
  ) => {
    if (!input) {
      return (
        <p className="text-xs text-muted-foreground">
          Pick a common token or paste an address.
        </p>
      );
    }

    if (!resolved) {
      return (
        <p className="text-xs text-destructive">
          Enter a valid address or common symbol.
        </p>
      );
    }

    const addressPreview = `${resolved.address.slice(0, 6)}...${resolved.address.slice(-4)}`;
    const label = display ?? addressPreview;
    const suffix = display && display !== addressPreview ? ` · ${addressPreview}` : "";

    return (
      <p className="text-xs text-muted-foreground">
        Resolved: {label}
        {suffix}
      </p>
    );
  };

  return (
    <div className="space-y-8">
      <ChainSelect value={config.chainId} onChange={handleChainChange} />

      <div className="space-y-3">
        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Fee Tier
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Select value={String(config.feeTier)} onValueChange={handleFeeTierChange}>
            <SelectTrigger className="sm:w-[260px]">
              <SelectValue placeholder="Select fee tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Common tiers</SelectLabel>
                <SelectItem value="100">0.01%</SelectItem>
                <SelectItem value="500">0.05%</SelectItem>
                <SelectItem value="3000">0.30%</SelectItem>
                <SelectItem value="10000">1.00%</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Uniswap fee tiers (basis points × 100).
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Token A
        </Label>
        <Input
          list={`token-a-options-${config.chainId}`}
          placeholder="USDC or 0x..."
          value={config.tokenAInput}
          onChange={(e) => handleTokenInputChange(e.target.value, "tokenAInput")}
          className={cn(
            "font-mono",
            config.tokenAInput && !tokenAResolved && "border-destructive",
          )}
        />
        <datalist id={`token-a-options-${config.chainId}`}>
          {commonTokens.map((token) => (
            <option key={token.address} value={token.symbol}>
              {token.name}
            </option>
          ))}
        </datalist>
        {renderHelper(config.tokenAInput, tokenAResolved, tokenADisplay)}
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Token B
        </Label>
        <Input
          list={`token-b-options-${config.chainId}`}
          placeholder="ETH or 0x..."
          value={config.tokenBInput}
          onChange={(e) => handleTokenInputChange(e.target.value, "tokenBInput")}
          className={cn(
            "font-mono",
            config.tokenBInput && !tokenBResolved && "border-destructive",
          )}
        />
        <datalist id={`token-b-options-${config.chainId}`}>
          {commonTokens.map((token) => (
            <option key={token.address} value={token.symbol}>
              {token.name}
            </option>
          ))}
        </datalist>
        {renderHelper(config.tokenBInput, tokenBResolved, tokenBDisplay)}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="pool"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-xs text-muted-foreground"
        >
          Common tokens are shown for the selected chain. Paste any address to
          use a custom token.
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
