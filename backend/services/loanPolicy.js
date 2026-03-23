const SCORE_MODEL_VERSION = "v2_behavior_factors";
const LOAN_POLICY_VERSION = "v2_realistic_tiers";
const MIN_SCORE_FOR_LOAN = 40;
const RECENCY_WINDOW_DAYS = 90;

const TIER_RULES = [
  { tier: "low", minScoreExclusive: 84, interestRate: 9, maxAmount: 50000 },
  { tier: "medium", minScoreExclusive: 69, interestRate: 12, maxAmount: 30000 },
  { tier: "high", minScoreInclusive: 40, interestRate: 16, maxAmount: 15000 },
  { tier: "none", minScoreInclusive: 0, interestRate: 0, maxAmount: 0 },
];

const POLICY_LIMITS = {
  maxRateOverrideDelta: 5,
  maxAmountOverrideMultiplier: 1.2,
};

const POLICY_GUARDRAILS = {
  minRate: 6,
  maxRate: 30,
  minAmount: 0,
};

function getTermsForScore(score) {
  const safeScore = Number(score || 0);

  if (safeScore > 84) return { tier: "low", interestRate: 9, maxAmount: 50000 };
  if (safeScore > 69)
    return { tier: "medium", interestRate: 12, maxAmount: 30000 };
  if (safeScore >= MIN_SCORE_FOR_LOAN)
    return { tier: "high", interestRate: 16, maxAmount: 15000 };
  return { tier: "none", interestRate: 0, maxAmount: 0 };
}

function clampTerms(terms) {
  return {
    ...terms,
    maxAmount: Math.max(
      POLICY_GUARDRAILS.minAmount,
      Math.round(Number(terms.maxAmount || 0)),
    ),
    interestRate: Math.max(
      POLICY_GUARDRAILS.minRate,
      Math.min(POLICY_GUARDRAILS.maxRate, Number(terms.interestRate || 0)),
    ),
  };
}

function applyLoanPolicyFactors(baseTerms, factors = {}) {
  const appliedFactors = [];
  let adjusted = {
    ...baseTerms,
    maxAmount: Number(baseTerms.maxAmount || 0),
    interestRate: Number(baseTerms.interestRate || 0),
  };

  const repaymentRate =
    factors.repaymentRate === null || factors.repaymentRate === undefined
      ? null
      : Number(factors.repaymentRate);
  if (repaymentRate !== null) {
    if (repaymentRate >= 90) {
      adjusted.maxAmount *= 1.15;
      adjusted.interestRate -= 1;
      appliedFactors.push("repayment_bonus");
    } else if (repaymentRate < 60) {
      adjusted.maxAmount *= 0.7;
      adjusted.interestRate += 3;
      appliedFactors.push("repayment_penalty");
    }
  }

  const staleActivity = Boolean(factors.hasStaleActivity);
  if (staleActivity) {
    adjusted.maxAmount *= 0.6;
    adjusted.interestRate += 2;
    appliedFactors.push("stale_activity_penalty");
  }

  adjusted = clampTerms(adjusted);
  return {
    terms: adjusted,
    appliedFactors,
  };
}

function getTierForScore(score) {
  return getTermsForScore(score).tier;
}

module.exports = {
  SCORE_MODEL_VERSION,
  LOAN_POLICY_VERSION,
  MIN_SCORE_FOR_LOAN,
  RECENCY_WINDOW_DAYS,
  TIER_RULES,
  POLICY_LIMITS,
  POLICY_GUARDRAILS,
  getTermsForScore,
  applyLoanPolicyFactors,
  getTierForScore,
};
