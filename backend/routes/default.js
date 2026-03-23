const express = require("express");
const mongoose = require("mongoose");
const { authenticate, requireRole } = require("../middleware/auth");
const Default = require("../models/Default");
const Loan = require("../models/Loan");
const User = require("../models/User");

const router = express.Router();

// POST /default/mark/:loanId - Mark loan as defaulted
router.post(
  "/mark/:loanId",
  authenticate,
  requireRole("lender"),
  async (req, res) => {
    try {
      const loanId = new mongoose.Types.ObjectId(req.params.loanId);
      const loan = await Loan.findById(loanId);

      if (!loan) {
        return res.status(404).json({ error: "Loan not found" });
      }

      if (loan.lender_id.toString() !== req.user.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if default record already exists
      let defaultRecord = await Default.findOne({ loan_id: loanId });

      if (defaultRecord && defaultRecord.status === "active") {
        return res
          .status(400)
          .json({ error: "Loan already marked as defaulted" });
      }

      // Create new default record
      defaultRecord = new Default({
        loan_id: loanId,
        borrower_id: loan.user_id,
        lender_id: loan.lender_id,
        default_start_date: new Date(),
        amount_outstanding: loan.approved_amount || loan.amount,
        next_due_date: new Date(),
        delinquency_stage: "0-30",
      });

      await defaultRecord.save();

      // Update loan status
      loan.status = "defaulted";
      await loan.save();

      res.json({
        message: "Loan marked as defaulted",
        default_id: defaultRecord._id.toString(),
        status: defaultRecord.status,
        amount_outstanding: defaultRecord.amount_outstanding,
      });
    } catch (err) {
      console.error("[Mark Default] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /default/:defaultId/action - Log recovery action
router.post(
  "/:defaultId/action",
  authenticate,
  requireRole("lender"),
  async (req, res) => {
    try {
      const { action_type, notes, response } = req.body;

      const allowedActions = [
        "notification_sent",
        "reminder_call",
        "legal_notice",
        "collection_agency_assigned",
      ];
      if (!allowedActions.includes(action_type)) {
        return res.status(400).json({ error: "Invalid action type" });
      }

      const defaultRecord = await Default.findByIdAndUpdate(
        req.params.defaultId,
        {
          $push: {
            recovery_actions: {
              action_type,
              action_date: new Date(),
              action_by: req.user.id,
              notes,
              response,
            },
          },
        },
        { new: true },
      );

      res.json({
        message: "Recovery action logged",
        recovery_actions: defaultRecord.recovery_actions.length,
      });
    } catch (err) {
      console.error("[Default Action] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /default/:defaultId/settle - Mark default as cured/settled
router.post(
  "/:defaultId/settle",
  authenticate,
  requireRole("lender"),
  async (req, res) => {
    try {
      const { settled_amount, settled_date } = req.body;

      const defaultRecord = await Default.findByIdAndUpdate(
        req.params.defaultId,
        {
          status: "cured",
          settled_date: settled_date || new Date(),
          settled_amount,
        },
        { new: true },
      );

      // Update loan status
      await Loan.findByIdAndUpdate(defaultRecord.loan_id, {
        status: "repaid",
      });

      res.json({
        message: "Default settled",
        status: defaultRecord.status,
        settled_amount,
      });
    } catch (err) {
      console.error("[Settle Default] Error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /default/status - Get all active defaults for lender
router.get("/status", authenticate, requireRole("lender"), async (req, res) => {
  try {
    const defaults = await Default.find({
      lender_id: req.user.id,
      status: "active",
    })
      .populate("borrower_id", "full_name email")
      .populate("loan_id", "amount approved_amount applied_at")
      .sort({ default_start_date: -1 });

    const stats = {
      total_active_defaults: defaults.length,
      total_amount_at_risk: defaults.reduce(
        (sum, d) => sum + d.amount_outstanding,
        0,
      ),
      by_delinquency_stage: {
        "0-30": defaults.filter((d) => d.delinquency_stage === "0-30").length,
        "30-60": defaults.filter((d) => d.delinquency_stage === "30-60").length,
        "60-90": defaults.filter((d) => d.delinquency_stage === "60-90").length,
        "90+": defaults.filter((d) => d.delinquency_stage === "90+").length,
      },
    };

    res.json({
      stats,
      defaults: defaults.map((d) => ({
        default_id: d._id.toString(),
        borrower: d.borrower_id,
        loan_id: d.loan_id?._id.toString(),
        days_overdue: d.days_overdue,
        amount_outstanding: d.amount_outstanding,
        delinquency_stage: d.delinquency_stage,
        recovery_actions_taken: d.recovery_actions.length,
        default_start_date: d.default_start_date,
      })),
    });
  } catch (err) {
    console.error("[Default Status] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
