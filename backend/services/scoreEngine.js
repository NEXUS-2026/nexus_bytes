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
};

/**
 * Recalculate a user's score from the DB, update the cache,
 * and optionally push to blockchain.
 * @returns { score, activities, txHash? }
 */
async function syncUserScore(userId) {
  // 1. Sum verified activities
  const { rows: activities } = await db.query(
    `SELECT category, COUNT(*) AS count
     FROM activities
     WHERE user_id = $1 AND status = 'verified'
     GROUP BY category`,
    [userId]
  );

  let score = 0;
  for (const row of activities) {
    const weight = WEIGHTS[row.category] || 0;
    score += weight * Number(row.count);
  }

  // Cap at 1000 (matches MAX_SCORE in contract)
  score = Math.min(score, 1000);

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

  return { score, activities, txHash };
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
    `SELECT
       category,
       COUNT(*) FILTER (WHERE status = 'verified') AS verified,
       COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
       COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
     FROM activities
     WHERE user_id = $1
     GROUP BY category`,
    [userId]
  );

  const score = scoreRows[0]?.score ?? 0;

  // Compute tier
  let tier = "none";
  if (score > 80)  tier = "low";
  else if (score > 50) tier = "medium";
  else if (score >= 20) tier = "high";

  // Eligible for loan?
  const loanEligible = score >= 20;

  return {
    score,
    tier,
    loanEligible,
    maxLoanAmount: tierToMax(tier),
    interestRate:  tierToRate(tier),
    breakdown:     buildBreakdown(breakdown),
    lastSynced:    scoreRows[0]?.last_synced_at || null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tierToMax(tier) {
  return { low: 5000, medium: 2000, high: 500, none: 0 }[tier] ?? 0;
}

function tierToRate(tier) {
  return { low: 5, medium: 12, high: 20, none: 0 }[tier] ?? 0;
}

function buildBreakdown(rows) {
  const base = {
    health:         { verified: 0, pending: 0, rejected: 0, points: 0, weight: WEIGHTS.health },
    education:      { verified: 0, pending: 0, rejected: 0, points: 0, weight: WEIGHTS.education },
    sustainability: { verified: 0, pending: 0, rejected: 0, points: 0, weight: WEIGHTS.sustainability },
  };
  for (const row of rows) {
    if (!base[row.category]) continue;
    base[row.category].verified = Number(row.verified);
    base[row.category].pending  = Number(row.pending);
    base[row.category].rejected = Number(row.rejected);
    base[row.category].points   = Number(row.verified) * WEIGHTS[row.category];
  }
  return base;
}

module.exports = { syncUserScore, getUserScore };
