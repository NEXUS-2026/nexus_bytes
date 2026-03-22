const SCORE_MODEL_VERSION = "v2_behavior_factors";

const TIER_RULES = [
  { tier: "low", minScoreExclusive: 80, interestRate: 5, maxAmount: 5000 },
  { tier: "medium", minScoreExclusive: 50, interestRate: 12, maxAmount: 2000 },
  { tier: "high", minScoreInclusive: 20, interestRate: 20, maxAmount: 500 },
  { tier: "none", minScoreInclusive: 0, interestRate: 0, maxAmount: 0 },
];

const POLICY_LIMITS = {
  maxRateOverrideDelta: 5,
  maxAmountOverrideMultiplier: 1.2,
};

function getTermsForScore(score) {
  const safeScore = Number(score || 0);

  if (safeScore > 80) return { tier: "low", interestRate: 5, maxAmount: 5000 };
  if (safeScore > 50)
    return { tier: "medium", interestRate: 12, maxAmount: 2000 };
  if (safeScore >= 20)
    return { tier: "high", interestRate: 20, maxAmount: 500 };
  return { tier: "none", interestRate: 0, maxAmount: 0 };
}

function getTierForScore(score) {
  return getTermsForScore(score).tier;
}

module.exports = {
  SCORE_MODEL_VERSION,
  TIER_RULES,
  POLICY_LIMITS,
  getTermsForScore,
  getTierForScore,
};
