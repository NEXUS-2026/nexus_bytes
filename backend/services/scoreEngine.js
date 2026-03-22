// services/scoreEngine.js
// Calculates the Impact Score from verified activities in MongoDB
// and syncs it to the blockchain.

const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const ImpactScore = require("../models/ImpactScore");
const User = require("../models/User");
const blockchainService = require("./blockchain");
const { SCORE_MODEL_VERSION, getTermsForScore } = require("./loanPolicy");

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

  // 1. Calculate weighted points from verified activities with recency factor.
  const verifiedActivities = await Activity.find({
    user_id: objectUserId,
    status: "verified",
  })
    .select("category verified_at created_at")
    .lean();

  let basePoints = 0;
  let recencyPoints = 0;
  const now = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  for (const activity of verifiedActivities) {
    const weight = WEIGHTS[activity.category] || 0;
    basePoints += weight;

    const activityDate = new Date(
      activity.verified_at || activity.created_at || now,
    );
    const ageMonths = Math.max(0, (now - activityDate.getTime()) / monthMs);
    const recencyMultiplier = Math.max(0.5, Math.exp(-ageMonths / 12));
    recencyPoints += weight * recencyMultiplier;
  }

  const recentVerifiedCount = verifiedActivities.filter((activity) => {
    const activityDate = new Date(
      activity.verified_at || activity.created_at || now,
    );
    return now - activityDate.getTime() <= monthMs;
  }).length;

  const consistencyBonus = Math.min(30, recentVerifiedCount * 2);
  const totalBeforeCap = recencyPoints + consistencyBonus;
  let score = totalBeforeCap;

  // Cap at 1000 (matches MAX_SCORE in contract)
  score = Math.min(score, 1000);

  // 2. Update local cache
  const scoreUpdate = {
    score,
    last_synced_at: new Date(),
    score_model_version: SCORE_MODEL_VERSION,
    components: {
      base_points: Number(basePoints.toFixed(2)),
      recency_points: Number(recencyPoints.toFixed(2)),
      consistency_bonus: consistencyBonus,
      recent_verified_count: recentVerifiedCount,
      total_before_cap: Number(totalBeforeCap.toFixed(2)),
      capped_score: Number(score.toFixed(2)),
    },
    sync_status: "ok",
    last_sync_error: null,
  };

  await ImpactScore.findOneAndUpdate({ user_id: objectUserId }, scoreUpdate, {
    upsert: true,
  });

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
    } else if (!wallet) {
      await ImpactScore.findOneAndUpdate(
        { user_id: objectUserId },
        {
          sync_status: "skipped_no_wallet",
          last_sync_error: "Wallet not connected",
        },
      );
    }
  } catch (err) {
    console.warn("[ScoreEngine] Blockchain sync skipped:", err.message);
    await ImpactScore.findOneAndUpdate(
      { user_id: objectUserId },
      {
        sync_status: "pending_retry",
        last_sync_error: err.message,
      },
    );
  }

  return {
    score,
    components: scoreUpdate.components,
    verifiedActivities: verifiedActivities.length,
    txHash,
  };
}

/**
 * Returns the cached score + breakdown for a user.
 */
async function getUserScore(userId) {
  const objectUserId = new mongoose.Types.ObjectId(userId);

  // Score cache
  const scoreRows = await ImpactScore.findOne({ user_id: objectUserId })
    .select(
      "score last_synced_at score_model_version components sync_status last_sync_error",
    )
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
  const terms = getTermsForScore(score);

  // Eligible for loan?
  const loanEligible = score >= 20;

  return {
    score,
    tier: terms.tier,
    loanEligible,
    maxLoanAmount: terms.maxAmount,
    interestRate: terms.interestRate,
    breakdown: buildBreakdown(breakdown),
    lastSynced: scoreRows?.last_synced_at || null,
    scoreModelVersion: scoreRows?.score_model_version || "v1_basic",
    components: scoreRows?.components || null,
    syncStatus: scoreRows?.sync_status || "ok",
    syncError: scoreRows?.last_sync_error || null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
