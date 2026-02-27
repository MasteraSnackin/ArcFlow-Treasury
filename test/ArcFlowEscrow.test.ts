import { expect } from "chai";
import { ethers } from "hardhat";
import { ArcFlowEscrow, ArcFlowEscrow__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("ArcFlowEscrow", function () {
  let escrow: ArcFlowEscrow;
  let payer: SignerWithAddress;
  let payee: SignerWithAddress;
  let arbitrator: SignerWithAddress;
  let feeCollector: SignerWithAddress;
  let mockToken: any;

  beforeEach(async function () {
    [payer, payee, arbitrator, feeCollector] = await ethers.getSigners();

    // Deploy a mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
    mockToken = await MockERC20.deploy("MockUSDC", "mUSDC", 6);
    await mockToken.waitForDeployment();

    // Mint tokens to payer
    await mockToken.mint(payer.address, ethers.parseUnits("10000", 6));

    // Deploy escrow contract with 1% fee (100 bps)
    const EscrowFactory = await ethers.getContractFactory("ArcFlowEscrow") as ArcFlowEscrow__factory;
    escrow = await EscrowFactory.deploy(feeCollector.address, 100);
    await escrow.waitForDeployment();
  });

  describe("createEscrow", function () {
    it("should create an escrow successfully", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600; // 1 hour from now

      // Approve escrow contract
      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);

      // Create escrow
      const tx = await escrow.connect(payer).createEscrow(
        payee.address,
        await mockToken.getAddress(),
        amount,
        expiry,
        arbitrator.address
      );

      await expect(tx)
        .to.emit(escrow, "EscrowCreated")
        .withArgs(0, payer.address, payee.address, await mockToken.getAddress(), amount, expiry, arbitrator.address);

      // Verify escrow data
      const escrowData = await escrow.escrows(0);
      expect(escrowData.payer).to.equal(payer.address);
      expect(escrowData.payee).to.equal(payee.address);
      expect(escrowData.amount).to.equal(amount);
      expect(escrowData.expiry).to.equal(expiry);
      expect(escrowData.arbitrator).to.equal(arbitrator.address);
      expect(escrowData.disputed).to.be.false;
      expect(escrowData.released).to.be.false;
      expect(escrowData.refunded).to.be.false;
    });

    it("should revert if payee is zero address", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600;

      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);

      await expect(
        escrow.connect(payer).createEscrow(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          amount,
          expiry,
          arbitrator.address
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidEscrow");
    });

    it("should revert if amount is zero", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600;

      await expect(
        escrow.connect(payer).createEscrow(
          payee.address,
          await mockToken.getAddress(),
          0,
          expiry,
          arbitrator.address
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidEscrow");
    });
  });

  describe("autoRelease", function () {
    it("should auto-release funds after expiry", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 100; // 100 seconds from now

      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);
      await escrow.connect(payer).createEscrow(
        payee.address,
        await mockToken.getAddress(),
        amount,
        expiry,
        arbitrator.address
      );

      // Wait for expiry
      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      // Auto release
      const tx = await escrow.autoRelease(0);
      await expect(tx).to.emit(escrow, "EscrowReleased").withArgs(0);

      // Verify payee received funds (minus 1% fee)
      const expectedNet = (amount * BigInt(9900)) / BigInt(10000);
      const payeeBalance = await mockToken.balanceOf(payee.address);
      expect(payeeBalance).to.equal(expectedNet);

      // Verify fee collector received fee
      const expectedFee = (amount * BigInt(100)) / BigInt(10000);
      const feeCollectorBalance = await mockToken.balanceOf(feeCollector.address);
      expect(feeCollectorBalance).to.equal(expectedFee);
    });

    it("should revert if called before expiry", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600;

      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);
      await escrow.connect(payer).createEscrow(
        payee.address,
        await mockToken.getAddress(),
        amount,
        expiry,
        arbitrator.address
      );

      await expect(escrow.autoRelease(0)).to.be.revertedWithCustomError(escrow, "TooEarly");
    });
  });

  describe("raiseDispute", function () {
    it("should allow payer or payee to raise a dispute", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600;

      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);
      await escrow.connect(payer).createEscrow(
        payee.address,
        await mockToken.getAddress(),
        amount,
        expiry,
        arbitrator.address
      );

      const tx = await escrow.connect(payee).raiseDispute(0);
      await expect(tx).to.emit(escrow, "EscrowDisputed").withArgs(0);

      const escrowData = await escrow.escrows(0);
      expect(escrowData.disputed).to.be.true;
    });

    it("should revert if non-participant tries to raise dispute", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600;

      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);
      await escrow.connect(payer).createEscrow(
        payee.address,
        await mockToken.getAddress(),
        amount,
        expiry,
        arbitrator.address
      );

      const [, , , , outsider] = await ethers.getSigners();
      await expect(escrow.connect(outsider).raiseDispute(0)).to.be.revertedWithCustomError(
        escrow,
        "NotParticipant"
      );
    });
  });

  describe("resolveDispute", function () {
    it("should allow arbitrator to resolve dispute in favor of payee", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600;

      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);
      await escrow.connect(payer).createEscrow(
        payee.address,
        await mockToken.getAddress(),
        amount,
        expiry,
        arbitrator.address
      );

      await escrow.connect(payee).raiseDispute(0);

      const tx = await escrow.connect(arbitrator).resolveDispute(0, true);
      await expect(tx).to.emit(escrow, "EscrowResolved").withArgs(0, true);
      await expect(tx).to.emit(escrow, "EscrowReleased").withArgs(0);

      const expectedNet = (amount * BigInt(9900)) / BigInt(10000);
      const payeeBalance = await mockToken.balanceOf(payee.address);
      expect(payeeBalance).to.equal(expectedNet);
    });

    it("should allow arbitrator to resolve dispute in favor of payer (refund)", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600;
      const initialPayerBalance = await mockToken.balanceOf(payer.address);

      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);
      await escrow.connect(payer).createEscrow(
        payee.address,
        await mockToken.getAddress(),
        amount,
        expiry,
        arbitrator.address
      );

      await escrow.connect(payer).raiseDispute(0);

      const tx = await escrow.connect(arbitrator).resolveDispute(0, false);
      await expect(tx).to.emit(escrow, "EscrowResolved").withArgs(0, false);
      await expect(tx).to.emit(escrow, "EscrowRefunded").withArgs(0);

      const expectedNet = (amount * BigInt(9900)) / BigInt(10000);
      const finalPayerBalance = await mockToken.balanceOf(payer.address);
      expect(finalPayerBalance).to.equal(initialPayerBalance - amount + expectedNet);
    });

    it("should revert if non-arbitrator tries to resolve", async function () {
      const amount = ethers.parseUnits("100", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expiry = latestBlock!.timestamp + 3600;

      await mockToken.connect(payer).approve(await escrow.getAddress(), amount);
      await escrow.connect(payer).createEscrow(
        payee.address,
        await mockToken.getAddress(),
        amount,
        expiry,
        arbitrator.address
      );

      await escrow.connect(payee).raiseDispute(0);

      await expect(escrow.connect(payer).resolveDispute(0, true)).to.be.revertedWithCustomError(
        escrow,
        "NotArbitrator"
      );
    });
  });
});
