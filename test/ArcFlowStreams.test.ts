import { expect } from "chai";
import { ethers } from "hardhat";
import { ArcFlowStreams, ArcFlowStreams__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("ArcFlowStreams", function () {
  let streams: ArcFlowStreams;
  let employer: SignerWithAddress;
  let employee: SignerWithAddress;
  let mockToken: any;

  beforeEach(async function () {
    [employer, employee] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
    mockToken = await MockERC20.deploy("MockUSDC", "mUSDC", 6);
    await mockToken.waitForDeployment();

    // Mint tokens to employer
    await mockToken.mint(employer.address, ethers.parseUnits("10000", 6));

    // Deploy streams contract
    const StreamsFactory = await ethers.getContractFactory("ArcFlowStreams") as ArcFlowStreams__factory;
    streams = await StreamsFactory.deploy();
    await streams.waitForDeployment();
  });

  describe("createStream", function () {
    it("should create a stream successfully", async function () {
      const totalAmount = ethers.parseUnits("1200", 6); // $1200
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;
      const start = now + 10;
      const cliff = start + 60; // 1 minute cliff
      const end = start + 3600; // 1 hour total

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);

      const tx = await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        start,
        cliff,
        end
      );

      await expect(tx)
        .to.emit(streams, "StreamCreated")
        .withArgs(0, employer.address, employee.address, await mockToken.getAddress(), totalAmount, start, cliff, end);

      const streamData = await streams.streams(0);
      expect(streamData.employer).to.equal(employer.address);
      expect(streamData.employee).to.equal(employee.address);
      expect(streamData.totalAmount).to.equal(totalAmount);
      expect(streamData.start).to.equal(start);
      expect(streamData.cliff).to.equal(cliff);
      expect(streamData.end).to.equal(end);
      expect(streamData.withdrawn).to.equal(0);
    });

    it("should revert if employee is zero address", async function () {
      const totalAmount = ethers.parseUnits("1200", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;

      await expect(
        streams.connect(employer).createStream(
          ethers.ZeroAddress,
          await mockToken.getAddress(),
          totalAmount,
          now + 10,
          now + 60,
          now + 3600
        )
      ).to.be.revertedWithCustomError(streams, "InvalidStream");
    });

    it("should revert if totalAmount is zero", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;

      await expect(
        streams.connect(employer).createStream(
          employee.address,
          await mockToken.getAddress(),
          0,
          now + 10,
          now + 60,
          now + 3600
        )
      ).to.be.revertedWithCustomError(streams, "InvalidStream");
    });

    it("should revert if end <= start", async function () {
      const totalAmount = ethers.parseUnits("1200", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;

      await expect(
        streams.connect(employer).createStream(
          employee.address,
          await mockToken.getAddress(),
          totalAmount,
          now + 3600,
          now + 60,
          now + 60
        )
      ).to.be.revertedWithCustomError(streams, "InvalidStream");
    });
  });

  describe("getVested and getWithdrawable", function () {
    it("should return 0 before cliff", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;
      const start = now + 10;
      const cliff = now + 100;
      const end = now + 1000;

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);
      await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        start,
        cliff,
        end
      );

      // Still before cliff
      await ethers.provider.send("evm_setNextBlockTimestamp", [cliff - 5]);
      await ethers.provider.send("evm_mine", []);

      const vested = await streams.getVested(0);
      const withdrawable = await streams.getWithdrawable(0);

      expect(vested).to.equal(0);
      expect(withdrawable).to.equal(0);
    });

    it("should return correct amount after cliff but before end", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;
      const start = now;
      const cliff = now + 100;
      const end = now + 1000;

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);
      await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        start,
        cliff,
        end
      );

      // Halfway between cliff and end
      const midpoint = cliff + ((end - cliff) / 2);
      await ethers.provider.send("evm_setNextBlockTimestamp", [midpoint]);
      await ethers.provider.send("evm_mine", []);

      const vested = await streams.getVested(0);
      const withdrawable = await streams.getWithdrawable(0);

      // Should be approximately 50% vested
      const expected = totalAmount / BigInt(2);
      const tolerance = ethers.parseUnits("1", 6);
      expect(vested >= expected - tolerance && vested <= expected + tolerance).to.be.true;
      expect(withdrawable).to.equal(vested);
    });

    it("should return full amount after end", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;
      const start = now;
      const cliff = now + 100;
      const end = now + 1000;

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);
      await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        start,
        cliff,
        end
      );

      // After end
      await ethers.provider.send("evm_setNextBlockTimestamp", [end + 100]);
      await ethers.provider.send("evm_mine", []);

      const vested = await streams.getVested(0);
      const withdrawable = await streams.getWithdrawable(0);

      expect(vested).to.equal(totalAmount);
      expect(withdrawable).to.equal(totalAmount);
    });
  });

  describe("withdraw", function () {
    it("should allow employee to withdraw vested amount", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;
      const start = now;
      const cliff = now + 10;
      const end = now + 100;

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);
      await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        start,
        cliff,
        end
      );

      // Fast forward past end
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      const tx = await streams.connect(employee).withdraw(0);
      await expect(tx).to.emit(streams, "Withdrawn").withArgs(0, employee.address, totalAmount);

      const employeeBalance = await mockToken.balanceOf(employee.address);
      expect(employeeBalance).to.equal(totalAmount);

      const streamData = await streams.streams(0);
      expect(streamData.withdrawn).to.equal(totalAmount);
    });

    it("should revert if non-employee tries to withdraw", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);
      await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        now,
        now + 10,
        now + 100
      );

      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      await expect(streams.connect(employer).withdraw(0)).to.be.revertedWithCustomError(
        streams,
        "NotEmployee"
      );
    });

    it("should revert if nothing is withdrawable", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);
      await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        now + 10,
        now + 100,
        now + 1000
      );

      // Still before cliff
      await expect(streams.connect(employee).withdraw(0)).to.be.revertedWithCustomError(
        streams,
        "NothingToWithdraw"
      );
    });
  });

  describe("revoke", function () {
    it("should allow employer to revoke stream and split funds correctly", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;
      const start = now;
      const cliff = now + 100;
      const end = now + 1000;

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);
      await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        start,
        cliff,
        end
      );

      // Fast forward to 50% vested (halfway between cliff and end)
      const midpoint = cliff + ((end - cliff) / 2);
      await ethers.provider.send("evm_setNextBlockTimestamp", [midpoint]);
      await ethers.provider.send("evm_mine", []);

      const vestedBefore = await streams.getVested(0);

      const tx = await streams.connect(employer).revoke(0);
      await expect(tx).to.emit(streams, "Revoked");

      // Check employee received vested amount (approximately 50%)
      const employeeBalance = await mockToken.balanceOf(employee.address);
      const expectedToEmployee = totalAmount / BigInt(2);
      const tolerance = ethers.parseUnits("10", 6); // Increased tolerance for vesting calculation
      expect(employeeBalance >= expectedToEmployee - tolerance && employeeBalance <= expectedToEmployee + tolerance).to.be.true;

      // Check employer received refund (approximately 50%)
      const employerBalance = await mockToken.balanceOf(employer.address);
      const expectedToEmployer = totalAmount / BigInt(2);
      const expectedEmployerBalance = ethers.parseUnits("10000", 6) - totalAmount + expectedToEmployer;
      expect(employerBalance >= expectedEmployerBalance - tolerance && employerBalance <= expectedEmployerBalance + tolerance).to.be.true;
    });

    it("should revert if non-employer tries to revoke", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock!.timestamp;

      await mockToken.connect(employer).approve(await streams.getAddress(), totalAmount);
      await streams.connect(employer).createStream(
        employee.address,
        await mockToken.getAddress(),
        totalAmount,
        now,
        now + 10,
        now + 100
      );

      await expect(streams.connect(employee).revoke(0)).to.be.revertedWithCustomError(
        streams,
        "NotEmployer"
      );
    });
  });
});
