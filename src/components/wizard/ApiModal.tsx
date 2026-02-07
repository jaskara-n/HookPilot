import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Editor from '@monaco-editor/react';
import { Code2 } from 'lucide-react';

const API_SCHEMA = `{
  "endpoint": "POST /api/v1/hooks/deploy",
  "description": "Deploy or link a Uniswap v4 hook via API",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer <API_KEY>"
  },
  "body": {
    "pair": {
      "tokenA": "string (address or symbol)",
      "tokenB": "string (address or symbol)"
    },
    "flags": {
      "feeThreshold": "boolean",
      "limitOrders": "boolean"
    },
    "agentPrompt": "string (optional, natural language)",
    "deployStrategy": "'existing' | 'custom'",
    "options": {
      "chainId": "number (default: 1)",
      "gasLimit": "string (optional)",
      "salt": "bytes32 (optional, for CREATE2)"
    }
  },
  "response": {
    "success": true,
    "data": {
      "hookAddress": "0x...",
      "poolKey": {
        "currency0": "0x...",
        "currency1": "0x...",
        "fee": 3000,
        "tickSpacing": 60,
        "hooks": "0x..."
      },
      "transactionHash": "0x...",
      "gasUsed": "string"
    }
  },
  "errors": {
    "400": "Invalid request parameters",
    "401": "Unauthorized - invalid API key",
    "422": "Hook deployment failed",
    "500": "Internal server error"
  }
}`;

export function ApiModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
          <Code2 className="w-4 h-4 mr-2" />
          API for Agents
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Code2 className="w-5 h-5" />
            API for Agents
          </DialogTitle>
          <DialogDescription>
            Use this JSON POST schema to integrate hook deployment with AI agents or automation tools.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[400px] rounded-lg overflow-hidden border border-border">
          <Editor
            height="100%"
            language="json"
            theme="vs-dark"
            value={API_SCHEMA}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 16, bottom: 16 },
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
