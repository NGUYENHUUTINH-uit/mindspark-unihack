export const VAULT_ABI = [
  {
    name: "stakeForSession",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "targetMinutes", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimReward",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "completedMinutes", type: "uint256" },
      { name: "feynmanScore", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "sessions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "student", type: "address" }],
    outputs: [
      { name: "stakedAmount", type: "uint256" },
      { name: "targetMinutes", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
  },
] as const;

export const SBT_ABI = [
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "badgeMetrics",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "level", type: "uint256" },
      { name: "totalMinutes", type: "uint256" },
      { name: "avgFeynmanScore", type: "uint256" },
    ],
  },
] as const;

export const X402_ABI = [
  {
    name: "payForAiQuery",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "queryHash", type: "bytes32" }],
    outputs: [],
  },
] as const;
