export const VAULT_ABI = [
  {
    name: "stake",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "targetMinutes", type: "uint256" },
      { name: "durationDays", type: "uint256" },
    ],
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
    name: "userSessions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "student", type: "address" }],
    outputs: [
      { name: "stakedAmount", type: "uint256" },
      { name: "targetMinutes", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "isActive", type: "bool" },
      { name: "isClaimed", type: "bool" },
    ],
  },
  {
    name: "userNonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "student", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
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
    name: "studentToBadgeId",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "student", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "badgeMetrics",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "level", type: "uint8" },
      { name: "totalStudyMinutes", type: "uint32" },
      { name: "sessionsCompleted", type: "uint32" },
      { name: "avgFeynmanScore", type: "uint32" },
      { name: "lastSessionTimestamp", type: "uint64" },
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
