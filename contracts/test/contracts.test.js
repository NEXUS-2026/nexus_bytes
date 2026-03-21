const { expect }         = require("chai");
const { ethers }         = require("hardhat");
const { loadFixture }    = require("@nomicfoundation/hardhat-network-helpers");

// ─── Fixture ────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [owner, verifier, borrower, lender, stranger] = await ethers.getSigners();

  const ActivityRegistry = await ethers.getContractFactory("ActivityRegistry");
  const registry = await ActivityRegistry.deploy();

  const ImpactScore = await ethers.getContractFactory("ImpactScore");
  const impactScore = await ImpactScore.deploy();
  await impactScore.setActivityRegistry(await registry.getAddress());

  const LoanManager = await ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManager.deploy(await impactScore.getAddress());

  // Add test verifier
  await registry.addVerifier(verifier.address);
  await loanManager.addLender(lender.address);

  return { registry, impactScore, loanManager, owner, verifier, borrower, lender, stranger };
}

// ─── ActivityRegistry ────────────────────────────────────────────────────────

describe("ActivityRegistry", () => {
  it("owner is initial verifier", async () => {
    const { registry, owner } = await loadFixture(deployFixture);
    expect(await registry.verifiers(owner.address)).to.be.true;
  });

  it("stores an activity and emits event", async () => {
    const { registry, impactScore, verifier, borrower } = await loadFixture(deployFixture);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("activity-data-1"));

    await expect(
      registry.connect(verifier).storeActivity(borrower.address, hash, "health")
    )
      .to.emit(registry, "ActivityStored")
      .withArgs(1, borrower.address, hash, "health", verifier.address);
  });

  it("rejects duplicate hash", async () => {
    const { registry, verifier, borrower } = await loadFixture(deployFixture);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("dup"));
    await registry.connect(verifier).storeActivity(borrower.address, hash, "health");
    await expect(
      registry.connect(verifier).storeActivity(borrower.address, hash, "health")
    ).to.be.revertedWith("ActivityRegistry: duplicate hash");
  });

  it("non-verifier cannot store", async () => {
    const { registry, stranger, borrower } = await loadFixture(deployFixture);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("x"));
    await expect(
      registry.connect(stranger).storeActivity(borrower.address, hash, "health")
    ).to.be.revertedWith("ActivityRegistry: not a verifier");
  });
});

// ─── ImpactScore ─────────────────────────────────────────────────────────────

describe("ImpactScore", () => {
  it("starts at zero", async () => {
    const { impactScore, borrower } = await loadFixture(deployFixture);
    expect(await impactScore.getScore(borrower.address)).to.equal(0);
  });

  it("owner can set score directly", async () => {
    const { impactScore, borrower } = await loadFixture(deployFixture);
    await impactScore.setScore(borrower.address, 75);
    expect(await impactScore.getScore(borrower.address)).to.equal(75);
  });

  it("categoryWeight returns correct weights", async () => {
    const { impactScore } = await loadFixture(deployFixture);
    expect(await impactScore.categoryWeight("health")).to.equal(10);
    expect(await impactScore.categoryWeight("education")).to.equal(20);
    expect(await impactScore.categoryWeight("sustainability")).to.equal(15);
    expect(await impactScore.categoryWeight("unknown")).to.equal(0);
  });

  it("non-registry cannot updateScore", async () => {
    const { impactScore, stranger, borrower } = await loadFixture(deployFixture);
    await expect(
      impactScore.connect(stranger).updateScore(borrower.address, "health")
    ).to.be.revertedWith("ImpactScore: caller not registry");
  });

  it("caps at MAX_SCORE", async () => {
    const { impactScore, borrower } = await loadFixture(deployFixture);
    await impactScore.setScore(borrower.address, 1000);
    expect(await impactScore.getScore(borrower.address)).to.equal(1000);
    await expect(
      impactScore.setScore(borrower.address, 1001)
    ).to.be.revertedWith("ImpactScore: exceeds max");
  });
});

// ─── LoanManager ─────────────────────────────────────────────────────────────

describe("LoanManager", () => {
  async function withScore(score) {
    const f = await loadFixture(deployFixture);
    await f.impactScore.setScore(f.borrower.address, score);
    return f;
  }

  it("auto-approves with LOW tier for score > 80", async () => {
    const { loanManager, borrower } = await withScore(90);
    await expect(loanManager.connect(borrower).applyLoan(100_000, 30))
      .to.emit(loanManager, "LoanApproved");

    const loan = await loanManager.getLoan(1);
    expect(loan.status).to.equal(1); // APPROVED
    expect(loan.interestRate).to.equal(500);
  });

  it("auto-approves with MEDIUM tier for score 51–80", async () => {
    const { loanManager, borrower } = await withScore(65);
    await loanManager.connect(borrower).applyLoan(100_000, 30);
    const loan = await loanManager.getLoan(1);
    expect(loan.interestRate).to.equal(1200);
  });

  it("auto-approves with HIGH tier for score 20–50", async () => {
    const { loanManager, borrower } = await withScore(35);
    await loanManager.connect(borrower).applyLoan(40_000, 30);
    const loan = await loanManager.getLoan(1);
    expect(loan.interestRate).to.equal(2000);
  });

  it("auto-rejects for score < 20", async () => {
    const { loanManager, borrower } = await withScore(10);
    await expect(loanManager.connect(borrower).applyLoan(10_000, 30))
      .to.emit(loanManager, "LoanRejected");
    const loan = await loanManager.getLoan(1);
    expect(loan.status).to.equal(2); // REJECTED
  });

  it("caps approved amount at tier max", async () => {
    const { loanManager, borrower } = await withScore(65);
    await loanManager.connect(borrower).applyLoan(999_999, 30);
    const loan = await loanManager.getLoan(1);
    expect(loan.approvedAmount).to.equal(200_000); // MEDIUM cap
  });

  it("rejects invalid duration", async () => {
    const { loanManager, borrower } = await withScore(90);
    await expect(
      loanManager.connect(borrower).applyLoan(10_000, 400)
    ).to.be.revertedWith("LoanManager: invalid duration");
  });
});
