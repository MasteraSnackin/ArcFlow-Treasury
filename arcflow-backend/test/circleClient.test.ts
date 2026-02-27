import { describe, it, expect } from "vitest";
import { circleClient } from "../src/services/circleClient";

describe("CircleClient", () => {
  // ---------------------------------------------------------------------------
  // createTransfer
  // ---------------------------------------------------------------------------
  describe("createTransfer", () => {
    it("should return a transfer response with pending status", async () => {
      const request = {
        idempotencyKey: "test_key_123",
        amount: {
          amount: "100.50",
          currency: "USDC" as const,
        },
        destination: {
          type: "blockchain" as const,
          address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          chain: "ARC-TESTNET" as const,
        },
        destinationDomain: 5, // ARC-TESTNET CCTP domain ID
      };

      const response = await circleClient.createTransfer(request);

      expect(response).toBeDefined();
      expect(response.id).toContain("circle_transfer_");
      expect(response.status).toBe("pending");
      expect(response.amount).toEqual(request.amount);
      expect(response.destination).toEqual(request.destination);
      expect(response.createDate).toBeDefined();
    });

    it("should handle EURC currency on a cross-chain destination", async () => {
      const request = {
        idempotencyKey: "test_key_456",
        amount: {
          amount: "250.75",
          currency: "EURC" as const,
        },
        destination: {
          type: "blockchain" as const,
          address: "0x123",
          chain: "BASE-SEPOLIA" as const,
        },
        destinationDomain: 6, // BASE-SEPOLIA CCTP domain ID
      };

      const response = await circleClient.createTransfer(request);

      expect(response.amount.currency).toBe("EURC");
      expect(response.destination.chain).toBe("BASE-SEPOLIA");
    });
  });

  // ---------------------------------------------------------------------------
  // getTransferStatus
  // ---------------------------------------------------------------------------
  describe("getTransferStatus", () => {
    it("should retrieve transfer status", async () => {
      const transferId = "circle_transfer_test_123";

      const response = await circleClient.getTransferStatus(transferId);

      expect(response).toBeDefined();
      expect(response.id).toBe(transferId);
      expect(response.status).toMatch(/^(pending|complete)$/);
    });
  });

  // ---------------------------------------------------------------------------
  // mapChainIdentifier
  // Verifies Circle's exact chain names are returned, matching
  // arc-multichain-wallet naming convention (not legacy short-form names).
  // ---------------------------------------------------------------------------
  describe("mapChainIdentifier", () => {
    it("should map ARC to ARC-TESTNET (not ETH)", () => {
      expect(circleClient.mapChainIdentifier("ARC")).toBe("ARC-TESTNET");
    });

    it("should map BASE to BASE-SEPOLIA (not BASE)", () => {
      expect(circleClient.mapChainIdentifier("BASE")).toBe("BASE-SEPOLIA");
    });

    it("should map AVAX to AVAX-FUJI", () => {
      expect(circleClient.mapChainIdentifier("AVAX")).toBe("AVAX-FUJI");
    });

    it("should map AVALANCHE to AVAX-FUJI", () => {
      expect(circleClient.mapChainIdentifier("AVALANCHE")).toBe("AVAX-FUJI");
    });

    it("should map ETH to ETH-SEPOLIA", () => {
      expect(circleClient.mapChainIdentifier("ETH")).toBe("ETH-SEPOLIA");
    });

    it("should map ARBITRUM to ARB-SEPOLIA", () => {
      expect(circleClient.mapChainIdentifier("ARBITRUM")).toBe("ARB-SEPOLIA");
    });

    it("should default unknown chains to ARC-TESTNET (not ETH)", () => {
      expect(circleClient.mapChainIdentifier("UNKNOWN_CHAIN")).toBe(
        "ARC-TESTNET"
      );
    });

    it("should strip null bytes from bytes32 strings", () => {
      const bytes32WithNulls = "ARC\0\0\0\0\0\0\0\0\0\0";
      expect(circleClient.mapChainIdentifier(bytes32WithNulls)).toBe(
        "ARC-TESTNET"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getDomainId
  // ---------------------------------------------------------------------------
  describe("getDomainId", () => {
    it("should return domain ID 5 for ARC-TESTNET", () => {
      expect(circleClient.getDomainId("ARC-TESTNET")).toBe(5);
    });

    it("should return domain ID 6 for BASE-SEPOLIA", () => {
      expect(circleClient.getDomainId("BASE-SEPOLIA")).toBe(6);
    });

    it("should return domain ID 1 for AVAX-FUJI", () => {
      expect(circleClient.getDomainId("AVAX-FUJI")).toBe(1);
    });

    it("should return domain ID 0 for ETH-SEPOLIA", () => {
      expect(circleClient.getDomainId("ETH-SEPOLIA")).toBe(0);
    });
  });
});
