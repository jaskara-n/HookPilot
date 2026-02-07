import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "wagmi/chains";

export const chains = [
  mainnet,
  base,
  optimism,
  arbitrum,
  polygon,
  sepolia,
] as const;

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

export const config = getDefaultConfig({
  appName: "HookWizard",
  projectId: projectId || "YOUR_PROJECT_ID",
  chains,
  ssr: false,
});
