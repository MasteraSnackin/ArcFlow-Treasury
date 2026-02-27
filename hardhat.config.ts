import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Arc testnet RPC + key from .env
const ARC_TESTNET_RPC_URL = process.env.ARC_TESTNET_RPC_URL || "";
const ARC_PRIVATE_KEY = process.env.ARC_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    arcTestnet: {
      url: ARC_TESTNET_RPC_URL,
      accounts: (ARC_PRIVATE_KEY && ARC_PRIVATE_KEY.startsWith("0x") && ARC_PRIVATE_KEY.length === 66) ? [ARC_PRIVATE_KEY] : [],
      chainId: 5042002, // Arc Testnet chainId per Arc docs
    },
  },
};

export default config;

