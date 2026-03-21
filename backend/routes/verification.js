// routes/verification.js
const express = require("express");
const db      = require("../config/db");
const { authenticate, requireRole } = require("../middleware/auth");
const blockchainService = require("../services/blockchain");
const scoreEngine       = require("../services/scoreEngine");

const router = express.Router();

// ─── POST /verify — verifier approves or rejects an activity ─────────────────

router.post("/", authenticate, requireRole(["verifier", "admin"]), async (req, res) => {
  const { activity_id, action, rejection_note } = req.body;

  if (!activity_id || !["approve", "reject"].includes(action))
    return res.status(400).json({ error: "activity_id and action (approve|reject) required" });

  try {
    // Fetch activity
    const { rows: actRows } = await db.query(
      "SELECT * FROM activities WHERE id = $1",
      [activity_id]
    );
    if (!actRows.length) return res.status(404).json({ error: "Activity not found" });
    const activity = actRows[0];

    if (activity.status !== "pending")
      return res.status(400).json({ error: "Activity already processed" });

    if (action === "reject") {
      await db.query(
        `UPDATE activities
         SET status = 'rejected', verified_by = $1, verified_at = NOW(), rejection_note = $2
         WHERE id = $3`,
        [req.user.id, rejection_note || "Not approved", activity_id]
      );
      return res.json({ message: "Activity rejected", activity_id });
    }

    // ── APPROVE ──────────────────────────────────────────────────────────────

    // 1. Get borrower wallet
    const { rows: userRows } = await db.query(
      "SELECT wallet_address FROM users WHERE id = $1",
      [activity.user_id]
    );
    const borrowerWallet = userRows[0]?.wallet_address;

    // 2. Store on blockchain (only if borrower has wallet connected)
let txHash = null;
let onChainId = null;
if (borrowerWallet) {
  try {
    const result = await blockchainService.storeActivityOnChain(
      borrowerWallet,
      activity.data_hash,
      activity.category
    );
    txHash    = result.txHash;
    onChainId = result.activityId;
  } catch (bcErr) {
    console.error("Blockchain write failed:", bcErr.message);
  }
}

    // 3. Update DB
    await db.query(
      `UPDATE activities
       SET status = 'verified', verified_by = $1, verified_at = NOW(),
           blockchain_tx = $2, on_chain_id = $3
       WHERE id = $4`,
      [req.user.id, txHash, onChainId, activity_id]
    );

    // 4. Recalculate & sync impact score
    await scoreEngine.syncUserScore(activity.user_id);

    res.json({ message: "Activity approved & stored on chain", txHash, onChainId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// ─── GET /verify/pending — list pending activities for verifier ───────────────

router.get("/pending", authenticate, requireRole(["verifier", "admin"]), async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.*, u.full_name, u.email, u.wallet_address
     FROM activities a JOIN users u ON u.id = a.user_id
     WHERE a.status = 'pending'
     ORDER BY a.created_at ASC`
  );
  res.json(rows);
});

module.exports = router;
