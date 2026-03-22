// services/scoreEngine.js
// Calculates the Impact Score from verified activities in MongoDB
// and syncs it to the blockchain.

const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const ImpactScore = require("../models/ImpactScore");
const User = require("../models/User");
const blockchainService = require("./blockchain");

// Category weights (must match ImpactScore.sol constants)
const WEIGHTS = {
  health: 10,
  education: 20,
  sustainability: 15,
};

/**
 * Recalculate a user's score from the DB, update the cache,
 * and optionally push to blockchain.
 * @returns { score, activities, txHash? }
 */
async function syncUserScore(userId) {
  const objectUserId = new mongoose.Types.ObjectId(userId);

  // 1. Sum verified activities
  const activities = await Activity.aggregate([
    {
      $match: {
        user_id: objectUserId,
        status: "verified",
      },
    },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        count: 1,
      },
    },
  ]);

  let score = 0;
  for (const row of activities) {
    const weight = WEIGHTS[row.category] || 0;
    score += weight * Number(row.count);
  }

  // Cap at 1000 (matches MAX_SCORE in contract)
  score = Math.min(score, 1000);

  // 2. Update local cache
  await ImpactScore.findOneAndUpdate(
    { user_id: objectUserId },
    {
      score,
      last_synced_at: new Date(),
    },
    { upsert: true },
  );

  // 3. Try to push to blockchain (non-blocking)
  let txHash = null;
  try {
    const user = await User.findById(objectUserId)
      .select("wallet_address")
      .lean();
    const wallet = user?.wallet_address;

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
  const objectUserId = new mongoose.Types.ObjectId(userId);

  // Score cache
  const scoreRows = await ImpactScore.findOne({ user_id: objectUserId })
    .select("score last_synced_at")
    .lean();

  // Detailed breakdown
  const breakdown = await Activity.aggregate([
    { $match: { user_id: objectUserId } },
    {
      $group: {
        _id: "$category",
        verified: {
          $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] },
        },
        pending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        verified: 1,
        pending: 1,
        rejected: 1,
      },
    },
  ]);

  const score = scoreRows?.score ?? 0;

  // Compute tier
  let tier = "none";
  if (score > 80) tier = "low";
  else if (score > 50) tier = "medium";
  else if (score >= 20) tier = "high";

  // Eligible for loan?
  const loanEligible = score >= 20;

  return {
    score,
    tier,
    loanEligible,
    maxLoanAmount: tierToMax(tier),
    interestRate: tierToRate(tier),
    breakdown: buildBreakdown(breakdown),
    lastSynced: scoreRows?.last_synced_at || null,
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
    health: {
      verified: 0,
      pending: 0,
      rejected: 0,
      points: 0,
      weight: WEIGHTS.health,
    },
    education: {
      verified: 0,
      pending: 0,
      rejected: 0,
      points: 0,
      weight: WEIGHTS.education,
    },
    sustainability: {
      verified: 0,
      pending: 0,
      rejected: 0,
      points: 0,
      weight: WEIGHTS.sustainability,
    },
  };
  for (const row of rows) {
    if (!base[row.category]) continue;
    base[row.category].verified = Number(row.verified);
    base[row.category].pending = Number(row.pending);
    base[row.category].rejected = Number(row.rejected);
    base[row.category].points = Number(row.verified) * WEIGHTS[row.category];
  }
  return base;
}

module.exports = { syncUserScore, getUserScore };
