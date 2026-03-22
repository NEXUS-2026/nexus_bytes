const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const Loan = require("../models/Loan");
const User = require("../models/User");
const Activity = require("../models/Activity");
const ImpactScore = require("../models/ImpactScore");
const { authenticate, requireRole } = require("../middleware/auth");
const scoreEngine = require("../services/scoreEngine");
const { POLICY_LIMITS, getTermsForScore } = require("../services/loanPolicy");

const router = express.Router();

function serializeLoan(loanDoc) {
  const loan = loanDoc.toJSON ? loanDoc.toJSON() : loanDoc;
  return {
    ...loan,
    id: loan.id || loan._id?.toString(),
    user_id: loan.user_id?._id
      ? loan.user_id._id.toString()
      : loan.user_id?.toString(),
    lender_id: loan.lender_id?._id
      ? loan.lender_id._id.toString()
      : loan.lender_id?.toString() || null,
  };
}

// --- POST /loan/apply --------------------------------------------------------

router.post(
  "/apply",
  authenticate,
  requireRole("borrower"),
  [
    body("amount").isFloat({ min: 1 }).withMessage("Amount must be positive"),
    body("duration_days").isInt({ min: 7, max: 365 }),
    body("purpose").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { amount, duration_days, purpose } = req.body;

    try {
      const scoreData = await scoreEngine.getUserScore(req.user.id);
      const score = scoreData.score;

      const borrower = await User.findById(req.user.id)
        .select("kyc_status")
        .lean();
      if (borrower?.kyc_status !== "approved") {
        return res.status(403).json({
          error: "KYC approval is required before applying for a loan.",
        });
      }

      if (score < 20) {
        return res.status(400).json({
          error:
            "Your Impact Score is too low. Submit and verify more activities first.",
          score,
          minimumRequired: 20,
        });
      }

      const existing = await Loan.findOne({
        user_id: req.user.id,
        status: { $in: ["pending", "approved", "repayment_requested"] },
      })
        .select("_id")
        .lean();

      if (existing) {
        return res.status(400).json({
          error:
            "You already have an active or pending loan. Repay it before applying again.",
          existingLoanId: existing._id.toString(),
        });
      }

      const terms = getTermsForScore(score);
      if (amount > terms.maxAmount) {
        return res.status(400).json({
          error: `Your score tier allows a maximum of Rs ${terms.maxAmount}.`,
          maxAmount: terms.maxAmount,
          tier: terms.tier,
        });
      }

      const loan = await Loan.create({
        user_id: req.user.id,
        amount,
        interest_rate: terms.interestRate,
        duration_days,
        status: "pending",
        tier: terms.tier,
        score_at_apply: score,
        purpose: purpose || null,
      });

      res.status(201).json({
        loan: serializeLoan(loan),
        terms,
        message: "Application submitted. A lender will review it shortly.",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Loan application failed" });
    }
  },
);

// --- GET /loan/pending -------------------------------------------------------

router.get(
  "/pending",
  authenticate,
  requireRole(["lender"]),
  async (req, res) => {
    try {
      const loans = await Loan.find({ status: "pending" })
        .populate("user_id", "full_name email wallet_address phone")
        .sort({ applied_at: 1 })
        .lean();

      const userIds = loans
        .map((l) => l.user_id?._id)
        .filter(Boolean)
        .map((id) => id.toString());

      const scoreRows = await ImpactScore.find({ user_id: { $in: userIds } })
        .select("user_id score")
        .lean();

      const scoreMap = new Map(
        scoreRows.map((s) => [s.user_id.toString(), s.score]),
      );

      res.json(
        loans.map((loan) => ({
          ...loan,
          id: loan._id.toString(),
          user_id: loan.user_id?._id ? loan.user_id._id.toString() : null,
          full_name: loan.user_id?.full_name || null,
          email: loan.user_id?.email || null,
          wallet_address: loan.user_id?.wallet_address || null,
          phone: loan.user_id?.phone || null,
          current_score: scoreMap.get(loan.user_id?._id?.toString()) || 0,
        })),
      );
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch pending loans" });
    }
  },
);

// --- GET /loan/status --------------------------------------------------------

router.get("/status", authenticate, async (req, res) => {
  try {
    if (["lender"].includes(req.user.role)) {
      const loans = await Loan.find({})
        .populate("user_id", "full_name email")
        .sort({ applied_at: -1 })
        .lean();

      const userIds = loans
        .map((l) => l.user_id?._id)
        .filter(Boolean)
        .map((id) => id.toString());

      const scoreRows = await ImpactScore.find({ user_id: { $in: userIds } })
        .select("user_id score")
        .lean();
      const scoreMap = new Map(
        scoreRows.map((s) => [s.user_id.toString(), s.score]),
      );

      return res.json(
        loans.map((loan) => ({
          ...loan,
          id: loan._id.toString(),
          user_id: loan.user_id?._id ? loan.user_id._id.toString() : null,
          full_name: loan.user_id?.full_name || null,
          email: loan.user_id?.email || null,
          current_score: scoreMap.get(loan.user_id?._id?.toString()) || 0,
        })),
      );
    }

    const loans = await Loan.find({ user_id: req.user.id }).sort({
      applied_at: -1,
    });
    return res.json(loans.map((loan) => serializeLoan(loan)));
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch loans" });
  }
});

// --- GET /loan/borrower/:userId ---------------------------------------------

router.get(
  "/borrower/:userId",
  authenticate,
  requireRole(["lender"]),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.userId)) {
        return res.status(404).json({ error: "User not found" });
      }

      const [user, score, activities, loans] = await Promise.all([
        User.findById(req.params.userId)
          .select("full_name email phone wallet_address kyc_status created_at")
          .lean(),
        ImpactScore.findOne({ user_id: req.params.userId })
          .select("score last_synced_at")
          .lean(),
        Activity.find({ user_id: req.params.userId })
          .select("user_id category status title created_at")
          .sort({ created_at: -1 })
          .lean(),
        Loan.find({ user_id: req.params.userId })
          .sort({ applied_at: -1 })
          .lean(),
      ]);

      if (!user) return res.status(404).json({ error: "User not found" });

      const repaidLoans = loans.filter((l) => l.status === "repaid").length;

      res.json({
        user: {
          ...user,
          id: user._id.toString(),
        },
        score: score?.score ?? 0,
        activities: activities.map((a) => ({
          ...a,
          id: a._id.toString(),
          user_id: a.user_id ? a.user_id.toString() : req.params.userId,
        })),
        loans: loans.map((l) => ({
          ...l,
          id: l._id.toString(),
          user_id: l.user_id ? l.user_id.toString() : req.params.userId,
        })),
        repaymentRate:
          loans.length > 0
            ? Math.round((repaidLoans / loans.length) * 100)
            : null,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch borrower profile" });
    }
  },
);

// --- POST /loan/:id/decide ---------------------------------------------------

router.post(
  "/:id/decide",
  authenticate,
  requireRole(["lender"]),
  [
    body("action").isIn(["approve", "reject"]),
    body("approved_amount").optional().isFloat({ min: 1 }),
    body("interest_rate").optional().isFloat({ min: 0, max: 100 }),
    body("lender_note").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { action, approved_amount, interest_rate, lender_note } = req.body;

    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ error: "Loan not found" });
      }

      const loan = await Loan.findById(req.params.id);
      if (!loan) return res.status(404).json({ error: "Loan not found" });
      if (loan.status !== "pending")
        return res.status(400).json({ error: "Loan is not pending" });

      if (action === "reject") {
        if (!lender_note?.trim())
          return res
            .status(400)
            .json({ error: "Rejection reason is required" });

        loan.status = "rejected";
        loan.rejection_reason = lender_note;
        loan.lender_id = req.user.id;
        loan.decided_at = new Date();
        loan.decision_history.push({
          action: "reject",
          decided_by: req.user.id,
          decided_at: new Date(),
          baseline_amount: loan.amount,
          baseline_rate: loan.interest_rate,
          reason: lender_note,
        });
        await loan.save();

        return res.json({
          message: "Loan rejected",
          loan: serializeLoan(loan),
        });
      }

      const baselineTerms = getTermsForScore(loan.score_at_apply);
      const baselineAmount = Number(
        baselineTerms.maxAmount || loan.amount || 0,
      );
      const baselineRate = Number(
        baselineTerms.interestRate || loan.interest_rate || 0,
      );

      const finalAmount = Number(approved_amount || loan.amount);
      const finalRate = Number(interest_rate || loan.interest_rate);

      const hasOverride =
        finalAmount !== Number(loan.amount) ||
        finalRate !== Number(loan.interest_rate);

      if (hasOverride && !lender_note?.trim()) {
        return res.status(400).json({
          error:
            "A decision reason is required when overriding amount or interest rate.",
        });
      }

      const maxAllowedAmount = Number(
        (baselineAmount * POLICY_LIMITS.maxAmountOverrideMultiplier).toFixed(2),
      );
      const maxAllowedRate = baselineRate + POLICY_LIMITS.maxRateOverrideDelta;

      if (finalAmount > maxAllowedAmount) {
        return res.status(400).json({
          error: `Approved amount exceeds override policy limit (${maxAllowedAmount}).`,
        });
      }

      if (finalRate > maxAllowedRate) {
        return res.status(400).json({
          error: `Interest rate exceeds override policy limit (${maxAllowedRate}%).`,
        });
      }

      loan.status = "approved";
      loan.approved_amount = finalAmount;
      loan.interest_rate = finalRate;
      loan.lender_note = lender_note || null;
      loan.lender_id = req.user.id;
      loan.decided_at = new Date();
      loan.decision_history.push({
        action: "approve",
        decided_by: req.user.id,
        decided_at: new Date(),
        baseline_amount: baselineAmount,
        baseline_rate: baselineRate,
        approved_amount: finalAmount,
        approved_rate: finalRate,
        reason: lender_note || null,
      });
      await loan.save();

      return res.json({ message: "Loan approved", loan: serializeLoan(loan) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Decision failed" });
    }
  },
);

// --- GET /loan/:id -----------------------------------------------------------

router.get("/:id", authenticate, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: "Loan not found" });
  }

  const loan = await Loan.findById(req.params.id)
    .populate("user_id", "full_name email")
    .lean();

  if (!loan) return res.status(404).json({ error: "Loan not found" });

  const ownerId = loan.user_id?._id
    ? loan.user_id._id.toString()
    : loan.user_id.toString();
  if (req.user.role === "borrower" && ownerId !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json({
    ...loan,
    id: loan._id.toString(),
    user_id: ownerId,
    full_name: loan.user_id?.full_name || null,
    email: loan.user_id?.email || null,
  });
});

// --- POST /loan/:id/repay ----------------------------------------------------

router.post("/:id/repay", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    if (req.user.role === "borrower") {
      if (loan.user_id.toString() !== req.user.id)
        return res.status(403).json({ error: "Forbidden" });
      if (loan.status !== "approved")
        return res.status(400).json({ error: "Loan is not active" });

      loan.status = "repayment_requested";
      await loan.save();
      return res.json({
        message: "Repayment requested. Awaiting lender confirmation.",
        loan: serializeLoan(loan),
      });
    }

    if (["lender"].includes(req.user.role)) {
      loan.status = "repaid";
      loan.repaid_at = new Date();
      loan.decision_history.push({
        action: "repay_confirm",
        decided_by: req.user.id,
        decided_at: new Date(),
        reason: "Repayment confirmed",
      });
      await loan.save();
      return res.json({
        message: "Repayment confirmed.",
        loan: serializeLoan(loan),
      });
    }

    return res.status(403).json({ error: "Forbidden" });
  } catch (err) {
    return res.status(500).json({ error: "Repayment action failed" });
  }
});

module.exports = router;
