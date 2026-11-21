require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const FUJI_PRIVATE_KEY = process.env.FUJI_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    fuji: {
      url: "https://avalanche-fuji-c-chain-rpc.publicnode.com",
      chainId: 43113,
      accounts: [FUJI_PRIVATE_KEY],
      timeout: 60000,
    },
  },
  // Tên network trong etherscan PHẢI trùng với tên trong `networks` ("fuji"),
  // nếu không `npx hardhat verify --network fuji` sẽ không tìm được custom chain.
  // Routescan (Snowtrace Testnet) không bắt buộc API key thật → fallback "snowtrace".
  etherscan: {
    apiKey: {
      fuji: SNOWTRACE_API_KEY || "snowtrace",
    },
    customChains: [
      {
        network: "fuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan",
          browserURL: "https://testnet.snowtrace.io",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};
