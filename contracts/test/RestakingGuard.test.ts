import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { RestakingGuard } from "../typechain-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const toId = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const ETH = (n: number) => ethers.parseEther(n.toString());
const BPS = 10_000n;

// Mirror the seed network from the frontend
const V = {
  V1: toId("V1"), V2: toId("V2"), V3: toId("V3"),
  V4: toId("V4"), V5: toId("V5"), V6: toId("V6"),
};
const A = {
  "AVS-A": toId("AVS-A"), "AVS-B": toId("AVS-B"), "AVS-C": toId("AVS-C"),
  "AVS-D": toId("AVS-D"), "AVS-E": toId("AVS-E"),
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("RestakingGuard", () => {
  let guard: RestakingGuard;
  let owner: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RestakingGuard");
    guard = (await Factory.deploy()) as RestakingGuard;
    await guard.waitForDeployment();
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", () => {
    it("sets the deployer as owner", async () => {
      expect(await guard.owner()).to.equal(owner.address);
    });

    it("initialises with zero totals", async () => {
      const [stake, slashed, score, vCount, aCount] =
        await guard.getNetworkSnapshot();
      expect(stake).to.equal(0n);
      expect(slashed).to.equal(0n);
      expect(score).to.equal(0n);
      expect(vCount).to.equal(0n);
      expect(aCount).to.equal(0n);
    });
  });

  // ── Validator Registration ──────────────────────────────────────────────────

  describe("Validator Registration", () => {
    it("registers a validator and updates total stake", async () => {
      await guard.registerValidator(V.V1, ETH(4800));

      const [totalStake, slashedStake, remaining, serviceCount, active] =
        await guard.getValidator(V.V1);

      expect(totalStake).to.equal(ETH(4800));
      expect(slashedStake).to.equal(0n);
      expect(remaining).to.equal(ETH(4800));
      expect(serviceCount).to.equal(0);
      expect(active).to.be.true;
      expect(await guard.totalNetworkStake()).to.equal(ETH(4800));
    });

    it("emits ValidatorRegistered event", async () => {
      await expect(guard.registerValidator(V.V1, ETH(4800)))
        .to.emit(guard, "ValidatorRegistered")
        .withArgs(V.V1, ETH(4800));
    });

    it("reverts on duplicate registration", async () => {
      await guard.registerValidator(V.V1, ETH(4800));
      await expect(guard.registerValidator(V.V1, ETH(4800)))
        .to.be.revertedWithCustomError(guard, "ValidatorAlreadyRegistered");
    });

    it("reverts on zero stake", async () => {
      await expect(guard.registerValidator(V.V1, 0n))
        .to.be.revertedWithCustomError(guard, "ZeroStake");
    });

    it("reverts for non-owner", async () => {
      await expect(
        guard.connect(stranger).registerValidator(V.V1, ETH(4800))
      ).to.be.revertedWithCustomError(guard, "Unauthorized");
    });
  });

  // ── AVS Registration ───────────────────────────────────────────────────────

  describe("AVS Registration", () => {
    it("registers an AVS", async () => {
      await guard.registerAVS(A["AVS-A"], "EigenDA", ETH(8500));

      const [name, tvl, vCount, byzantine, cascadeRisk, active] =
        await guard.getAVS(A["AVS-A"]);

      expect(name).to.equal("EigenDA");
      expect(tvl).to.equal(ETH(8500));
      expect(vCount).to.equal(0n);
      expect(byzantine).to.be.false;
      expect(cascadeRisk).to.be.false;
      expect(active).to.be.true;
      expect(await guard.avsCount()).to.equal(1n);
    });

    it("emits AVSRegistered event", async () => {
      await expect(guard.registerAVS(A["AVS-A"], "EigenDA", ETH(8500)))
        .to.emit(guard, "AVSRegistered")
        .withArgs(A["AVS-A"], "EigenDA", ETH(8500));
    });

    it("reverts on duplicate AVS", async () => {
      await guard.registerAVS(A["AVS-A"], "EigenDA", ETH(8500));
      await expect(guard.registerAVS(A["AVS-A"], "EigenDA", ETH(8500)))
        .to.be.revertedWithCustomError(guard, "AVSAlreadyRegistered");
    });
  });

  // ── Allocation ─────────────────────────────────────────────────────────────

  describe("Validator Allocation", () => {
    beforeEach(async () => {
      await guard.registerValidator(V.V1, ETH(4800));
      await guard.registerAVS(A["AVS-A"], "EigenDA", ETH(8500));
      await guard.registerAVS(A["AVS-B"], "Lagrange", ETH(6200));
    });

    it("allocates a validator to an AVS", async () => {
      await guard.allocateValidator(V.V1, A["AVS-A"]);

      expect(await guard.isAllocated(V.V1, A["AVS-A"])).to.be.true;

      const services = await guard.getValidatorServices(V.V1);
      expect(services).to.include(A["AVS-A"]);

      const validators = await guard.getAVSValidators(A["AVS-A"]);
      expect(validators).to.include(V.V1);
    });

    it("emits ValidatorAllocated event", async () => {
      await expect(guard.allocateValidator(V.V1, A["AVS-A"]))
        .to.emit(guard, "ValidatorAllocated")
        .withArgs(V.V1, A["AVS-A"]);
    });

    it("allows allocation to multiple AVSs", async () => {
      await guard.allocateValidator(V.V1, A["AVS-A"]);
      await guard.allocateValidator(V.V1, A["AVS-B"]);

      const services = await guard.getValidatorServices(V.V1);
      expect(services.length).to.equal(2);
    });

    it("reverts on duplicate allocation", async () => {
      await guard.allocateValidator(V.V1, A["AVS-A"]);
      await expect(guard.allocateValidator(V.V1, A["AVS-A"]))
        .to.be.revertedWithCustomError(guard, "AlreadyAllocated");
    });

    it("deallocates a validator from an AVS", async () => {
      await guard.allocateValidator(V.V1, A["AVS-A"]);
      await guard.deallocateValidator(V.V1, A["AVS-A"]);

      expect(await guard.isAllocated(V.V1, A["AVS-A"])).to.be.false;
      const services = await guard.getValidatorServices(V.V1);
      expect(services).to.not.include(A["AVS-A"]);
    });

    it("emits ValidatorDeallocated event", async () => {
      await guard.allocateValidator(V.V1, A["AVS-A"]);
      await expect(guard.deallocateValidator(V.V1, A["AVS-A"]))
        .to.emit(guard, "ValidatorDeallocated")
        .withArgs(V.V1, A["AVS-A"]);
    });

    it("reverts deallocate when not allocated", async () => {
      await expect(guard.deallocateValidator(V.V1, A["AVS-A"]))
        .to.be.revertedWithCustomError(guard, "NotAllocated");
    });
  });

  // ── Byzantine Detection ────────────────────────────────────────────────────

  describe("Byzantine Detection", () => {
    beforeEach(async () => {
      await guard.registerAVS(A["AVS-A"], "EigenDA", ETH(8500));
    });

    it("flags an AVS as Byzantine", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      const [,,,byzantine] = await guard.getAVS(A["AVS-A"]);
      expect(byzantine).to.be.true;
    });

    it("emits AVSFlaggedByzantine event", async () => {
      await expect(guard.reportByzantine(A["AVS-A"]))
        .to.emit(guard, "AVSFlaggedByzantine")
        .withArgs(A["AVS-A"], owner.address, await ethers.provider.getBlockNumber().then(async (n) => {
          const block = await ethers.provider.getBlock(n);
          return block!.timestamp + 1; // next block
        }));
    });

    it("reverts on double-flagging", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      await expect(guard.reportByzantine(A["AVS-A"]))
        .to.be.revertedWithCustomError(guard, "AVSAlreadyByzantine");
    });

    it("reverts for unknown AVS", async () => {
      await expect(guard.reportByzantine(toId("UNKNOWN")))
        .to.be.revertedWithCustomError(guard, "AVSNotFound");
    });
  });

  // ── Slashing ───────────────────────────────────────────────────────────────

  describe("Slashing", () => {
    beforeEach(async () => {
      // Register the full seed network
      await guard.registerValidator(V.V1, ETH(4800));
      await guard.registerValidator(V.V2, ETH(3200));
      await guard.registerValidator(V.V3, ETH(2900));
      await guard.registerValidator(V.V4, ETH(1800));
      await guard.registerValidator(V.V5, ETH(3600));
      await guard.registerValidator(V.V6, ETH(1400));

      await guard.registerAVS(A["AVS-A"], "EigenDA",      ETH(8500));
      await guard.registerAVS(A["AVS-B"], "Lagrange",     ETH(6200));
      await guard.registerAVS(A["AVS-C"], "Omni Network", ETH(5100));
      await guard.registerAVS(A["AVS-D"], "AltLayer",     ETH(4300));
      await guard.registerAVS(A["AVS-E"], "Witness Chain", ETH(3900));

      // V1 → AVS-A, AVS-B, AVS-C
      await guard.allocateValidator(V.V1, A["AVS-A"]);
      await guard.allocateValidator(V.V1, A["AVS-B"]);
      await guard.allocateValidator(V.V1, A["AVS-C"]);
      // V2 → AVS-A, AVS-D
      await guard.allocateValidator(V.V2, A["AVS-A"]);
      await guard.allocateValidator(V.V2, A["AVS-D"]);
      // V3 → AVS-B, AVS-C
      await guard.allocateValidator(V.V3, A["AVS-B"]);
      await guard.allocateValidator(V.V3, A["AVS-C"]);
      // V4 → AVS-C, AVS-D
      await guard.allocateValidator(V.V4, A["AVS-C"]);
      await guard.allocateValidator(V.V4, A["AVS-D"]);
      // V5 → AVS-A, AVS-B, AVS-D, AVS-E
      await guard.allocateValidator(V.V5, A["AVS-A"]);
      await guard.allocateValidator(V.V5, A["AVS-B"]);
      await guard.allocateValidator(V.V5, A["AVS-D"]);
      await guard.allocateValidator(V.V5, A["AVS-E"]);
      // V6 → AVS-E only
      await guard.allocateValidator(V.V6, A["AVS-E"]);
    });

    it("reverts slash if AVS not flagged Byzantine first", async () => {
      await expect(guard.executeSlashing(A["AVS-A"], 3000n))
        .to.be.revertedWithCustomError(guard, "AVSNotFound");
    });

    it("reverts slash above MAX_SLASH_BPS (50%)", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      await expect(guard.executeSlashing(A["AVS-A"], 6000n))
        .to.be.revertedWithCustomError(guard, "SlashExceedsMax");
    });

    it("slashes all validators allocated to Byzantine AVS", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      await guard.executeSlashing(A["AVS-A"], 3000n); // 30%

      // V1, V2, V5 are in AVS-A
      const [, slashedV1] = await guard.getValidator(V.V1);
      const [, slashedV2] = await guard.getValidator(V.V2);
      const [, slashedV5] = await guard.getValidator(V.V5);
      const [, slashedV3] = await guard.getValidator(V.V3); // not in AVS-A

      expect(slashedV1).to.equal((ETH(4800) * 3000n) / BPS);
      expect(slashedV2).to.equal((ETH(3200) * 3000n) / BPS);
      expect(slashedV5).to.equal((ETH(3600) * 3000n) / BPS);
      expect(slashedV3).to.equal(0n); // untouched
    });

    it("emits ValidatorSlashed for each affected validator", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      const tx = await guard.executeSlashing(A["AVS-A"], 3000n);
      const receipt = await tx.wait();

      const slashEvents = receipt!.logs
        .map((log) => {
          try { return guard.interface.parseLog(log as any); } catch { return null; }
        })
        .filter((e) => e?.name === "ValidatorSlashed");

      // V1, V2, V5 should be slashed
      expect(slashEvents.length).to.equal(3);
    });

    it("updates totalSlashedStake correctly", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      await guard.executeSlashing(A["AVS-A"], 3000n);

      const expectedSlash =
        (ETH(4800) + ETH(3200) + ETH(3600)) * 3000n / BPS;
      expect(await guard.totalSlashedStake()).to.equal(expectedSlash);
    });

    it("emits CascadeRiskDetected for secondary services above threshold", async () => {
      // AVS-A attack: V1, V2, V5 slashed
      // AVS-B has V1, V3, V5 — 2 of 3 slashed = 66% > 50% threshold → cascade
      await guard.reportByzantine(A["AVS-A"]);
      const tx = await guard.executeSlashing(A["AVS-A"], 3000n);

      await expect(tx)
        .to.emit(guard, "CascadeRiskDetected");
    });

    it("does NOT emit cascade for low-connectivity attack (AVS-E)", async () => {
      // AVS-E has only V5, V6
      // V5 is in AVS-E and other services — slashing AVS-E only hits V5 and V6
      // Other services: AVS-A has V1,V2,V5 — only V5 slashed = 1/3 = 33% < 50%
      await guard.reportByzantine(A["AVS-E"]);
      const tx = await guard.executeSlashing(A["AVS-E"], 3000n);
      const receipt = await tx.wait();

      const cascadeEvents = receipt!.logs
        .map((log) => {
          try { return guard.interface.parseLog(log as any); } catch { return null; }
        })
        .filter((e) => e?.name === "CascadeRiskDetected");

      expect(cascadeEvents.length).to.equal(0);
    });

    it("updates network risk score after slashing", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      await guard.executeSlashing(A["AVS-A"], 3000n);

      const score = await guard.getNetworkRiskScore();
      expect(score).to.be.gt(0n);
      expect(score).to.be.lte(99n);
    });

    it("emits RiskScoreUpdated after slashing", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      await expect(guard.executeSlashing(A["AVS-A"], 3000n))
        .to.emit(guard, "RiskScoreUpdated");
    });
  });

  // ── Cascade Risk View ──────────────────────────────────────────────────────

  describe("getCascadeRisk", () => {
    beforeEach(async () => {
      await guard.registerValidator(V.V1, ETH(4800));
      await guard.registerValidator(V.V2, ETH(3200));
      await guard.registerValidator(V.V5, ETH(3600));

      await guard.registerAVS(A["AVS-A"], "EigenDA",  ETH(8500));
      await guard.registerAVS(A["AVS-B"], "Lagrange", ETH(6200));

      await guard.allocateValidator(V.V1, A["AVS-A"]);
      await guard.allocateValidator(V.V2, A["AVS-A"]);
      await guard.allocateValidator(V.V5, A["AVS-A"]);

      await guard.allocateValidator(V.V1, A["AVS-B"]);
      await guard.allocateValidator(V.V5, A["AVS-B"]);
    });

    it("returns 0 cascade risk before any slashing", async () => {
      expect(await guard.getCascadeRisk(A["AVS-B"])).to.equal(0n);
    });

    it("returns correct cascade risk after slashing", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      await guard.executeSlashing(A["AVS-A"], 3000n);

      // AVS-B has V1 and V5 — both slashed → 2/2 = 100% = 10000 BPS
      const riskBps = await guard.getCascadeRisk(A["AVS-B"]);
      expect(riskBps).to.equal(BPS); // 10000 = 100%
    });
  });

  // ── Access Control ─────────────────────────────────────────────────────────

  describe("Access Control", () => {
    it("blocks all mutations from non-owner", async () => {
      const g = guard.connect(stranger);
      const id = toId("test");

      await expect(g.registerValidator(id, ETH(1))).to.be.revertedWithCustomError(guard, "Unauthorized");
      await expect(g.registerAVS(id, "test", ETH(1))).to.be.revertedWithCustomError(guard, "Unauthorized");
      await expect(g.reportByzantine(id)).to.be.revertedWithCustomError(guard, "Unauthorized");
    });

    it("transfers ownership correctly", async () => {
      await guard.transferOwnership(stranger.address);
      expect(await guard.owner()).to.equal(stranger.address);

      // New owner can register
      await expect(
        guard.connect(stranger).registerValidator(V.V1, ETH(1000))
      ).to.not.be.reverted;

      // Old owner cannot
      await expect(
        guard.registerValidator(V.V2, ETH(1000))
      ).to.be.revertedWithCustomError(guard, "Unauthorized");
    });
  });

  // ── Full Network Simulation (mirrors frontend) ─────────────────────────────

  describe("Full Network Simulation — mirrors frontend", () => {
    beforeEach(async () => {
      await guard.registerValidator(V.V1, ETH(4800));
      await guard.registerValidator(V.V2, ETH(3200));
      await guard.registerValidator(V.V3, ETH(2900));
      await guard.registerValidator(V.V4, ETH(1800));
      await guard.registerValidator(V.V5, ETH(3600));
      await guard.registerValidator(V.V6, ETH(1400));

      await guard.registerAVS(A["AVS-A"], "EigenDA",       ETH(8500));
      await guard.registerAVS(A["AVS-B"], "Lagrange",      ETH(6200));
      await guard.registerAVS(A["AVS-C"], "Omni Network",  ETH(5100));
      await guard.registerAVS(A["AVS-D"], "AltLayer",      ETH(4300));
      await guard.registerAVS(A["AVS-E"], "Witness Chain", ETH(3900));

      await guard.allocateValidator(V.V1, A["AVS-A"]);
      await guard.allocateValidator(V.V1, A["AVS-B"]);
      await guard.allocateValidator(V.V1, A["AVS-C"]);
      await guard.allocateValidator(V.V2, A["AVS-A"]);
      await guard.allocateValidator(V.V2, A["AVS-D"]);
      await guard.allocateValidator(V.V3, A["AVS-B"]);
      await guard.allocateValidator(V.V3, A["AVS-C"]);
      await guard.allocateValidator(V.V4, A["AVS-C"]);
      await guard.allocateValidator(V.V4, A["AVS-D"]);
      await guard.allocateValidator(V.V5, A["AVS-A"]);
      await guard.allocateValidator(V.V5, A["AVS-B"]);
      await guard.allocateValidator(V.V5, A["AVS-D"]);
      await guard.allocateValidator(V.V5, A["AVS-E"]);
      await guard.allocateValidator(V.V6, A["AVS-E"]);
    });

    it("high-connectivity attack (AVS-A) produces higher risk than low (AVS-E)", async () => {
      // Attack AVS-A — high connectivity
      await guard.reportByzantine(A["AVS-A"]);
      await guard.executeSlashing(A["AVS-A"], 3000n);
      const highRisk = await guard.getNetworkRiskScore();

      // Reset by deploying fresh
      const Factory = await ethers.getContractFactory("RestakingGuard");
      const fresh = await Factory.deploy();
      await fresh.waitForDeployment();

      await fresh.registerValidator(V.V1, ETH(4800));
      await fresh.registerValidator(V.V2, ETH(3200));
      await fresh.registerValidator(V.V3, ETH(2900));
      await fresh.registerValidator(V.V4, ETH(1800));
      await fresh.registerValidator(V.V5, ETH(3600));
      await fresh.registerValidator(V.V6, ETH(1400));
      await fresh.registerAVS(A["AVS-A"], "EigenDA",       ETH(8500));
      await fresh.registerAVS(A["AVS-B"], "Lagrange",      ETH(6200));
      await fresh.registerAVS(A["AVS-C"], "Omni Network",  ETH(5100));
      await fresh.registerAVS(A["AVS-D"], "AltLayer",      ETH(4300));
      await fresh.registerAVS(A["AVS-E"], "Witness Chain", ETH(3900));
      await fresh.allocateValidator(V.V1, A["AVS-A"]);
      await fresh.allocateValidator(V.V1, A["AVS-B"]);
      await fresh.allocateValidator(V.V1, A["AVS-C"]);
      await fresh.allocateValidator(V.V2, A["AVS-A"]);
      await fresh.allocateValidator(V.V2, A["AVS-D"]);
      await fresh.allocateValidator(V.V3, A["AVS-B"]);
      await fresh.allocateValidator(V.V3, A["AVS-C"]);
      await fresh.allocateValidator(V.V4, A["AVS-C"]);
      await fresh.allocateValidator(V.V4, A["AVS-D"]);
      await fresh.allocateValidator(V.V5, A["AVS-A"]);
      await fresh.allocateValidator(V.V5, A["AVS-B"]);
      await fresh.allocateValidator(V.V5, A["AVS-D"]);
      await fresh.allocateValidator(V.V5, A["AVS-E"]);
      await fresh.allocateValidator(V.V6, A["AVS-E"]);

      // Attack AVS-E — low connectivity
      await fresh.reportByzantine(A["AVS-E"]);
      await fresh.executeSlashing(A["AVS-E"], 3000n);
      const lowRisk = await fresh.getNetworkRiskScore();

      console.log(`    AVS-A (high-connectivity) risk score: ${highRisk}`);
      console.log(`    AVS-E (low-connectivity)  risk score: ${lowRisk}`);

      expect(highRisk).to.be.gt(lowRisk);
    });

    it("getNetworkSnapshot returns accurate totals", async () => {
      await guard.reportByzantine(A["AVS-A"]);
      await guard.executeSlashing(A["AVS-A"], 3000n);

      const [totalStake, totalSlashed, score, vCount, aCount] =
        await guard.getNetworkSnapshot();

      expect(totalStake).to.equal(ETH(4800 + 3200 + 2900 + 1800 + 3600 + 1400));
      expect(totalSlashed).to.be.gt(0n);
      expect(score).to.be.gt(0n);
      expect(vCount).to.equal(6n);
      expect(aCount).to.equal(5n);
    });
  });
});
