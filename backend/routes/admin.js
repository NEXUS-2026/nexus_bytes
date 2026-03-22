const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Activity = require("../models/Activity");
const Loan = require("../models/Loan");
const ImpactScore = require("../models/ImpactScore");
const { authenticate, requireRole } = require("../middleware/auth");
const scoreEngine = require("../services/scoreEngine");

const router = express.Router();

// --- GET /admin/users --------------------------------------------------------

router.get("/users", authenticate, requireRole("admin"), async (req, res) => {
  const users = await User.find({}).sort({ created_at: -1 }).lean();

  const scoreRows = await ImpactScore.find({
    user_id: { $in: users.map((u) => u._id) },
  })
    .select("user_id score")
    .lean();

  const scoreMap = new Map(
    scoreRows.map((s) => [s.user_id.toString(), s.score]),
  );

  res.json(
    users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      wallet_address: u.wallet_address,
      kyc_status: u.kyc_status,
      created_at: u.created_at,
      score: scoreMap.get(u._id.toString()) || 0,
    })),
  );
});

// --- PATCH /admin/users/:id/role --------------------------------------------

router.patch(
  "/users/:id/role",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const { role } = req.body;
    const allowed = ["borrower", "verifier", "lender", "admin"];
    if (!allowed.includes(role))
      return res.status(400).json({ error: "Invalid role" });

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true },
    )
      .select("email role")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ id: user._id.toString(), email: user.email, role: user.role });
  },
);

// --- PATCH /admin/users/:id/kyc ---------------------------------------------

router.patch(
  "/users/:id/kyc",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ error: "status must be approved or rejected" });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { kyc_status: status },
      { new: true },
    )
      .select("email kyc_status")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user._id.toString(),
      email: user.email,
      kyc_status: user.kyc_status,
    });
  },
);

// --- POST /admin/score/recalculate-all --------------------------------------

router.post(
  "/score/recalculate-all",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const users = await User.find({ role: "borrower" }).select("_id").lean();
    const results = [];

    for (const u of users) {
      const r = await scoreEngine.syncUserScore(u._id.toString());
      results.push({ userId: u._id.toString(), score: r.score });
    }

    res.json({ recalculated: results.length, results });
  },
);

// --- GET /admin/stats --------------------------------------------------------

router.get("/stats", authenticate, requireRole("admin"), async (req, res) => {
  const [totalUsers, activityStats, loanStats, scoreStats] = await Promise.all([
    User.countDocuments(),
    Activity.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { _id: 0, status: "$_id", count: 1 } },
    ]),
    Loan.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
      { $project: { _id: 0, status: "$_id", count: 1, total: 1 } },
    ]),
    ImpactScore.aggregate([
      {
        $group: {
          _id: null,
          avg_score: { $avg: "$score" },
          max_score: { $max: "$score" },
        },
      },
      { $project: { _id: 0, avg_score: 1, max_score: 1 } },
    ]),
  ]);

  res.json({
    totalUsers,
    activities: Object.fromEntries(
      activityStats.map((r) => [r.status, Number(r.count)]),
    ),
    loans: loanStats.map((r) => ({
      status: r.status,
      count: Number(r.count),
      total: Number(r.total || 0),
    })),
    avgScore: Number(scoreStats[0]?.avg_score || 0).toFixed(1),
    maxScore: Number(scoreStats[0]?.max_score || 0),
  });
});

module.exports = router;
