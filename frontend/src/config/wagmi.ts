import { http, createConfig } from "wagmi";
import { avalancheFuji } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const config = createConfig({
  chains: [avalancheFuji],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "MindSpark",
        url: "http://localhost:3000",
      },
    }),
    injected(),
  ],
  transports: {
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
  ssr: true,
});

export const CONTRACTS = {
  VAULT: (process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
    "0xB4B96B56E7b86ed7484Fe26919c509E14E6fb111") as `0x${string}`,
  SBT: (process.env.NEXT_PUBLIC_SBT_ADDRESS ||
    "0x9D3756BeE86E9FF34773B4D3f9E323FfdD8F3afA") as `0x${string}`,
  X402: (process.env.NEXT_PUBLIC_X402_ADDRESS ||
    "0x25e95555fed513Cb0d5a4Cb9FA0e2A698F5ED9eE") as `0x${string}`,
};
