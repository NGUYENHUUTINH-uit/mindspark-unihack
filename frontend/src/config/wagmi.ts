import { http, createConfig } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [avalancheFuji],
  connectors: [
    injected({ target: "metaMask" }),
    injected(), // Hỗ trợ Avalanche Core Wallet & các ví trình duyệt khác
  ],
  transports: {
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
});

export const CONTRACTS = {
  VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`,
  SBT: process.env.NEXT_PUBLIC_SBT_ADDRESS as `0x${string}`,
  X402: process.env.NEXT_PUBLIC_X402_ADDRESS as `0x${string}`,
};
