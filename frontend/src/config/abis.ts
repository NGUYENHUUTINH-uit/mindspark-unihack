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
  {
    name: "penaltyPool",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "MINIMUM_STAKE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "oracleSigner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
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
      { name: "totalMinutes", type: "uint32" },
      { name: "totalSessions", type: "uint32" },
      { name: "feynmanAvgScore", type: "uint16" },
      { name: "lastUpdated", type: "uint32" },
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
  {
    name: "claimStreamPayout",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "minutesFocused", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "totalBountyPool",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "payoutRatePerMinute",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "aiQueryPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isQueryPaid",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "queryHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "studentClaimedNonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "student", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
