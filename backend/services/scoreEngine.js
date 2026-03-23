// services/scoreEngine.js
// Calculates the Impact Score from verified activities in PostgreSQL
// and syncs it to the blockchain.

const db = require("../config/db");
const blockchainService = require("./blockchain");

// Category weights (must match ImpactScore.sol constants)
const WEIGHTS = {
  health:         10,
  education:      20,
  sustainability: 15,
  livelihood:     18,
  digital:        12,
  community:      14,
};

const SCORE_FLOOR_FOR_LOAN = 60;

/**
 * Recalculate a user's score from the DB, update the cache,
 * and optionally push to blockchain.
 * @returns { score, activities, txHash? }
 */
async function syncUserScore(userId) {
  // 1. Fetch verified activities with recency to compute dynamic score.
  const { rows: activities } = await db.query(
    `SELECT id, category, created_at
     FROM activities
     WHERE user_id = $1 AND status = 'verified'
     ORDER BY created_at ASC`,
    [userId]
  );

  const { rows: rejectedRows } = await db.query(
    `SELECT COUNT(*)::int AS rejected
     FROM activities
     WHERE user_id = $1 AND status = 'rejected'`,
    [userId]
  );

  const rejectedCount = Number(rejectedRows[0]?.rejected || 0);
  const now = Date.now();
  const categoryPoints = Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, 0]));
  const categoryCounts = Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, 0]));
  let recentVerifiedCount = 0;

  for (const row of activities) {
    const category = row.category;
    const baseWeight = WEIGHTS[category] || 0;
    if (!baseWeight) continue;

    const ageDays = Math.floor((now - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const recencyMultiplier = ageDays <= 30 ? 1.0 : ageDays <= 90 ? 0.85 : ageDays <= 180 ? 0.65 : 0.45;
    const points = Math.round(baseWeight * recencyMultiplier);

    categoryPoints[category] += points;
    categoryCounts[category] += 1;
    if (ageDays <= 60) recentVerifiedCount += 1;
  }

  let score = Object.values(categoryPoints).reduce((sum, p) => sum + p, 0);

  // Diversity bonus rewards balanced impact.
  const activeCategories = Object.values(categoryCounts).filter((c) => c > 0).length;
  const diversityBonus = activeCategories === 3 ? 45 : activeCategories === 2 ? 18 : activeCategories === 1 ? 0 : 0;
  score += diversityBonus;

  // Consistency bonus rewards recent activity cadence.
  const consistencyBonus = Math.min(35, recentVerifiedCount * 4);
  score += consistencyBonus;

  // Rejection penalty prevents score inflation from noisy submissions.
  const rejectionPenalty = Math.min(70, rejectedCount * 6);
  score -= rejectionPenalty;

  // Cap at 1000 (matches MAX_SCORE in contract)
  score = Math.max(0, Math.min(score, 1000));

  // 2. Update local cache
  await db.query(
    `INSERT INTO impact_scores (user_id, score, last_synced_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET score = $2, last_synced_at = NOW()`,
    [userId, score]
  );

  // 3. Try to push to blockchain (non-blocking)
  let txHash = null;
  try {
    const { rows: userRows } = await db.query(
      "SELECT wallet_address FROM users WHERE id = $1",
      [userId]
    );
    const wallet = userRows[0]?.wallet_address;

    if (wallet && process.env.CONTRACT_IMPACT_SCORE) {
      // Only push if the on-chain score differs
      const onChainScore = await blockchainService.getOnChainScore(wallet);
      if (onChainScore !== score) {
        // Admin-level score push via backend wallet
        // (In production, emit events instead of direct setScore)
        console.log(`[ScoreEngine] Pushing score ${score} for ${wallet}`);
      }
    }
  } catch (err) {
    console.warn("[ScoreEngine] Blockchain sync skipped:", err.message);
  }

  return {
    score,
    activities,
    txHash,
    meta: {
      diversityBonus,
      consistencyBonus,
      rejectionPenalty,
      categoryPoints,
      categoryCounts,
      recentVerifiedCount,
    },
  };
}

/**
 * Returns the cached score + breakdown for a user.
 */
async function getUserScore(userId) {
  // Score cache
  const { rows: scoreRows } = await db.query(
    "SELECT score, last_synced_at FROM impact_scores WHERE user_id = $1",
    [userId]
  );

  // Detailed breakdown
  const { rows: breakdown } = await db.query(
    `SELECT category, status, created_at
     FROM activities
     WHERE user_id = $1`,
    [userId]
  );

  const { rows: profileRows } = await db.query(
    `SELECT kyc_status FROM users WHERE id = $1`,
    [userId]
  );

  const { rows: repaymentRows } = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'repaid')::int AS repaid
     FROM loans
     WHERE user_id = $1`,
    [userId]
  );

  const score = scoreRows[0]?.score ?? 0;
  const kycStatus = profileRows[0]?.kyc_status || "pending";
  const totalLoans = Number(repaymentRows[0]?.total || 0);
  const repaidLoans = Number(repaymentRows[0]?.repaid || 0);
  const repaymentRate = totalLoans > 0 ? Math.round((repaidLoans / totalLoans) * 100) : null;

  const terms = suggestLoanTerms({
    score,
    kycStatus,
    repaymentRate,
    durationDays: 30,
  });

  // Compute tier
  const tier = terms.tier;

  // Eligible for loan?
  const loanEligible = score >= SCORE_FLOOR_FOR_LOAN;

  return {
    score,
    tier,
    loanEligible,
    scoreFloorForLoan: SCORE_FLOOR_FOR_LOAN,
    maxLoanAmount: terms.maxAmount,
    interestRate:  terms.interestRate,
    riskPremium: terms.riskPremium,
    scoreFactors: terms.scoreFactors,
    kycStatus,
    repaymentRate,
    breakdown:     buildBreakdown(breakdown),
    lastSynced:    scoreRows[0]?.last_synced_at || null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function suggestLoanTerms({ score, kycStatus = "pending", repaymentRate = null, durationDays = 30 }) {
  if (score < SCORE_FLOOR_FOR_LOAN) {
    return {
      tier: "none",
      interestRate: 0,
      maxAmount: 0,
      riskPremium: 0,
      scoreFactors: ["score_below_floor"],
    };
  }

  // Continuous base rate from score.
  let rate = 24 - (score * 0.055);
  const factors = [];

  if (kycStatus === "approved") {
    rate -= 1.5;
    factors.push("kyc_discount");
  } else if (kycStatus === "rejected") {
    rate += 2.5;
    factors.push("kyc_risk_markup");
  } else {
    rate += 0.75;
    factors.push("kyc_pending_markup");
  }

  if (repaymentRate !== null) {
    if (repaymentRate >= 90) {
      rate -= 1.0;
      factors.push("strong_repayment_discount");
    } else if (repaymentRate < 60) {
      rate += 1.75;
      factors.push("weak_repayment_markup");
    }
  }

  if (durationDays > 180) {
    rate += 0.8;
    factors.push("long_tenure_markup");
  } else if (durationDays <= 30) {
    rate -= 0.4;
    factors.push("short_tenure_discount");
  }

  rate = Math.max(6.5, Math.min(rate, 26));
  const roundedRate = Number(rate.toFixed(2));

  let tier = "high";
  if (score >= 260) tier = "low";
  else if (score >= 150) tier = "medium";

  // Automatic borrower-side max amount based on score + trust signals.
  let maxAmount = 15000 + (score * 240);
  if (kycStatus === "approved") maxAmount += 30000;
  if (repaymentRate !== null && repaymentRate >= 85) maxAmount += 20000;
  if (repaymentRate !== null && repaymentRate < 60) maxAmount -= 15000;
  maxAmount = Math.max(10000, Math.min(Math.round(maxAmount), 500000));

  return {
    tier,
    interestRate: roundedRate,
    maxAmount,
    riskPremium: Number((roundedRate - 6.5).toFixed(2)),
    scoreFactors: factors,
  };
}

function buildBreakdown(rows) {
  const base = Object.fromEntries(
    Object.entries(WEIGHTS).map(([category, weight]) => [
      category,
      { verified: 0, pending: 0, rejected: 0, points: 0, weight },
    ])
  );

  const now = Date.now();
  for (const row of rows) {
    if (!base[row.category]) continue;

    if (row.status === "verified") {
      base[row.category].verified += 1;
      const ageDays = Math.floor((now - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const recencyMultiplier = ageDays <= 30 ? 1.0 : ageDays <= 90 ? 0.85 : ageDays <= 180 ? 0.65 : 0.45;
      base[row.category].points += Math.round(WEIGHTS[row.category] * recencyMultiplier);
    } else if (row.status === "pending") {
      base[row.category].pending += 1;
    } else if (row.status === "rejected") {
      base[row.category].rejected += 1;
    }
  }

  return base;
}

module.exports = { syncUserScore, getUserScore, suggestLoanTerms, SCORE_FLOOR_FOR_LOAN };
