const express = require("express");
const mongoose = require("mongoose");
const { authenticate, requireRole } = require("../middleware/auth");
const ImpactScore = require("../models/ImpactScore");
const Activity = require("../models/Activity");
const { getTermsForScore } = require("../services/loanPolicy");

const router = express.Router();

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const normalizeComponents = (components = {}) => {
  const normalized = { ...components };
  [
    "base_points",
    "recency_points",
    "consistency_bonus",
    "recent_verified_count",
    "total_before_cap",
    "capped_score",
  ].forEach((key) => {
    if (normalized[key] !== undefined && normalized[key] !== null) {
      normalized[key] = round2(normalized[key]);
    }
  });
  return normalized;
};

// GET /score/explain/:userId - Get detailed score explanation
// Returns: score breakdown, components, tier info, and contributing activities
router.get("/explain/:userId", authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const requesterId = req.user.id;

    // Only borrowers can view their own, verifiers/lenders can view anyone
    if (req.user.role === "borrower" && requesterId !== targetUserId) {
      return res
        .status(403)
        .json({ error: "Cannot view other borrower scores" });
    }

    const objectUserId = new mongoose.Types.ObjectId(targetUserId);
    const scoreData = await ImpactScore.findOne({ user_id: objectUserId });

    if (!scoreData) {
      return res.status(404).json({ error: "Score not found" });
    }

    // Get the borrower's activities for context
    const verifiedActivities = await Activity.find({
      user_id: objectUserId,
      status: "verified",
    })
      .select("category description verified_at created_at")
      .sort({ verified_at: -1 })
      .limit(20);

    // Calculate terms and tier for current score
    const normalizedScore = round2(scoreData.score);
    const terms = getTermsForScore(normalizedScore);

    // Build explanation response
    const explanation = {
      user_id: targetUserId,
      current_score: normalizedScore,
      tier: terms.tier,
      interest_rate: terms.interestRate,
      max_loan_amount: terms.maxAmount,
      model_version: scoreData.score_model_version,
      last_updated: scoreData.last_synced_at,
      sync_status: scoreData.sync_status,
      components: {
        description: {
          base_points:
            "Sum of verified activity weights (health: 10, education: 20, sustainability: 15)",
          recency_points:
            "Base points decayed exponentially by age (max recent = 12 months)",
          consistency_bonus:
            "Bonus up to +30 for regular recent verified activities (2 points per recent activity)",
          recent_verified_count:
            "Number of verified activities in last 30 days",
          total_before_cap: "Sum of recency_points + consistency_bonus",
          capped_score:
            "Final score capped at 1000 (matches smart contract MAX_SCORE)",
        },
        values: normalizeComponents(scoreData.components),
      },
      recent_activities: verifiedActivities.map((act) => ({
        id: act._id.toString(),
        category: act.category,
        description: act.description,
        verified_at: act.verified_at,
      })),
      key_factors: {
        recency_weight:
          "Activities verified >12 months ago contribute less (exponential decay)",
        consistency_bonus:
          "Recent verified activities (within 30 days) provide consistency boost",
        verification_required:
          "All activities must be verified by a verifier to count toward score",
      },
    };

    res.json(explanation);
  } catch (err) {
    console.error("[ScoreExplain] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /score/trajectory/:userId - Get score history over time
// Returns: array of score snapshots from last 90 days, useful for trending
router.get("/trajectory/:userId", authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const requesterId = req.user.id;

    // Only borrowers can view their own, verifiers/lenders can view anyone
    if (req.user.role === "borrower" && requesterId !== targetUserId) {
      return res
        .status(403)
        .json({ error: "Cannot view other borrower trajectory" });
    }

    const objectUserId = new mongoose.Types.ObjectId(targetUserId);
    const scoreData = await ImpactScore.findOne({
      user_id: objectUserId,
    }).select("trajectory score_model_version");

    if (!scoreData || !scoreData.trajectory) {
      return res.json({
        user_id: targetUserId,
        trajectory: [],
        message: "No trajectory data available yet",
      });
    }

    const trajectory = {
      user_id: targetUserId,
      model_version: scoreData.score_model_version,
      snapshot_count: scoreData.trajectory.length,
      period_days: 90,
      trajectory: scoreData.trajectory.map((entry) => ({
        score: round2(entry.score),
        components: normalizeComponents(entry.components),
        synced_at: entry.synced_at,
        trend_label:
          scoreData.trajectory.length > 1 &&
          entry === scoreData.trajectory[scoreData.trajectory.length - 1]
            ? round2(
                scoreData.trajectory[scoreData.trajectory.length - 2].score,
              ) < round2(entry.score)
              ? "📈 improving"
              : round2(
                    scoreData.trajectory[scoreData.trajectory.length - 2].score,
                  ) > round2(entry.score)
                ? "📉 declining"
                : "➡️ stable"
            : undefined,
      })),
    };

    res.json(trajectory);
  } catch (err) {
    console.error("[ScoreTrajectory] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /score/model-info - Get current scoring model metadata (public)
// Returns: model version, calculation rules, and tier breakpoints
router.get("/model-info", async (req, res) => {
  try {
    const {
      SCORE_MODEL_VERSION,
      TIER_RULES,
      POLICY_LIMITS,
    } = require("../services/loanPolicy");

    res.json({
      current_version: SCORE_MODEL_VERSION,
      description:
        "v2_behavior_factors: Incorporates recency decay, consistency bonuses, and behavior factors",
      tier_rules: TIER_RULES.map((rule) => ({
        tier: rule.tier,
        min_score_exclusive: rule.minScoreExclusive || undefined,
        min_score_inclusive: rule.minScoreInclusive || undefined,
        interest_rate_percent: rule.interestRate,
        max_loan_amount: rule.maxAmount,
      })),
      calculation_rules: {
        base_points:
          "Sum of verified activity category weights (health: 10, education: 20, sustainability: 15)",
        recency_decay:
          "Exponential decay factor based on activity age (12-month half-life)",
        consistency_bonus:
          "Up to +30 points for maintaining recent verified activities (2 pts per recent activity)",
        maximum_score: 1000,
      },
      policy_limits: {
        max_rate_override_delta_percent: POLICY_LIMITS.maxRateOverrideDelta,
        max_amount_override_multiplier:
          POLICY_LIMITS.maxAmountOverrideMultiplier,
      },
      update_frequency: "Updated after each activity verification",
    });
  } catch (err) {
    console.error("[ScoreModelInfo] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
