import { ethers } from "ethers";
import { logger } from "../config/logger";
import { EscrowStore, EscrowRecord, EscrowStatusValue } from "../stores/escrowStore";
import { StreamStore, StreamRecord } from "../stores/streamStore";
import EscrowABI from "../abis/ArcFlowEscrow.json";
import StreamsABI from "../abis/ArcFlowStreams.json";

const DECIMALS = 6;

function fmt(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const frac  = (raw % 1_000_000n).toString().padStart(DECIMALS, "0");
  return `${whole}.${frac}`;
}

/**
 * EscrowStreamWorker
 *
 * Connects to Arc Testnet and listens for escrow and stream lifecycle events,
 * maintaining an in-memory index (EscrowStore + StreamStore) so that
 * GET /escrows/:id and GET /streams/:id can serve any ID without a
 * per-request on-chain RPC call.
 *
 * Falls back to direct contract reads for IDs not yet in the store
 * (e.g. IDs created before the backend started, beyond the 1000-block replay).
 *
 * Startup:
 *   - Replays last 1000 blocks for EscrowCreated and StreamCreated events.
 *   - Subscribes to all six live event types.
 *
 * This worker is OPTIONAL — the server starts fine without it and falls back
 * to direct RPC reads. It only starts if ARC_ESCROW_ADDRESS and
 * ARC_STREAMS_ADDRESS are both set.
 */
export class EscrowStreamWorker {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly escrowContract: ethers.Contract;
  private readonly streamsContract: ethers.Contract;
  readonly escrowStore: EscrowStore;
  readonly streamStore: StreamStore;

  constructor(
    rpcUrl: string,
    chainId: number,
    escrowAddress: string,
    streamsAddress: string
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId,
      name: "arc-testnet",
    });
    this.escrowContract  = new ethers.Contract(escrowAddress,  EscrowABI,  this.provider);
    this.streamsContract = new ethers.Contract(streamsAddress, StreamsABI, this.provider);
    this.escrowStore  = new EscrowStore();
    this.streamStore  = new StreamStore();

    logger.info("EscrowStreamWorker: initialized", { escrowAddress, streamsAddress });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    const network = await this.provider.getNetwork();
    logger.info("EscrowStreamWorker: connected", { chainId: network.chainId.toString() });

    await this.replayHistory();
    this.subscribeEscrowEvents();
    this.subscribeStreamEvents();

    logger.info("EscrowStreamWorker: live — listening for new events");
  }

  async stop(): Promise<void> {
    this.escrowContract.removeAllListeners();
    this.streamsContract.removeAllListeners();
    await this.provider.destroy();
    logger.info("EscrowStreamWorker: stopped");
  }

  /**
   * Fetch escrow data directly from chain (bypasses the store).
   * Used as a fallback for IDs not yet indexed by the worker.
   */
  async fetchEscrowFromChain(id: string): Promise<EscrowRecord | null> {
    try {
      const data = await this.escrowContract.escrows(BigInt(id)) as [
        string, string, string, bigint, bigint, string, boolean, boolean, boolean
      ];
      const [payer, payee, token, amount, expiry, arbitrator, disputed, released, refunded] = data;
      if (payer === ethers.ZeroAddress) return null; // escrow does not exist
      const status = deriveEscrowStatus(disputed, released, refunded);
      const record: EscrowRecord = {
        id, payer, payee, token,
        amount: fmt(amount),
        expiry: Number(expiry),
        arbitrator, status,
        updatedAt: new Date(),
      };
      this.escrowStore.set(id, record); // cache result
      return record;
    } catch (err) {
      logger.warn("EscrowStreamWorker: fetchEscrowFromChain failed", { id, err });
      return null;
    }
  }

  /**
   * Fetch stream data directly from chain (bypasses the store).
   * Used as a fallback for IDs not yet indexed.
   */
  async fetchStreamFromChain(id: string): Promise<StreamRecord | null> {
    try {
      const data = await this.streamsContract.streams(BigInt(id)) as [
        string, string, string, bigint, bigint, bigint, bigint, bigint
      ];
      const [employer, employee, token, totalAmount, start, cliff, end, withdrawn] = data;
      if (employer === ethers.ZeroAddress) return null; // stream does not exist
      const record: StreamRecord = {
        id, employer, employee, token,
        totalAmount: fmt(totalAmount),
        start: Number(start),
        cliff: Number(cliff),
        end:   Number(end),
        withdrawn: fmt(withdrawn),
        revoked: false, // will be updated by Revoked event if applicable
        updatedAt: new Date(),
      };
      this.streamStore.set(id, record); // cache result
      return record;
    } catch (err) {
      logger.warn("EscrowStreamWorker: fetchStreamFromChain failed", { id, err });
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // History replay
  // ---------------------------------------------------------------------------

  private async replayHistory(): Promise<void> {
    const current = await this.provider.getBlockNumber();
    const from    = Math.max(0, current - 1000);
    logger.info("EscrowStreamWorker: replaying history", { from, to: current });

    // Replay EscrowCreated
    const escrowEvents = await this.escrowContract.queryFilter(
      this.escrowContract.filters.EscrowCreated(), from, current
    );
    for (const ev of escrowEvents) {
      if (ev instanceof ethers.EventLog) {
        await this.handleEscrowCreated(ev);
      }
    }

    // Replay status-change events (order matters — apply after creates)
    for (const [filterName, handler] of [
      ["EscrowDisputed", (ev: ethers.EventLog) => this.handleEscrowDisputed(ev)],
      ["EscrowReleased", (ev: ethers.EventLog) => this.handleEscrowReleased(ev)],
      ["EscrowRefunded", (ev: ethers.EventLog) => this.handleEscrowRefunded(ev)],
      ["EscrowResolved", (ev: ethers.EventLog) => this.handleEscrowResolved(ev)],
    ] as [string, (ev: ethers.EventLog) => Promise<void>][]) {
      const evs = await this.escrowContract.queryFilter(
        this.escrowContract.filters[filterName](), from, current
      );
      for (const ev of evs) {
        if (ev instanceof ethers.EventLog) await handler(ev);
      }
    }

    // Replay StreamCreated
    const streamEvents = await this.streamsContract.queryFilter(
      this.streamsContract.filters.StreamCreated(), from, current
    );
    for (const ev of streamEvents) {
      if (ev instanceof ethers.EventLog) {
        await this.handleStreamCreated(ev);
      }
    }

    // Replay Withdrawn + Revoked
    for (const [filterName, handler] of [
      ["Withdrawn", (ev: ethers.EventLog) => this.handleWithdrawn(ev)],
      ["Revoked",   (ev: ethers.EventLog) => this.handleRevoked(ev)],
    ] as [string, (ev: ethers.EventLog) => Promise<void>][]) {
      const evs = await this.streamsContract.queryFilter(
        this.streamsContract.filters[filterName](), from, current
      );
      for (const ev of evs) {
        if (ev instanceof ethers.EventLog) await handler(ev);
      }
    }

    logger.info("EscrowStreamWorker: history replay done", {
      escrows: this.escrowStore.size(),
      streams: this.streamStore.size(),
    });
  }

  // ---------------------------------------------------------------------------
  // Live subscriptions
  // ---------------------------------------------------------------------------

  private subscribeEscrowEvents(): void {
    this.escrowContract.on("EscrowCreated",  (_id, _p, _py, _t, _a, _e, _ar, ev: ethers.EventLog) => {
      this.handleEscrowCreated(ev).catch((e) =>
        logger.error("EscrowStreamWorker: EscrowCreated error", { e })
      );
    });
    this.escrowContract.on("EscrowDisputed",  (_id, ev: ethers.EventLog) => this.handleEscrowDisputed(ev));
    this.escrowContract.on("EscrowReleased",  (_id, ev: ethers.EventLog) => this.handleEscrowReleased(ev));
    this.escrowContract.on("EscrowRefunded",  (_id, ev: ethers.EventLog) => this.handleEscrowRefunded(ev));
    this.escrowContract.on("EscrowResolved",  (_id, _rel, ev: ethers.EventLog) => this.handleEscrowResolved(ev));
  }

  private subscribeStreamEvents(): void {
    this.streamsContract.on("StreamCreated", (_id, _emp, _ee, _t, _tot, _s, _c, _e, ev: ethers.EventLog) => {
      this.handleStreamCreated(ev).catch((e) =>
        logger.error("EscrowStreamWorker: StreamCreated error", { e })
      );
    });
    this.streamsContract.on("Withdrawn", (_id, _ee, _amt, ev: ethers.EventLog) => this.handleWithdrawn(ev));
    this.streamsContract.on("Revoked",   (_id, _toe, _ref, ev: ethers.EventLog) => this.handleRevoked(ev));
  }

  // ---------------------------------------------------------------------------
  // Event handlers — Escrow
  // ---------------------------------------------------------------------------

  private async handleEscrowCreated(ev: ethers.EventLog): Promise<void> {
    const { id, payer, payee, token, amount, expiry, arbitrator } = ev.args as unknown as {
      id: bigint; payer: string; payee: string; token: string;
      amount: bigint; expiry: bigint; arbitrator: string;
    };
    const idStr = id.toString();
    const record: EscrowRecord = {
      id: idStr, payer, payee, token,
      amount: fmt(amount),
      expiry: Number(expiry),
      arbitrator,
      status: "OPEN",
      updatedAt: new Date(),
    };
    this.escrowStore.set(idStr, record);
    logger.info("EscrowStreamWorker: indexed EscrowCreated", { id: idStr, amount: record.amount });
  }

  private async handleEscrowDisputed(ev: ethers.EventLog): Promise<void> {
    const id = (ev.args as unknown as { id: bigint }).id.toString();
    if (!this.escrowStore.setStatus(id, "DISPUTED")) {
      // Not in store yet — fetch from chain to populate it
      await this.fetchEscrowFromChain(id);
      this.escrowStore.setStatus(id, "DISPUTED");
    }
    logger.info("EscrowStreamWorker: DISPUTED", { id });
  }

  private async handleEscrowReleased(ev: ethers.EventLog): Promise<void> {
    const id = (ev.args as unknown as { id: bigint }).id.toString();
    if (!this.escrowStore.setStatus(id, "RELEASED")) {
      await this.fetchEscrowFromChain(id);
      this.escrowStore.setStatus(id, "RELEASED");
    }
    logger.info("EscrowStreamWorker: RELEASED", { id });
  }

  private async handleEscrowRefunded(ev: ethers.EventLog): Promise<void> {
    const id = (ev.args as unknown as { id: bigint }).id.toString();
    if (!this.escrowStore.setStatus(id, "REFUNDED")) {
      await this.fetchEscrowFromChain(id);
      this.escrowStore.setStatus(id, "REFUNDED");
    }
    logger.info("EscrowStreamWorker: REFUNDED", { id });
  }

  private async handleEscrowResolved(ev: ethers.EventLog): Promise<void> {
    const { id, releaseToPayee } = ev.args as unknown as { id: bigint; releaseToPayee: boolean };
    const idStr = id.toString();
    const status: EscrowStatusValue = releaseToPayee ? "RELEASED" : "REFUNDED";
    if (!this.escrowStore.setStatus(idStr, status)) {
      await this.fetchEscrowFromChain(idStr);
      this.escrowStore.setStatus(idStr, status);
    }
    logger.info("EscrowStreamWorker: RESOLVED", { id: idStr, status });
  }

  // ---------------------------------------------------------------------------
  // Event handlers — Streams
  // ---------------------------------------------------------------------------

  private async handleStreamCreated(ev: ethers.EventLog): Promise<void> {
    const { id, employer, employee, token, totalAmount, start, cliff, end } = ev.args as unknown as {
      id: bigint; employer: string; employee: string; token: string;
      totalAmount: bigint; start: bigint; cliff: bigint; end: bigint;
    };
    const idStr = id.toString();
    const record: StreamRecord = {
      id: idStr, employer, employee, token,
      totalAmount: fmt(totalAmount),
      start: Number(start),
      cliff: Number(cliff),
      end:   Number(end),
      withdrawn: "0.000000",
      revoked: false,
      updatedAt: new Date(),
    };
    this.streamStore.set(idStr, record);
    logger.info("EscrowStreamWorker: indexed StreamCreated", { id: idStr, total: record.totalAmount });
  }

  private async handleWithdrawn(ev: ethers.EventLog): Promise<void> {
    const { id, amount } = ev.args as unknown as { id: bigint; employee: string; amount: bigint };
    const idStr = id.toString();
    if (!this.streamStore.addWithdrawn(idStr, fmt(amount))) {
      await this.fetchStreamFromChain(idStr); // populate store first
      this.streamStore.addWithdrawn(idStr, fmt(amount));
    }
    logger.info("EscrowStreamWorker: Withdrawn", { id: idStr, amount: fmt(amount) });
  }

  private async handleRevoked(ev: ethers.EventLog): Promise<void> {
    const id = (ev.args as unknown as { id: bigint }).id.toString();
    if (!this.streamStore.markRevoked(id)) {
      await this.fetchStreamFromChain(id);
      this.streamStore.markRevoked(id);
    }
    logger.info("EscrowStreamWorker: Revoked", { id });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveEscrowStatus(
  disputed: boolean,
  released: boolean,
  refunded: boolean
): EscrowStatusValue {
  if (released) return "RELEASED";
  if (refunded) return "REFUNDED";
  if (disputed) return "DISPUTED";
  return "OPEN";
}
