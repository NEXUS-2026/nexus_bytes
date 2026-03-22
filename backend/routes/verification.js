// routes/verification.js
const express = require("express");
const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");
const blockchainService = require("../services/blockchain");
const scoreEngine = require("../services/scoreEngine");

const router = express.Router();

// ─── POST /verify — verifier approves or rejects an activity ─────────────────

router.post("/", authenticate, requireRole(["verifier"]), async (req, res) => {
  const { activity_id, action, rejection_note } = req.body;

  if (!activity_id || !["approve", "reject"].includes(action))
    return res
      .status(400)
      .json({ error: "activity_id and action (approve|reject) required" });

  try {
    if (!mongoose.isValidObjectId(activity_id)) {
      return res.status(404).json({ error: "Activity not found" });
    }

    // Fetch activity
    const activity = await Activity.findById(activity_id).lean();
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    if (activity.status !== "pending")
      return res.status(400).json({ error: "Activity already processed" });

    if (action === "reject") {
      await Activity.findByIdAndUpdate(activity_id, {
        status: "rejected",
        verified_by: req.user.id,
        verified_at: new Date(),
        rejection_note: rejection_note || "Not approved",
      });
      return res.json({ message: "Activity rejected", activity_id });
    }

    // ── APPROVE ──────────────────────────────────────────────────────────────

    // 1. Get borrower wallet
    const borrower = await User.findById(activity.user_id)
      .select("wallet_address")
      .lean();
    const borrowerWallet = borrower?.wallet_address;

    // 2. Store on blockchain (only if borrower has wallet connected)
    let txHash = null;
    let onChainId = null;
    if (borrowerWallet) {
      try {
        const result = await blockchainService.storeActivityOnChain(
          borrowerWallet,
          activity.data_hash,
          activity.category,
        );
        txHash = result.txHash;
        onChainId = result.activityId;
      } catch (bcErr) {
        console.error("Blockchain write failed:", bcErr.message);
      }
    }

    // 3. Update DB
    await Activity.findByIdAndUpdate(activity_id, {
      status: "verified",
      verified_by: req.user.id,
      verified_at: new Date(),
      blockchain_tx: txHash,
      on_chain_id: onChainId,
    });

    // 4. Recalculate & sync impact score
    await scoreEngine.syncUserScore(activity.user_id.toString());

    res.json({
      message: "Activity approved & stored on chain",
      txHash,
      onChainId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// ─── GET /verify/pending — list pending activities for verifier ───────────────

router.get(
  "/pending",
  authenticate,
  requireRole(["verifier"]),
  async (req, res) => {
    const rows = await Activity.find({ status: "pending" })
      .populate("user_id", "full_name email wallet_address")
      .sort({ created_at: 1 })
      .lean();

    res.json(
      rows.map((row) => {
        const { _id, __v, ...rest } = row;
        return {
          ...rest,
          id: _id.toString(),
          user_id: row.user_id?._id
            ? row.user_id._id.toString()
            : row.user_id?.toString(),
          full_name: row.user_id?.full_name || null,
          email: row.user_id?.email || null,
          wallet_address: row.user_id?.wallet_address || null,
        };
      }),
    );
  },
);

module.exports = router;
