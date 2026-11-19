import { http, createConfig } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [avalancheFuji],
  connectors: [
    injected(), // Tự động nhận diện Core Wallet, MetaMask hoặc bất kỳ ví Web3 nào (EIP-6963 & EIP-1193)
  ],
  transports: {
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
  ssr: true,
});

export const CONTRACTS = {
  VAULT: (process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
    "0x62A647BD25a4AfD418cFDDAD99cbA3e49B775223") as `0x${string}`,
  SBT: (process.env.NEXT_PUBLIC_SBT_ADDRESS ||
    "0x7B8CBC1986855357Ea9383Fd4dd2Aac9C0864B86") as `0x${string}`,
  X402: (process.env.NEXT_PUBLIC_X402_ADDRESS ||
    "0x143B9679eE996F1565654a1833709AB84B7Eea3C") as `0x${string}`,
};
