import type { Chain } from "viem";
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  sepolia,
} from "viem/chains";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAINNET_CHAINS = [mainnet, base, optimism, arbitrum, polygon];
const TESTNET_CHAINS = [sepolia, baseSepolia, optimismSepolia];

interface ChainSelectProps {
  value: number;
  onChange: (chain: Chain) => void;
}

export function ChainSelect({ value, onChange }: ChainSelectProps) {
  const handleChainChange = (nextValue: string) => {
    const chainId = Number(nextValue);
    const selected = [...MAINNET_CHAINS, ...TESTNET_CHAINS].find(
      (chain) => chain.id === chainId,
    );
    if (selected) {
      onChange(selected);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Network
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Select value={String(value)} onValueChange={handleChainChange}>
          <SelectTrigger className="sm:w-[260px]">
            <SelectValue placeholder="Select chain" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Mainnets</SelectLabel>
              {MAINNET_CHAINS.map((chain) => (
                <SelectItem key={chain.id} value={String(chain.id)}>
                  {chain.name} · {chain.nativeCurrency.symbol}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Testnets</SelectLabel>
              {TESTNET_CHAINS.map((chain) => (
                <SelectItem key={chain.id} value={String(chain.id)}>
                  {chain.name} · {chain.nativeCurrency.symbol}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
