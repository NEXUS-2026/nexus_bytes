// routes/auth.js
const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const multer   = require("multer");
const crypto   = require("crypto");
const { body, validationResult } = require("express-validator");
const db       = require("../config/db");
const { authenticate } = require("../middleware/auth");
const ipfsService = require("../services/ipfs");
const emailService = require("../services/email");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function buildCodeHash(email, code) {
  const secret = process.env.EMAIL_CODE_SECRET || process.env.JWT_SECRET || "impactscore-code-secret";
  return crypto.createHash("sha256").update(`${String(email).toLowerCase()}:${code}:${secret}`).digest("hex");
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── POST /auth/request-email-code ──────────────────────────────────────────

router.post(
  "/request-email-code",
  [body("email").isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email } = req.body;

    try {
      const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const code = generateCode();
      const codeHash = buildCodeHash(email, code);

      await db.query(
        `UPDATE email_verification_codes
         SET consumed_at = NOW()
         WHERE email = $1 AND consumed_at IS NULL`,
        [email]
      );

      await db.query(
        `INSERT INTO email_verification_codes (email, code_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
        [email, codeHash]
      );

      const emailResult = await emailService.sendVerificationCode(email, code);
      if (!emailResult.sent && process.env.NODE_ENV === "production") {
        return res.status(500).json({ error: "Unable to send verification code email" });
      }

      const payload = {
        message: "Verification code sent to email",
      };
      if (!emailResult.sent && process.env.NODE_ENV !== "production") {
        payload.dev_code = code;
      }

      return res.json(payload);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to send verification code" });
    }
  }
);

// ─── POST /auth/signup ───────────────────────────────────────────────────────

router.post(
  "/signup",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("full_name").trim().notEmpty(),
    body("verification_code").trim().isLength({ min: 6, max: 6 }).withMessage("verification_code must be 6 digits"),
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
      alternate_phone,
      address_line1,
      address_line2,
      city,
      state,
      country,
      pincode,
      organization_name,
      government_id,
      verification_code,
      role = "borrower",
      wallet_address,
    } = req.body;

    try {
      // Check duplicate email
      const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length)
        return res.status(409).json({ error: "Email already registered" });

      const { rows: codeRows } = await db.query(
        `SELECT id, code_hash, expires_at, attempts
         FROM email_verification_codes
         WHERE email = $1 AND consumed_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
      );

      if (!codeRows.length) {
        return res.status(400).json({ error: "No verification code found for this email" });
      }

      const codeRecord = codeRows[0];
      if (new Date(codeRecord.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ error: "Verification code expired. Request a new code." });
      }

      const providedHash = buildCodeHash(email, verification_code);
      if (providedHash !== codeRecord.code_hash) {
        await db.query("UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1", [codeRecord.id]);
        return res.status(400).json({ error: "Invalid verification code" });
      }

      const password_hash = await bcrypt.hash(password, 12);

      const access_status = ["verifier", "lender"].includes(role) ? "pending" : "approved";

      const { rows } = await db.query(
        `INSERT INTO users (
          email, password_hash, full_name, phone, alternate_phone,
          address_line1, address_line2, city, state, country, pincode,
          organization_name, government_id, role, wallet_address,
          access_status, email_verified
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, TRUE)
         RETURNING id, email, full_name, role, wallet_address, kyc_status, access_status, email_verified, created_at`,
        [
          email,
          password_hash,
          full_name,
          phone || null,
          alternate_phone || null,
          address_line1 || null,
          address_line2 || null,
          city || null,
          state || null,
          country || null,
          pincode || null,
          organization_name || null,
          government_id || null,
          role,
          wallet_address || null,
          access_status,
        ]
      );

      await db.query("UPDATE email_verification_codes SET consumed_at = NOW() WHERE id = $1", [codeRecord.id]);

      // Create score row
      await db.query(
        "INSERT INTO impact_scores (user_id, score) VALUES ($1, 0) ON CONFLICT DO NOTHING",
        [rows[0].id]
      );

      if (["verifier", "lender"].includes(rows[0].role)) {
        return res.status(201).json({
          user: rows[0],
          pendingApproval: true,
          message: "Account created. Admin approval is required before login.",
        });
      }

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

      if (!user.email_verified) {
        return res.status(403).json({ error: "Email not verified. Complete verification first." });
      }

      if (["verifier", "lender"].includes(user.role) && user.access_status !== "approved") {
        return res.status(403).json({
          error:
            user.access_status === "rejected"
              ? "Your access request was rejected by admin. Contact support."
              : "Your account is pending admin approval.",
          access_status: user.access_status,
        });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid)
        return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      await db.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

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
    `SELECT
      id, email, full_name, phone, alternate_phone,
      address_line1, address_line2, city, state, country, pincode,
      organization_name, government_id,
      role, wallet_address, kyc_status,
      access_status, access_review_note, access_reviewed_at,
      email_verified, last_login_at, created_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  res.json(rows[0]);
});

// ─── KYC (borrower optional) ─────────────────────────────────────────────────

router.get("/kyc/status", authenticate, async (req, res) => {
  try {
    const [userRes, submissionRes] = await Promise.all([
      db.query("SELECT id, kyc_status FROM users WHERE id = $1", [req.user.id]),
      db.query(
        `SELECT id, document_type, document_number, document_ipfs_hash, status, notes, review_note, created_at, reviewed_at
         FROM borrower_kyc_submissions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.user.id]
      ),
    ]);

    res.json({
      kyc_status: userRes.rows[0]?.kyc_status || "pending",
      latestSubmission: submissionRes.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch KYC status" });
  }
});

router.post("/kyc/submit", authenticate, upload.single("document"), async (req, res) => {
  try {
    if (req.user.role !== "borrower") {
      return res.status(403).json({ error: "Only borrowers can submit KYC" });
    }

    const { document_type, document_number, notes } = req.body;
    if (!document_type || !document_number) {
      return res.status(400).json({ error: "document_type and document_number are required" });
    }

    const { rows: pendingRows } = await db.query(
      `SELECT id FROM borrower_kyc_submissions
       WHERE user_id = $1 AND status = 'pending'
       LIMIT 1`,
      [req.user.id]
    );
    if (pendingRows.length) {
      return res.status(400).json({ error: "You already have a pending KYC submission" });
    }

    let documentIpfsHash = null;
    if (req.file) {
      documentIpfsHash = await ipfsService.uploadBuffer(req.file.buffer, req.file.originalname);
    }

    const { rows } = await db.query(
      `INSERT INTO borrower_kyc_submissions (
        user_id, document_type, document_number, document_ipfs_hash, notes, status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, document_type, document_number, document_ipfs_hash, notes, status, created_at`,
      [req.user.id, document_type, document_number, documentIpfsHash, notes || null]
    );

    await db.query("UPDATE users SET kyc_status = 'pending' WHERE id = $1", [req.user.id]);

    res.status(201).json({
      message: "KYC submitted successfully. Review is pending.",
      submission: rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit KYC" });
  }
});

module.exports = router;
