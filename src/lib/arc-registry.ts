import type { Address } from "viem";

export const ARC_TESTNET = {
  chainId: 5042002,
  rpcUrl: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  usdc: "0x3600000000000000000000000000000000000000" as Address,
  gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as Address,
  gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" as Address,
  cctpTokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as Address,
  cctpMessageTransmitterV2:
    "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as Address,
};
