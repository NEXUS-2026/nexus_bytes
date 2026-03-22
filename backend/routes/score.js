// routes/score.js
const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const scoreEngine = require("../services/scoreEngine");
const blockchainService = require("../services/blockchain");

const router = express.Router();

// ─── GET /score — get current user's impact score ────────────────────────────

router.get("/", authenticate, async (req, res) => {
  try {
    const score = await scoreEngine.getUserScore(req.user.id);
    res.json(score);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch score" });
  }
});

// ─── GET /score/:userId — admin can fetch any user's score ───────────────────

router.get(
  "/:userId",
  authenticate,
  requireRole(["lender"]),
  async (req, res) => {
    try {
      const score = await scoreEngine.getUserScore(req.params.userId);
      res.json(score);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch score" });
    }
  },
);

// ─── POST /score/sync — force re-sync score from blockchain ──────────────────

router.post("/sync", authenticate, async (req, res) => {
  try {
    const result = await scoreEngine.syncUserScore(req.user.id);
    res.json({ message: "Score synced", ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sync failed" });
  }
});

module.exports = router;
