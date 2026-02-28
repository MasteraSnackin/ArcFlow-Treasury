import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

export const ARC_TESTNET_CHAIN_ID = 5042002;

export interface ArcConfig {
  rpcUrl: string;
  chainId: number;
  payoutRouterAddress: string;
  /** Optional — enables escrow/stream event indexing when set. */
  escrowAddress?: string;
  /** Optional — enables escrow/stream event indexing when set. */
  streamsAddress?: string;
}

export function getArcConfig(): ArcConfig {
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL;
  const payoutRouterAddress = process.env.ARC_PAYOUT_ROUTER_ADDRESS;

  if (!rpcUrl) {
    throw new Error("ARC_TESTNET_RPC_URL is not set in environment variables");
  }

  if (!payoutRouterAddress) {
    throw new Error("ARC_PAYOUT_ROUTER_ADDRESS is not set in environment variables");
  }

  return {
    rpcUrl,
    chainId: ARC_TESTNET_CHAIN_ID,
    payoutRouterAddress,
    escrowAddress:  process.env.ARC_ESCROW_ADDRESS  || undefined,
    streamsAddress: process.env.ARC_STREAMS_ADDRESS || undefined,
  };
}

export function createArcProvider(): ethers.JsonRpcProvider {
  const config = getArcConfig();
  return new ethers.JsonRpcProvider(config.rpcUrl, {
    chainId: config.chainId,
    name: "arc-testnet",
  });
}
