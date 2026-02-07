import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import type { Chain } from 'viem';
import { ChainSelect } from './ChainSelect';

interface Token {
  symbol: string;
  name: string;
  icon: string;
  color: string;
}

const TOKENS: Token[] = [
  { symbol: 'USDC', name: 'USD Coin', icon: '💵', color: 'from-blue-500 to-blue-600' },
  { symbol: 'ETH', name: 'Ethereum', icon: '⟠', color: 'from-indigo-500 to-purple-600' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '₿', color: 'from-orange-500 to-amber-500' },
];

export interface PoolConfig {
  chainId: number;
  tokenA: string | null;
  tokenB: string | null;
  tokenAAddress: string;
  tokenBAddress: string;
}

interface PoolTypeSelectorProps {
  config: PoolConfig;
  onChange: (config: PoolConfig) => void;
}

export function PoolTypeSelector({ config, onChange }: PoolTypeSelectorProps) {
  const [inputMode, setInputMode] = useState<'select' | 'address'>('select');

  const handleChainChange = (chain: Chain) => {
    onChange({
      ...config,
      chainId: chain.id,
    });
  };

  const handleTokenSelect = (token: string, slot: 'tokenA' | 'tokenB') => {
    onChange({
      ...config,
      [slot]: config[slot] === token ? null : token,
      [`${slot}Address`]: '',
    });
  };

  const handleAddressChange = (address: string, slot: 'tokenAAddress' | 'tokenBAddress') => {
    const tokenSlot = slot === 'tokenAAddress' ? 'tokenA' : 'tokenB';
    onChange({
      ...config,
      [slot]: address,
      [tokenSlot]: null,
    });
  };

  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  return (
    <div className="space-y-8">
      <ChainSelect value={config.chainId} onChange={handleChainChange} />

      <AnimatePresence mode="wait">
        <motion.div
          key="new"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          {/* Input Mode Toggle */}
          <div className="flex items-center gap-2 p-1 rounded-lg bg-muted w-fit">
            <button
              onClick={() => setInputMode('select')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                inputMode === 'select'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Select Tokens
            </button>
            <button
              onClick={() => setInputMode('address')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                inputMode === 'address'
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Enter Addresses
            </button>
          </div>

          {inputMode === 'select' ? (
            <div className="space-y-6">
              {/* Token A Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Token A
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {TOKENS.map((token) => {
                    const isSelected = config.tokenA === token.symbol;
                    const isDisabled = config.tokenB === token.symbol;

                    return (
                      <button
                        key={`a-${token.symbol}`}
                        onClick={() => !isDisabled && handleTokenSelect(token.symbol, 'tokenA')}
                        disabled={isDisabled}
                        className={cn(
                          'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300',
                          isSelected && 'border-primary bg-primary/10 glow-primary',
                          !isSelected && !isDisabled && 'border-border hover:border-primary/50 hover:bg-muted/50',
                          isDisabled && 'opacity-30 cursor-not-allowed'
                        )}
                      >
                        <div
                          className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-gradient-to-br',
                            token.color
                          )}
                        >
                          {token.icon}
                        </div>
                        <div className="text-center">
                          <p className={cn('font-bold', isSelected && 'text-primary')}>
                            {token.symbol}
                          </p>
                          <p className="text-xs text-muted-foreground">{token.name}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-[10px] text-primary-foreground">✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Token B Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Token B
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {TOKENS.map((token) => {
                    const isSelected = config.tokenB === token.symbol;
                    const isDisabled = config.tokenA === token.symbol;

                    return (
                      <button
                        key={`b-${token.symbol}`}
                        onClick={() => !isDisabled && handleTokenSelect(token.symbol, 'tokenB')}
                        disabled={isDisabled}
                        className={cn(
                          'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300',
                          isSelected && 'border-primary bg-primary/10 glow-primary',
                          !isSelected && !isDisabled && 'border-border hover:border-primary/50 hover:bg-muted/50',
                          isDisabled && 'opacity-30 cursor-not-allowed'
                        )}
                      >
                        <div
                          className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-gradient-to-br',
                            token.color
                          )}
                        >
                          {token.icon}
                        </div>
                        <div className="text-center">
                          <p className={cn('font-bold', isSelected && 'text-primary')}>
                            {token.symbol}
                          </p>
                          <p className="text-xs text-muted-foreground">{token.name}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-[10px] text-primary-foreground">✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tokenANew">Token A Address</Label>
                <Input
                  id="tokenANew"
                  placeholder="0x..."
                  value={config.tokenAAddress}
                  onChange={(e) => handleAddressChange(e.target.value, 'tokenAAddress')}
                  className={cn(
                    'font-mono',
                    config.tokenAAddress && !isValidAddress(config.tokenAAddress) && 'border-destructive'
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tokenBNew">Token B Address</Label>
                <Input
                  id="tokenBNew"
                  placeholder="0x..."
                  value={config.tokenBAddress}
                  onChange={(e) => handleAddressChange(e.target.value, 'tokenBAddress')}
                  className={cn(
                    'font-mono',
                    config.tokenBAddress && !isValidAddress(config.tokenBAddress) && 'border-destructive'
                  )}
                />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
