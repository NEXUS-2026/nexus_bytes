// scripts/seed.js — Inserts sample data for development and testing
// Usage: node scripts/seed.js

require("dotenv").config({ path: ".env" });
const bcrypt = require("bcryptjs");
const { connectDB, mongoose } = require("../config/db");
const User = require("../models/User");
const Activity = require("../models/Activity");
const ImpactScore = require("../models/ImpactScore");
const Loan = require("../models/Loan");

async function seed() {
  console.log("Seeding MongoDB data...");

  await connectDB();

  const hash = await bcrypt.hash("password123", 12);

  // Clear current data for deterministic seeding.
  await Promise.all([
    Loan.deleteMany({}),
    Activity.deleteMany({}),
    ImpactScore.deleteMany({}),
    User.deleteMany({}),
  ]);

  const users = await User.insertMany([
    {
      email: "borrower@demo.com",
      password_hash: hash,
      full_name: "Ravi Kumar",
      phone: "+91-9876543210",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000001",
      kyc_status: "approved",
    },
    {
      email: "borrower2@demo.com",
      password_hash: hash,
      full_name: "Meena Patel",
      phone: "+91-9123456789",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000002",
      kyc_status: "approved",
    },
    {
      email: "verifier@demo.com",
      password_hash: hash,
      full_name: "NGO Verifier",
      phone: "+91-9000000001",
      role: "verifier",
      wallet_address: "0xVerifier000000000000000000000000000000001",
      kyc_status: "approved",
    },
    {
      email: "lender@demo.com",
      password_hash: hash,
      full_name: "Bank Lender",
      phone: "+91-9000000002",
      role: "lender",
      wallet_address: "0xLender00000000000000000000000000000000001",
      kyc_status: "approved",
    },
  ]);

  const b1 = users.find((u) => u.email === "borrower@demo.com");
  const b2 = users.find((u) => u.email === "borrower2@demo.com");

  await ImpactScore.insertMany([
    { user_id: b1._id, score: 90, last_synced_at: new Date() },
    { user_id: b2._id, score: 10, last_synced_at: new Date() },
  ]);

  const activities1 = [
    {
      title: "COVID-19 Vaccination",
      category: "health",
      description: "Received both doses at Primary Health Centre",
      status: "verified",
    },
    {
      title: "Annual Health Checkup 2024",
      category: "health",
      description: "Complete blood work and physical examination",
      status: "verified",
    },
    {
      title: "Digital Literacy Certificate",
      category: "education",
      description: "Completed 40-hour online course via NASSCOM",
      status: "verified",
    },
    {
      title: "Financial Management Course",
      category: "education",
      description: "Certificate from NITI Aayog partner institute",
      status: "verified",
    },
    {
      title: "Tree Plantation Drive",
      category: "sustainability",
      description: "Planted 50 trees with local NGO Jan Van",
      status: "verified",
    },
    {
      title: "Solar Cookstove Adoption",
      category: "sustainability",
      description: "Switched to solar-powered cookstove for shop",
      status: "verified",
    },
    {
      title: "Pending Health Activity",
      category: "health",
      description: "Eye test certificate - awaiting review",
      status: "pending",
    },
  ];

  const crypto = require("crypto");
  await Activity.insertMany(
    activities1.map((a) => ({
      user_id: b1._id,
      title: a.title,
      description: a.description,
      category: a.category,
      status: a.status,
      data_hash: `0x${crypto
        .createHash("sha256")
        .update(JSON.stringify({ uid: b1._id.toString(), ...a }))
        .digest("hex")}`,
      verified_at: a.status === "verified" ? new Date() : null,
    })),
  );

  await Activity.create({
    user_id: b2._id,
    title: "First Aid Training",
    description: "Basic first aid with Red Cross",
    category: "health",
    status: "verified",
  });

  await Loan.create({
    user_id: b1._id,
    amount: 3000,
    approved_amount: 3000,
    interest_rate: 5,
    duration_days: 90,
    status: "approved",
    tier: "low",
    score_at_apply: 90,
    decided_at: new Date(),
  });

  console.log("Seed complete.");
  console.log("Demo accounts:");
  console.log(
    "  borrower@demo.com  / password123  (score: 90, low-tier eligible)",
  );
  console.log("  borrower2@demo.com / password123  (score: 10, not eligible)");
  console.log("  verifier@demo.com  / password123");
  console.log("  lender@demo.com    / password123");

  await mongoose.connection.close();
}

seed().catch(async (e) => {
  console.error(e);
  await mongoose.connection.close();
  process.exit(1);
});
