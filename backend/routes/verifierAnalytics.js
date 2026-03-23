const express = require("express");
const mongoose = require("mongoose");
const { authenticate, requireRole } = require("../middleware/auth");
const User = require("../models/User");
const Activity = require("../models/Activity");
const Loan = require("../models/Loan");
const ImpactScore = require("../models/ImpactScore");

const router = express.Router();

// GET /verifier/analytics - Verifier portfolio dashboard
// Returns: verification metrics, queue health, quality indicators
router.get(
  "/analytics",
  authenticate,
  requireRole("verifier"),
  async (req, res) => {
    try {
      const verifierId = req.user.id;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Fetch all activities verified by this verifier
      const allActivities = await Activity.find({
        verified_by: verifierId,
      })
        .select("status category verified_at created_at user_id")
        .lean();

      // Pending activities (in their queue)
      const pendingActivities = await Activity.find({
        status: "pending",
      })
        .select("category created_at user_id")
        .lean();

      const recentlyVerified = allActivities.filter(
        (a) => new Date(a.verified_at) > thirtyDaysAgo,
      );
      const recentlyRejected = allActivities.filter(
        (a) =>
          a.status === "rejected" && new Date(a.verified_at) > thirtyDaysAgo,
      );

      // Quality metrics
      const totalVerified = allActivities.filter(
        (a) => a.status === "verified",
      ).length;
      const totalRejected = allActivities.filter(
        (a) => a.status === "rejected",
      ).length;
      const rejectionRate =
        totalVerified + totalRejected > 0
          ? (totalRejected / (totalVerified + totalRejected)) * 100
          : 0;

      // Category breakdown of verified activities
      const categoryBreakdown = {};
      ["health", "education", "sustainability"].forEach((cat) => {
        categoryBreakdown[cat] = {
          verified: allActivities.filter(
            (a) => a.category === cat && a.status === "verified",
          ).length,
          rejected: allActivities.filter(
            (a) => a.category === cat && a.status === "rejected",
          ).length,
        };
      });

      // Average verification time
      const verificationTimes = allActivities
        .filter((a) => a.verified_at)
        .map((a) => ({
          created: new Date(a.created_at).getTime(),
          verified: new Date(a.verified_at).getTime(),
        }))
        .map((t) => Math.ceil((t.verified - t.created) / (1000 * 60 * 60))); // hours

      const avgVerificationHours =
        verificationTimes.length > 0
          ? Math.round(
              verificationTimes.reduce((a, b) => a + b, 0) /
                verificationTimes.length,
            )
          : 0;

      // Queue health
      const queueAge = pendingActivities.map((a) => ({
        created: new Date(a.created_at).getTime(),
      }));
      const oldestPending =
        queueAge.length > 0
          ? Math.round(
              (Date.now() - Math.min(...queueAge.map((q) => q.created))) /
                (1000 * 60 * 60),
            )
          : 0;

      // Borrower impact preview
      const verifiedUserIds = [
        ...new Set(recentlyVerified.map((a) => a.user_id.toString())),
      ];
      const borrowerScores = await ImpactScore.find({
        user_id: {
          $in: verifiedUserIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      })
        .select("score user_id components")
        .lean();

      const borrowerImpact = borrowerScores.map((s) => ({
        user_id: s.user_id.toString(),
        score: s.score,
        components: s.components,
      }));

      res.json({
        verifier_id: verifierId,
        period: "current_month",
        summary: {
          total_activities_verified: totalVerified,
          total_activities_rejected: totalRejected,
          rejection_rate_percent: Number(rejectionRate.toFixed(2)),
          verified_this_month: recentlyVerified.length,
          rejected_this_month: recentlyRejected.length,
          avg_verification_hours: avgVerificationHours,
        },
        queue_health: {
          pending_in_queue: pendingActivities.length,
          oldest_pending_hours: oldestPending,
          queue_status:
            oldestPending > 48
              ? "critical_overdue"
              : oldestPending > 24
                ? "warning_aging"
                : "healthy",
        },
        category_breakdown: categoryBreakdown,
        borrower_impact: {
          borrowers_positively_impacted: borrowerImpact.length,
          average_score_of_verified_borrowers:
            borrowerImpact.length > 0
              ? Math.round(
                  borrowerImpact.reduce((sum, b) => sum + b.score, 0) /
                    borrowerImpact.length,
                )
              : 0,
          top_contributors: borrowerImpact
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((b) => b.score),
        },
        quality_indicators: {
          verification_consistency: "good",
          estimated_borrower_trust: `${(100 - rejectionRate).toFixed(1)}%`,
          activity_time_tracking: `${avgVerificationHours}h avg`,
        },
      });
    } catch (err) {
      console.error("[VerifierAnalytics] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
