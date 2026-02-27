import { expect } from "chai";
import { ethers } from "hardhat";
import { ArcFlowPayoutRouter, ArcFlowPayoutRouter__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("ArcFlowPayoutRouter", function () {
  let router: ArcFlowPayoutRouter;
  let creator: SignerWithAddress;
  let recipient1: SignerWithAddress;
  let recipient2: SignerWithAddress;
  let recipient3: SignerWithAddress;
  let mockToken: any;

  beforeEach(async function () {
    [creator, recipient1, recipient2, recipient3] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
    mockToken = await MockERC20.deploy("MockUSDC", "mUSDC", 6);
    await mockToken.waitForDeployment();

    // Mint tokens to creator
    await mockToken.mint(creator.address, ethers.parseUnits("10000", 6));

    // Deploy router contract
    const RouterFactory = await ethers.getContractFactory("ArcFlowPayoutRouter") as ArcFlowPayoutRouter__factory;
    router = await RouterFactory.deploy();
    await router.waitForDeployment();
  });

  describe("createBatchPayout", function () {
    it("should create a batch payout successfully and emit PayoutInstruction events", async function () {
      const recipients = [recipient1.address, recipient2.address, recipient3.address];
      const amounts = [
        ethers.parseUnits("100", 6),
        ethers.parseUnits("200", 6),
        ethers.parseUnits("300", 6),
      ];
      const destinationChains = [
        ethers.encodeBytes32String("ARC"),
        ethers.encodeBytes32String("BASE"),
        ethers.encodeBytes32String("POLYGON"),
      ];

      const totalAmount = amounts.reduce((sum, amt) => sum + amt, BigInt(0));

      await mockToken.connect(creator).approve(await router.getAddress(), totalAmount);

      const tx = await router.connect(creator).createBatchPayout(
        await mockToken.getAddress(),
        recipients,
        amounts,
        destinationChains
      );

      // Check BatchCreated event
      await expect(tx)
        .to.emit(router, "BatchCreated")
        .withArgs(0, creator.address, await mockToken.getAddress(), totalAmount);

      // Check PayoutInstruction events
      for (let i = 0; i < recipients.length; i++) {
        await expect(tx)
          .to.emit(router, "PayoutInstruction")
          .withArgs(0, i, recipients[i], amounts[i], destinationChains[i]);
      }

      // Verify batch data
      const batchData = await router.batches(0);
      expect(batchData.creator).to.equal(creator.address);
      expect(batchData.token).to.equal(await mockToken.getAddress());
      expect(batchData.totalAmount).to.equal(totalAmount);
    });

    it("should increment batchId for each new batch", async function () {
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 6)];
      const destinationChains = [ethers.encodeBytes32String("ARC")];

      await mockToken.connect(creator).approve(await router.getAddress(), ethers.parseUnits("1000", 6));

      // Create first batch
      await router.connect(creator).createBatchPayout(
        await mockToken.getAddress(),
        recipients,
        amounts,
        destinationChains
      );

      const nextBatchId1 = await router.nextBatchId();
      expect(nextBatchId1).to.equal(1);

      // Create second batch
      await router.connect(creator).createBatchPayout(
        await mockToken.getAddress(),
        recipients,
        amounts,
        destinationChains
      );

      const nextBatchId2 = await router.nextBatchId();
      expect(nextBatchId2).to.equal(2);
    });

    it("should revert if recipients array is empty", async function () {
      const recipients: string[] = [];
      const amounts: bigint[] = [];
      const destinationChains: string[] = [];

      await expect(
        router.connect(creator).createBatchPayout(
          await mockToken.getAddress(),
          recipients,
          amounts,
          destinationChains
        )
      ).to.be.revertedWithCustomError(router, "InvalidBatch");
    });

    it("should revert if array lengths don't match", async function () {
      const recipients = [recipient1.address, recipient2.address];
      const amounts = [ethers.parseUnits("100", 6)]; // Mismatched length
      const destinationChains = [ethers.encodeBytes32String("ARC"), ethers.encodeBytes32String("BASE")];

      await expect(
        router.connect(creator).createBatchPayout(
          await mockToken.getAddress(),
          recipients,
          amounts,
          destinationChains
        )
      ).to.be.revertedWithCustomError(router, "LengthMismatch");
    });

    it("should revert if total amount is zero", async function () {
      const recipients = [recipient1.address];
      const amounts = [BigInt(0)];
      const destinationChains = [ethers.encodeBytes32String("ARC")];

      await expect(
        router.connect(creator).createBatchPayout(
          await mockToken.getAddress(),
          recipients,
          amounts,
          destinationChains
        )
      ).to.be.revertedWithCustomError(router, "InvalidBatch");
    });

    it("should handle large batch with multiple destinations", async function () {
      const numRecipients = 10;
      const recipients: string[] = [];
      const amounts: bigint[] = [];
      const destinationChains: string[] = [];
      const chains = ["ARC", "BASE", "POLYGON", "OPTIMISM", "ARBITRUM"];

      for (let i = 0; i < numRecipients; i++) {
        recipients.push(ethers.Wallet.createRandom().address);
        amounts.push(ethers.parseUnits((i + 1).toString(), 6));
        destinationChains.push(ethers.encodeBytes32String(chains[i % chains.length]));
      }

      const totalAmount = amounts.reduce((sum, amt) => sum + amt, BigInt(0));

      await mockToken.connect(creator).approve(await router.getAddress(), totalAmount);

      const tx = await router.connect(creator).createBatchPayout(
        await mockToken.getAddress(),
        recipients,
        amounts,
        destinationChains
      );

      // Verify BatchCreated event
      await expect(tx)
        .to.emit(router, "BatchCreated")
        .withArgs(0, creator.address, await mockToken.getAddress(), totalAmount);

      // Verify all PayoutInstruction events were emitted
      const receipt = await tx.wait();
      const payoutInstructionEvents = receipt!.logs.filter((log: any) => {
        try {
          const parsed = router.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          return parsed?.name === "PayoutInstruction";
        } catch {
          return false;
        }
      });

      expect(payoutInstructionEvents.length).to.equal(numRecipients);
    });
  });

  describe("getNextBatchId", function () {
    it("should return 0 initially", async function () {
      const nextId = await router.getNextBatchId();
      expect(nextId).to.equal(0);
    });

    it("should return correct value after batches created", async function () {
      const recipients = [recipient1.address];
      const amounts = [ethers.parseUnits("100", 6)];
      const destinationChains = [ethers.encodeBytes32String("ARC")];

      await mockToken.connect(creator).approve(await router.getAddress(), ethers.parseUnits("300", 6));

      await router.connect(creator).createBatchPayout(
        await mockToken.getAddress(),
        recipients,
        amounts,
        destinationChains
      );

      await router.connect(creator).createBatchPayout(
        await mockToken.getAddress(),
        recipients,
        amounts,
        destinationChains
      );

      const nextId = await router.getNextBatchId();
      expect(nextId).to.equal(2);
    });
  });

  describe("event emission count", function () {
    it("should emit exactly N PayoutInstruction events for N recipients", async function () {
      const recipients = [recipient1.address, recipient2.address, recipient3.address];
      const amounts = [
        ethers.parseUnits("100", 6),
        ethers.parseUnits("200", 6),
        ethers.parseUnits("300", 6),
      ];
      const destinationChains = [
        ethers.encodeBytes32String("ARC"),
        ethers.encodeBytes32String("BASE"),
        ethers.encodeBytes32String("POLYGON"),
      ];

      const totalAmount = amounts.reduce((sum, amt) => sum + amt, BigInt(0));
      await mockToken.connect(creator).approve(await router.getAddress(), totalAmount);

      const tx = await router.connect(creator).createBatchPayout(
        await mockToken.getAddress(),
        recipients,
        amounts,
        destinationChains
      );

      const receipt = await tx.wait();

      let payoutInstructionCount = 0;
      for (const log of receipt!.logs) {
        try {
          const parsed = router.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed?.name === "PayoutInstruction") {
            payoutInstructionCount++;
          }
        } catch {
          // Not a router event, skip
        }
      }

      expect(payoutInstructionCount).to.equal(recipients.length);
    });
  });
});
