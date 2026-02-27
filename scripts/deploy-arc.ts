// scripts/deploy-arc.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Read fee config for ArcFlowEscrow from env or set sensible defaults
  const feeCollector =
    process.env.ARC_FEE_COLLECTOR ?? deployer.address; // for now, default to deployer
  const feeBps = Number(process.env.ARC_FEE_BPS ?? 0); // 0 = no fee

  console.log("Escrow feeCollector:", feeCollector);
  console.log("Escrow feeBps:", feeBps);

  // Deploy ArcFlowEscrow (requires constructor args)
  const Escrow = await ethers.getContractFactory("ArcFlowEscrow");
  const escrow = await Escrow.deploy(feeCollector, feeBps);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("ArcFlowEscrow deployed to:", escrowAddress);

  // Deploy ArcFlowStreams (no constructor args)
  const Streams = await ethers.getContractFactory("ArcFlowStreams");
  const streams = await Streams.deploy();
  await streams.waitForDeployment();
  const streamsAddress = await streams.getAddress();
  console.log("ArcFlowStreams deployed to:", streamsAddress);

  // Deploy ArcFlowPayoutRouter (no constructor args)
  const Router = await ethers.getContractFactory("ArcFlowPayoutRouter");
  const router = await Router.deploy();
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("ArcFlowPayoutRouter deployed to:", routerAddress);

  console.log("\nEnv values for frontend/backend:");
  console.log("VITE_ARC_ESCROW_ADDRESS=", escrowAddress);
  console.log("VITE_ARC_STREAM_ADDRESS=", streamsAddress);
  console.log("VITE_ARC_PAYOUT_ROUTER_ADDRESS=", routerAddress);
  console.log("ARC_ESCROW_ADDRESS=", escrowAddress);
  console.log("ARC_STREAMS_ADDRESS=", streamsAddress);
  console.log("ARC_PAYOUT_ROUTER_ADDRESS=", routerAddress);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
