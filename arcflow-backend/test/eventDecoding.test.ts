import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import PayoutRouterABI from "../src/abis/ArcFlowPayoutRouter.json";

describe("PayoutInstruction Event Decoding", () => {
  it("should correctly decode PayoutInstruction event", () => {
    // Create contract interface
    const iface = new ethers.Interface(PayoutRouterABI);

    // Sample event data (this would come from an actual transaction)
    const batchId = 1n;
    const index = 0n;
    const recipient = "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4"; // Valid checksummed address
    const amount = ethers.parseUnits("100", 6); // 100 USDC
    const destinationChain = ethers.encodeBytes32String("BASE");

    // Encode the event
    const encoded = iface.encodeEventLog("PayoutInstruction", [
      batchId,
      index,
      recipient,
      amount,
      destinationChain,
    ]);

    // Decode the event
    const decoded = iface.decodeEventLog("PayoutInstruction", encoded.data, encoded.topics);

    expect(decoded.batchId).toBe(batchId);
    expect(decoded.index).toBe(index);
    expect(decoded.recipient).toBe(recipient);
    expect(decoded.amount).toBe(amount);
    expect(decoded.destinationChain).toBe(destinationChain);
  });

  it("should decode bytes32 chain identifiers correctly", () => {
    const chains = ["ARC", "BASE", "POLYGON", "OPTIMISM", "ARBITRUM"];

    for (const chain of chains) {
      const encoded = ethers.encodeBytes32String(chain);
      const decoded = ethers.decodeBytes32String(encoded);

      expect(decoded).toBe(chain);
    }
  });

  it("should handle amount formatting correctly", () => {
    const amounts = [
      { input: "1", decimals: 6, expected: 1000000n },
      { input: "100.5", decimals: 6, expected: 100500000n },
      { input: "1000000", decimals: 6, expected: 1000000000000n },
    ];

    for (const { input, decimals, expected } of amounts) {
      const parsed = ethers.parseUnits(input, decimals);
      expect(parsed).toBe(expected);

      const formatted = ethers.formatUnits(parsed, decimals);
      expect(parseFloat(formatted)).toBeCloseTo(parseFloat(input), 6);
    }
  });

  it("should validate event signature", () => {
    const iface = new ethers.Interface(PayoutRouterABI);

    // Get the event fragment
    const eventFragment = iface.getEvent("PayoutInstruction");

    expect(eventFragment).toBeDefined();
    expect(eventFragment?.name).toBe("PayoutInstruction");

    // Verify indexed parameters
    const indexedParams = eventFragment?.inputs.filter((input) => input.indexed);
    expect(indexedParams?.length).toBe(2); // batchId and index should be indexed
  });
});
