// routes/auth.js
const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const db       = require("../config/db");
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
      .isIn(["borrower", "verifier", "lender", "admin"])
      .withMessage("Invalid role"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password, full_name, phone, role = "borrower", wallet_address } = req.body;

    try {
      // Check duplicate email
      const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length)
        return res.status(409).json({ error: "Email already registered" });

      const password_hash = await bcrypt.hash(password, 12);

      const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role, wallet_address)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, full_name, role, wallet_address, kyc_status, created_at`,
        [email, password_hash, full_name, phone || null, role, wallet_address || null]
      );

      // Create score row
      await db.query(
        "INSERT INTO impact_scores (user_id, score) VALUES ($1, 0) ON CONFLICT DO NOTHING",
        [rows[0].id]
      );

      const token = jwt.sign(
        { userId: rows[0].id, role: rows[0].role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      res.status(201).json({ user: rows[0], token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ─── POST /auth/login ────────────────────────────────────────────────────────

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const { rows } = await db.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );
      if (!rows.length)
        return res.status(401).json({ error: "Invalid credentials" });

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid)
        return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      const { password_hash, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ─── PUT /auth/wallet ─────────────────────────────────────────────────────────
// Connect or update wallet address

router.put("/wallet", authenticate, async (req, res) => {
  const { wallet_address } = req.body;
  if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address))
    return res.status(400).json({ error: "Invalid wallet address" });

  await db.query("UPDATE users SET wallet_address = $1 WHERE id = $2", [
    wallet_address, req.user.id,
  ]);
  res.json({ message: "Wallet connected", wallet_address });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", authenticate, async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, email, full_name, phone, role, wallet_address, kyc_status, created_at FROM users WHERE id = $1",
    [req.user.id]
  );
  res.json(rows[0]);
});

module.exports = router;
