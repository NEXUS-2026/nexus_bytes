// middleware/auth.js
const jwt = require("jsonwebtoken");
const db  = require("../config/db");

/**
 * Verifies JWT from Authorization: Bearer <token>
 * Attaches req.user = { id, email, role, wallet_address, access_status }
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      "SELECT id, email, role, wallet_address, access_status FROM users WHERE id = $1",
      [payload.userId]
    );
    if (!rows.length) return res.status(401).json({ error: "User not found" });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Role guard factory.
 * Usage: requireRole("verifier") or requireRole(["admin","verifier"])
 */
const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  next();
};

module.exports = { authenticate, requireRole };
