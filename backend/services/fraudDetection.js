const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const User = require("../models/User");
const Loan = require("../models/Loan");

/**
 * Fraud Detection System
 * Identifies suspicious patterns that indicate fraud
 */

class FraudDetectionEngine {
  /**
   * Run all fraud checks for a borrower
   * @returns { suspiciousActivities: [], riskScore: 0-100, flags: [] }
   */
  static async analyzeUserRisk(userId) {
    const objectUserId = new mongoose.Types.ObjectId(userId);
    const flags = [];
    let riskScore = 0;

    // 1. Check for duplicate/similar activities
    const duplicateCheck = await this.checkDuplicateActivities(objectUserId);
    if (duplicateCheck.found) {
      flags.push("duplicate_activities_detected");
      riskScore += 25;
    }

    // 2. Check velocity (too many activities/loans in short time)
    const velocityCheck = await this.checkVelocityAnomaly(objectUserId);
    if (velocityCheck.isAnomalous) {
      flags.push(
        `velocity_anomaly_${velocityCheck.count}_in_${velocityCheck.days}days`,
      );
      riskScore += velocityCheck.riskIncrease;
    }

    // 3. Check for collusion patterns (same activity by multiple users)
    const collusionCheck = await this.checkCollusionPattern(objectUserId);
    if (collusionCheck.found) {
      flags.push(
        `possible_collusion_with_${collusionCheck.colludingCount}_users`,
      );
      riskScore += collusionCheck.riskIncrease;
    }

    // 4. Check loan cycling (apply -> repay -> apply immediately)
    const loanCyclingCheck = await this.checkLoanCycling(objectUserId);
    if (loanCyclingCheck.found) {
      flags.push("suspicious_loan_cycling_pattern");
      riskScore += 15;
    }

    // 5. Check for mismatched KYC data
    const kycMismatchCheck = await this.checkKYCMismatch(objectUserId);
    if (kycMismatchCheck.found) {
      flags.push("kyc_data_mismatch");
      riskScore += 20;
    }

    riskScore = Math.min(100, riskScore);

    return {
      user_id: userId,
      risk_score: riskScore,
      flags,
      checks: {
        duplicates: duplicateCheck,
        velocity: velocityCheck,
        collusion: collusionCheck,
        loanCycling: loanCyclingCheck,
        kycMismatch: kycMismatchCheck,
      },
      flagged_for_review: riskScore > 60,
    };
  }

  /**
   * Detect duplicate or suspiciously similar activities from same user
   */
  static async checkDuplicateActivities(userId) {
    const activities = await Activity.find({
      user_id: userId,
      status: { $in: ["verified", "pending"] },
    })
      .select("title description category created_at verified_at")
      .lean();

    const seen = new Set();
    const duplicates = [];

    for (const activity of activities) {
      const key = `${activity.category}_${activity.title.toLowerCase()}`;
      if (seen.has(key)) {
        duplicates.push(activity);
      }
      seen.add(key);
    }

    return {
      found: duplicates.length > 0,
      duplicate_count: duplicates.length,
      duplicates,
    };
  }

  /**
   * Check for unusual submission velocity (e.g., 10 activities in 1 hour)
   */
  static async checkVelocityAnomaly(userId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const lastHour = await Activity.countDocuments({
      user_id: userId,
      created_at: { $gte: oneHourAgo },
    });

    const lastDay = await Activity.countDocuments({
      user_id: userId,
      created_at: { $gte: oneDayAgo },
    });

    let isAnomalous = false;
    let riskIncrease = 0;
    let count = 0;
    let days = 0;

    // Anomaly threshold: >5 in 1 hour
    if (lastHour > 5) {
      isAnomalous = true;
      riskIncrease = 30;
      count = lastHour;
      days = 0.04; // ~1 hour
    }
    // Anomaly threshold: >20 in 24 hours
    else if (lastDay > 20) {
      isAnomalous = true;
      riskIncrease = 20;
      count = lastDay;
      days = 1;
    }

    return {
      isAnomalous,
      riskIncrease,
      count,
      days,
      lastHourCount: lastHour,
      lastDayCount: lastDay,
    };
  }

  /**
   * Detect collusion: Multiple users submitting identical/similar activities
   */
  static async checkCollusionPattern(userId) {
    const user = await User.findById(userId).select("full_name").lean();
    const userActivities = await Activity.find({
      user_id: userId,
    })
      .select("title description category")
      .lean();

    if (userActivities.length === 0) {
      return { found: false, colludingCount: 0 };
    }

    // Find similar activities from other users
    const similarActivities = await Activity.find({
      user_id: { $ne: userId },
      title: { $in: userActivities.map((a) => a.title) },
    })
      .select("user_id title")
      .lean();

    const colludingUsers = new Set(
      similarActivities.map((a) => a.user_id.toString()),
    );

    return {
      found: colludingUsers.size > 3, // Threshold: 3+ other users with same activity
      colludingCount: colludingUsers.size,
      riskIncrease: Math.min(30, colludingUsers.size * 5),
    };
  }

  /**
   * Detect loan cycling: Apply → Repay → Apply immediately
   */
  static async checkLoanCycling(userId) {
    const loans = await Loan.find({
      user_id: userId,
      status: { $in: ["repaid", "approved"] },
    })
      .select("status applied_at repaid_at updated_at")
      .sort({ applied_at: -1 })
      .lean();

    if (loans.length < 2) {
      return { found: false };
    }

    // Check if loans are approved very quickly after repayment
    for (let i = 0; i < loans.length - 1; i++) {
      const current = loans[i];
      const next = loans[i + 1];

      if (current.status === "repaid" && next.status === "approved") {
        const timeBetween =
          new Date(next.applied_at) - new Date(current.repaid_at);
        const daysBetween = timeBetween / (1000 * 60 * 60 * 24);

        // Suspicious if <7 days between repayment and next application
        if (daysBetween < 7 && daysBetween > 0) {
          return {
            found: true,
            daysBetween,
            loans_involved: 2,
          };
        }
      }
    }

    return { found: false };
  }

  /**
   * Check for KYC data mismatches (e.g., name mismatch in activities)
   */
  static async checkKYCMismatch(userId) {
    const user = await User.findById(userId).select("full_name").lean();

    // Get activities and check if names match
    const activities = await Activity.find({
      user_id: userId,
      submitted_by_name: { $exists: true, $ne: "" },
    })
      .select("submitted_by_name")
      .lean();

    const mismatches = activities.filter(
      (a) => a.submitted_by_name.toLowerCase() !== user.full_name.toLowerCase(),
    );

    return {
      found: mismatches.length > 0,
      mismatch_count: mismatches.length,
      riskIncrease: Math.min(20, mismatches.length * 5),
    };
  }

  /**
   * Get fraud alerts for dashboard
   */
  static async getFraudAlerts(limit = 20) {
    const allUsers = await User.find({ role: "borrower" }).select("_id").lean();

    const alerts = [];

    for (const user of allUsers) {
      const risk = await this.analyzeUserRisk(user._id.toString());
      if (risk.flagged_for_review) {
        alerts.push({
          user_id: user._id.toString(),
          risk_score: risk.risk_score,
          flags: risk.flags,
          timestamp: new Date(),
        });
      }
    }

    return alerts.sort((a, b) => b.risk_score - a.risk_score).slice(0, limit);
  }
}

module.exports = FraudDetectionEngine;
