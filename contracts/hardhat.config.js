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
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [FUJI_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      snowtrace: SNOWTRACE_API_KEY,
    },
    customChains: [
      {
        network: "snowtrace",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan",
          browserURL: "https://testnet.snowtrace.io",
        },
      },
    ],
  },
};
