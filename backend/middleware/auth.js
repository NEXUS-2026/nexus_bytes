// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Verifies JWT from Authorization: Bearer <token>
 * Attaches req.user = { id, email, role, wallet_address }
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId)
      .select("email role wallet_address")
      .lean();

    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      wallet_address: user.wallet_address,
    };
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
