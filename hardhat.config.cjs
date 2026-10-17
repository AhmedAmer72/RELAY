require("dotenv").config();
require("dotenv").config({ path: ".env.local" });
require("@nomicfoundation/hardhat-toolbox");

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = privateKey
  ? [privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`]
  : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "london",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    mezoTestnet: {
      url: process.env.MEZO_TESTNET_RPC_URL || "https://rpc.test.mezo.org",
      chainId: 31611,
      accounts,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
