const express = require("express");
const mongoose = require("mongoose");
const { authenticate, requireRole } = require("../middleware/auth");
const Loan = require("../models/Loan");
const User = require("../models/User");
const ImpactScore = require("../models/ImpactScore");
const { getTermsForScore, getTierForScore } = require("../services/loanPolicy");

const router = express.Router();

// GET /lender/analytics - Lender portfolio dashboard
// Returns: loan portfolio metrics, risk segmentation, underwriting insights
router.get(
  "/analytics",
  authenticate,
  requireRole("lender"),
  async (req, res) => {
    try {
      const lenderId = req.user.id;

      // Fetch all loans where this lender made the decision
      const loans = await Loan.find({
        lender_id: lenderId,
      })
        .select(
          "amount approved_amount duration_days status score_at_apply lender_override_rate lender_override_amount decision_history created_at",
        )
        .lean();

      // Categorize loans by status
      const activeLoans = loans.filter((l) =>
        ["approved", "repayment_requested"].includes(l.status),
      );
      const repaidLoans = loans.filter((l) => l.status === "repaid");
      const rejectedLoans = loans.filter((l) => l.status === "rejected");
      const pendingLoans = loans.filter((l) => l.status === "pending");

      // Portfolio metrics
      const totalCapitalDeployed = activeLoans.reduce(
        (sum, l) => sum + (l.approved_amount || l.amount || 0),
        0,
      );
      const totalCapitalRepaid = repaidLoans.reduce(
        (sum, l) => sum + (l.approved_amount || l.amount || 0),
        0,
      );

      // Average loan metrics
      const avgLoanAmount =
        loans.length > 0
          ? Math.round(
              loans.reduce((sum, l) => sum + (l.amount || 0), 0) / loans.length,
            )
          : 0;
      const avgLoanDuration =
        loans.length > 0
          ? Math.round(
              loans.reduce((sum, l) => sum + (l.duration_days || 0), 0) /
                loans.length,
            )
          : 0;

      // Approval rate
      const approvedCount = loans.filter((l) =>
        ["approved", "repaid", "repayment_requested"].includes(l.status),
      ).length;
      const approvalRate =
        loans.length > 0 ? Math.round((approvedCount / loans.length) * 100) : 0;

      // Risk segmentation by score tier
      const scoreDistribution = {
        low_tier: loans.filter((l) => (l.score_at_apply || 0) > 80).length,
        medium_tier: loans.filter(
          (l) => (l.score_at_apply || 0) > 50 && (l.score_at_apply || 0) <= 80,
        ).length,
        high_tier: loans.filter(
          (l) => (l.score_at_apply || 0) >= 20 && (l.score_at_apply || 0) <= 50,
        ).length,
        not_eligible: loans.filter((l) => (l.score_at_apply || 0) < 20).length,
      };

      // Override analysis
      const overriddenLoans = loans.filter((l) =>
        l.decision_history?.some(
          (d) => d.action === "approve" && d.override_reason,
        ),
      );
      const overrideRate =
        approvedCount > 0
          ? Math.round((overriddenLoans.length / approvedCount) * 100)
          : 0;

      // Risk indicators
      const defaultRate =
        loans.length > 0
          ? Math.round(
              (loans.filter((l) => l.status === "defaulted").length /
                loans.length) *
                100,
            )
          : 0;

      // Top performers in portfolio
      const performerMetrics = {};
      for (const loan of loans) {
        const scoreKey = `tier_${getTierForScore(loan.score_at_apply || 0)}`;
        if (!performerMetrics[scoreKey]) {
          performerMetrics[scoreKey] = { total: 0, repaid: 0 };
        }
        performerMetrics[scoreKey].total++;
        if (loan.status === "repaid") {
          performerMetrics[scoreKey].repaid++;
        }
      }

      const repaymentRateByTier = {};
      for (const [key, metrics] of Object.entries(performerMetrics)) {
        repaymentRateByTier[key] =
          metrics.total > 0
            ? Math.round((metrics.repaid / metrics.total) * 100)
            : 0;
      }

      res.json({
        lender_id: lenderId,
        portfolio_summary: {
          total_loans: loans.length,
          active_loans: activeLoans.length,
          repaid_loans: repaidLoans.length,
          rejected_loans: rejectedLoans.length,
          pending_decisions: pendingLoans.length,
        },
        capital_metrics: {
          total_deployed: totalCapitalDeployed,
          total_repaid: totalCapitalRepaid,
          outstanding_balance: totalCapitalDeployed - totalCapitalRepaid,
          avg_loan_amount: avgLoanAmount,
          avg_loan_duration_days: avgLoanDuration,
        },
        decision_metrics: {
          approval_rate_percent: approvalRate,
          override_rate_percent: overrideRate,
          default_rate_percent: defaultRate,
        },
        risk_segmentation: {
          low_tier_loans: scoreDistribution.low_tier,
          medium_tier_loans: scoreDistribution.medium_tier,
          high_tier_loans: scoreDistribution.high_tier,
          not_eligible_loans: scoreDistribution.not_eligible,
        },
        repayment_by_tier: repaymentRateByTier,
        portfolio_health: {
          status:
            defaultRate > 10
              ? "critical_high_defaults"
              : defaultRate > 5
                ? "warning_elevated_risk"
                : "healthy",
          recommendation:
            overrideRate > 30
              ? "Consider tightening override criteria"
              : "Portfolio is well-managed",
        },
        decision_insights: {
          total_overridden_approvals: overriddenLoans.length,
          avg_override_count:
            activeLoans.length > 0
              ? Math.round(
                  activeLoans.filter((l) =>
                    l.decision_history?.some(
                      (d) => d.action === "approve" && d.override_reason,
                    ),
                  ).length / activeLoans.length,
                )
              : 0,
        },
      });
    } catch (err) {
      console.error("[LenderAnalytics] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
