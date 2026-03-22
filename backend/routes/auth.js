// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const User = require("../models/User");
const ImpactScore = require("../models/ImpactScore");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ─── POST /auth/signup ───────────────────────────────────────────────────────

router.post(
  "/signup",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("full_name").trim().notEmpty(),
    body("role")
      .optional()
      .isIn(["borrower", "verifier", "lender"])
      .withMessage("Invalid role"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const {
      email,
      password,
      full_name,
      phone,
      role = "borrower",
      wallet_address,
    } = req.body;

    try {
      // Check duplicate email
      const existing = await User.findOne({ email }).select("_id").lean();
      if (existing)
        return res.status(409).json({ error: "Email already registered" });

      const password_hash = await bcrypt.hash(password, 12);

      const user = await User.create({
        email,
        password_hash,
        full_name,
        phone: phone || null,
        role,
        wallet_address: wallet_address || null,
      });

      // Create score row
      await ImpactScore.findOneAndUpdate(
        { user_id: user._id },
        { $setOnInsert: { score: 0, last_synced_at: new Date() } },
        { upsert: true, new: true },
      );

      const safeUser = {
        id: user._id.toString(),
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        wallet_address: user.wallet_address,
        kyc_status: user.kyc_status,
        created_at: user.created_at,
      };

      const token = jwt.sign(
        { userId: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
      );

      res.status(201).json({ user: safeUser, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// ─── POST /auth/login ────────────────────────────────────────────────────────

router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { userId: user._id.toString(), role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
      );

      const safeUser = user.toJSON();
      delete safeUser.password_hash;
      res.json({ user: safeUser, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// ─── PUT /auth/wallet ─────────────────────────────────────────────────────────
// Connect or update wallet address

router.put("/wallet", authenticate, async (req, res) => {
  const { wallet_address } = req.body;
  if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address))
    return res.status(400).json({ error: "Invalid wallet address" });

  await User.findByIdAndUpdate(req.user.id, { wallet_address });
  res.json({ message: "Wallet connected", wallet_address });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", authenticate, async (req, res) => {
  if (!mongoose.isValidObjectId(req.user.id)) {
    return res.status(401).json({ error: "Invalid user session" });
  }

  const user = await User.findById(req.user.id)
    .select("email full_name phone role wallet_address kyc_status created_at")
    .lean();

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    id: user._id.toString(),
    email: user.email,
    full_name: user.full_name,
    phone: user.phone,
    role: user.role,
    wallet_address: user.wallet_address,
    kyc_status: user.kyc_status,
    created_at: user.created_at,
  });
});

module.exports = router;
