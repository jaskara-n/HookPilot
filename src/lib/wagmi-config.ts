import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "wagmi/chains";
import { arcTestnet } from "@/lib/custom-chains";

export const chains = [
  mainnet,
  base,
  optimism,
  arbitrum,
  polygon,
  sepolia,
  arcTestnet,
] as const;

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

export const config = getDefaultConfig({
  appName: "HookWizard",
  projectId: projectId || "00000000000000000000000000000000",
  chains,
  ssr: false,
});
