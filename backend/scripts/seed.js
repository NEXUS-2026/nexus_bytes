// scripts/seed.js — Inserts sample data for development and testing
// Usage: node scripts/seed.js

require("dotenv").config({ path: ".env" });
const bcrypt = require("bcryptjs");
const { connectDB, mongoose } = require("../config/db");
const User = require("../models/User");
const Activity = require("../models/Activity");
const ImpactScore = require("../models/ImpactScore");
const Loan = require("../models/Loan");
const KYC = require("../models/KYC");

async function seed() {
  console.log("Seeding MongoDB data...");

  await connectDB();

  const hash = await bcrypt.hash("password123", 12);

  // Clear current data for deterministic seeding.
  await Promise.all([
    Loan.deleteMany({}),
    Activity.deleteMany({}),
    ImpactScore.deleteMany({}),
    KYC.deleteMany({}),
    User.deleteMany({}),
  ]);

  const users = await User.insertMany([
    // BORROWERS
    {
      email: "ravi@demo.com",
      password_hash: hash,
      full_name: "Ravi Kumar",
      phone: "+91-9876543210",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000001",
      kyc_status: "approved",
    },
    {
      email: "meena@demo.com",
      password_hash: hash,
      full_name: "Meena Patel",
      phone: "+91-9123456789",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000002",
      kyc_status: "approved",
    },
    {
      email: "amit@demo.com",
      password_hash: hash,
      full_name: "Amit Singh",
      phone: "+91-9988776655",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000003",
      kyc_status: "approved",
    },
    {
      email: "priya@demo.com",
      password_hash: hash,
      full_name: "Priya Sharma",
      phone: "+91-9555443322",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000004",
      kyc_status: "approved",
    },
    {
      email: "rajesh@demo.com",
      password_hash: hash,
      full_name: "Rajesh Desai",
      phone: "+91-9111222333",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000005",
      kyc_status: "approved",
    },
    {
      email: "anjali@demo.com",
      password_hash: hash,
      full_name: "Anjali Gupta",
      phone: "+91-9444555666",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000006",
      kyc_status: "approved",
    },
    {
      email: "vikram@demo.com",
      password_hash: hash,
      full_name: "Vikram Reddy",
      phone: "+91-9777888999",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000007",
      kyc_status: "pending",
    },
    {
      email: "divya@demo.com",
      password_hash: hash,
      full_name: "Divya Iyer",
      phone: "+91-9666777888",
      role: "borrower",
      wallet_address: "0xBorrower0000000000000000000000000000000008",
      kyc_status: "approved",
    },
    // VERIFIERS
    {
      email: "verifier1@demo.com",
      password_hash: hash,
      full_name: "NGO Verifier - South",
      phone: "+91-9000000001",
      role: "verifier",
      wallet_address: "0xVerifier000000000000000000000000000000001",
      kyc_status: "approved",
    },
    {
      email: "verifier2@demo.com",
      password_hash: hash,
      full_name: "NGO Verifier - North",
      phone: "+91-9000000002",
      role: "verifier",
      wallet_address: "0xVerifier000000000000000000000000000000002",
      kyc_status: "approved",
    },
    {
      email: "verifier3@demo.com",
      password_hash: hash,
      full_name: "Community Health Worker",
      phone: "+91-9000000003",
      role: "verifier",
      wallet_address: "0xVerifier000000000000000000000000000000003",
      kyc_status: "approved",
    },
    // LENDERS
    {
      email: "lender1@demo.com",
      password_hash: hash,
      full_name: "HDFC Lending",
      phone: "+91-9100000001",
      role: "lender",
      wallet_address: "0xLender00000000000000000000000000000000001",
      kyc_status: "approved",
    },
    {
      email: "lender2@demo.com",
      password_hash: hash,
      full_name: "ICICI Microfinance",
      phone: "+91-9100000002",
      role: "lender",
      wallet_address: "0xLender00000000000000000000000000000000002",
      kyc_status: "approved",
    },
    {
      email: "lender3@demo.com",
      password_hash: hash,
      full_name: "Equitas Fintech",
      phone: "+91-9100000003",
      role: "lender",
      wallet_address: "0xLender00000000000000000000000000000000003",
      kyc_status: "approved",
    },
  ]);

  const borrowers = users.filter((u) => u.role === "borrower");
  const verifiers = users.filter((u) => u.role === "verifier");
  const lenders = users.filter((u) => u.role === "lender");

  const b1 = borrowers[0]; // Ravi
  const b2 = borrowers[1]; // Meena
  const b3 = borrowers[2]; // Amit
  const b4 = borrowers[3]; // Priya
  const b5 = borrowers[4]; // Rajesh
  const b6 = borrowers[5]; // Anjali
  const b7 = borrowers[6]; // Vikram (pending KYC)
  const b8 = borrowers[7]; // Divya

  // Create impact scores for all borrowers
  await ImpactScore.insertMany([
    { user_id: b1._id, score: 92, last_synced_at: new Date() },
    { user_id: b2._id, score: 45, last_synced_at: new Date() },
    { user_id: b3._id, score: 78, last_synced_at: new Date() },
    { user_id: b4._id, score: 85, last_synced_at: new Date() },
    { user_id: b5._id, score: 55, last_synced_at: new Date() },
    { user_id: b6._id, score: 88, last_synced_at: new Date() },
    { user_id: b7._id, score: 30, last_synced_at: new Date() },
    { user_id: b8._id, score: 72, last_synced_at: new Date() },
  ]);

  // ACTIVITIES FOR RAVI (High Score Borrower)
  const raviActivities = [
    { title: "COVID-19 Vaccination", category: "health", status: "verified" },
    {
      title: "Annual Health Checkup 2024",
      category: "health",
      status: "verified",
    },
    {
      title: "Digital Literacy Certificate",
      category: "education",
      status: "verified",
    },
    {
      title: "Financial Management Course",
      category: "education",
      status: "verified",
    },
    {
      title: "Tree Plantation Drive",
      category: "sustainability",
      status: "verified",
    },
    {
      title: "Solar Cookstove Adoption",
      category: "sustainability",
      status: "verified",
    },
    {
      title: "Water Tank Repair",
      category: "sustainability",
      status: "verified",
    },
    { title: "Eye Test Certificate", category: "health", status: "pending" },
  ];

  // ACTIVITIES FOR MEENA (Low Score Borrower)
  const meenaActivities = [
    { title: "First Aid Training", category: "health", status: "verified" },
    {
      title: "School Enrollment Certificate",
      category: "education",
      status: "pending",
    },
  ];

  // ACTIVITIES FOR AMIT (Mid-High Score)
  const amitActivities = [
    {
      title: "Vaccination Certificate",
      category: "health",
      status: "verified",
    },
    {
      title: "Entrepreneurship Workshop",
      category: "education",
      status: "verified",
    },
    {
      title: "Waste Management Training",
      category: "sustainability",
      status: "verified",
    },
    {
      title: "Community Health Service Proof",
      category: "health",
      status: "verified",
    },
    { title: "Dental Checkup", category: "health", status: "pending" },
  ];

  // ACTIVITIES FOR PRIYA (Mid-High Score)
  const priyaActivities = [
    { title: "COVID-19 Vaccination", category: "health", status: "verified" },
    { title: "Booster Dose", category: "health", status: "verified" },
    {
      title: "Women's Empowerment Training",
      category: "education",
      status: "verified",
    },
    {
      title: "Financial Literacy Certificate",
      category: "education",
      status: "verified",
    },
    {
      title: "Emergency Fund Documentation",
      category: "health",
      status: "verified",
    },
    {
      title: "Organic Farming Course",
      category: "sustainability",
      status: "pending",
    },
  ];

  // ACTIVITIES FOR RAJESH (Low-Mid Score)
  const rajeshActivities = [
    { title: "Basic Health Insurance", category: "health", status: "verified" },
    {
      title: "Mobile Repair Course",
      category: "education",
      status: "verified",
    },
  ];

  // ACTIVITIES FOR ANJALI (High Score)
  const anjaliActivities = [
    {
      title: "Full Vaccination + Booster",
      category: "health",
      status: "verified",
    },
    {
      title: "Bachelor's Degree Certificate",
      category: "education",
      status: "verified",
    },
    {
      title: "Professional Development Course",
      category: "education",
      status: "verified",
    },
    {
      title: "Sustainability Certification",
      category: "sustainability",
      status: "verified",
    },
    {
      title: "Environmental Cleanup Drive",
      category: "sustainability",
      status: "verified",
    },
    {
      title: "Sustainable Living Pledge",
      category: "sustainability",
      status: "verified",
    },
  ];

  // ACTIVITIES FOR VIKRAM (Low Score - Pending KYC)
  const vikramActivities = [
    { title: "Health Insurance Policy", category: "health", status: "pending" },
  ];

  // ACTIVITIES FOR DIVYA (Mid Score)
  const divyaActivities = [
    {
      title: "Vaccination Certificate",
      category: "health",
      status: "verified",
    },
    {
      title: "Adult Education Certificate",
      category: "education",
      status: "verified",
    },
    {
      title: "Business Skills Training",
      category: "education",
      status: "verified",
    },
    {
      title: "Green Initiative Participation",
      category: "sustainability",
      status: "verified",
    },
  ];

  const crypto = require("crypto");
  const allActivities = [];

  // Helper function to create activities
  const createActivities = (userId, activities) => {
    return activities.map((a) => ({
      user_id: userId,
      title: a.title,
      description: `Certificate for ${a.title}`,
      category: a.category,
      status: a.status,
      data_hash: `0x${crypto
        .createHash("sha256")
        .update(JSON.stringify({ uid: userId.toString(), ...a }))
        .digest("hex")}`,
      verified_at: a.status === "verified" ? new Date() : null,
    }));
  };

  allActivities.push(...createActivities(b1._id, raviActivities));
  allActivities.push(...createActivities(b2._id, meenaActivities));
  allActivities.push(...createActivities(b3._id, amitActivities));
  allActivities.push(...createActivities(b4._id, priyaActivities));
  allActivities.push(...createActivities(b5._id, rajeshActivities));
  allActivities.push(...createActivities(b6._id, anjaliActivities));
  allActivities.push(...createActivities(b7._id, vikramActivities));
  allActivities.push(...createActivities(b8._id, divyaActivities));

  await Activity.insertMany(allActivities);

  // Create loans for various borrowers with different statuses
  await Loan.insertMany([
    // Ravi - High score, approved
    {
      user_id: b1._id,
      lender_id: lenders[0]._id,
      amount: 5000,
      approved_amount: 5000,
      interest_rate: 4.5,
      duration_days: 90,
      status: "approved",
      tier: "high",
      score_at_apply: 92,
      decided_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    },
    // Priya - Mid-high score, approved
    {
      user_id: b4._id,
      lender_id: lenders[1]._id,
      amount: 4000,
      approved_amount: 4000,
      interest_rate: 5.0,
      duration_days: 120,
      status: "approved",
      tier: "medium",
      score_at_apply: 85,
      decided_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    },
    // Anjali - High score, approved
    {
      user_id: b6._id,
      lender_id: lenders[0]._id,
      amount: 6000,
      approved_amount: 6000,
      interest_rate: 4.0,
      duration_days: 180,
      status: "approved",
      tier: "high",
      score_at_apply: 88,
      decided_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
    },
    // Amit - Mid score, pending
    {
      user_id: b3._id,
      lender_id: lenders[2]._id,
      amount: 3000,
      approved_amount: null,
      interest_rate: null,
      duration_days: null,
      status: "pending",
      tier: "medium",
      score_at_apply: 78,
      decided_at: null,
    },
    // Meena - Low score, rejected
    {
      user_id: b2._id,
      lender_id: lenders[1]._id,
      amount: 2000,
      approved_amount: null,
      interest_rate: null,
      duration_days: null,
      status: "rejected",
      tier: "low",
      score_at_apply: 45,
      decided_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    // Divya - Mid score, approved
    {
      user_id: b8._id,
      lender_id: lenders[2]._id,
      amount: 3500,
      approved_amount: 3500,
      interest_rate: 5.5,
      duration_days: 90,
      status: "approved",
      tier: "medium",
      score_at_apply: 72,
      decided_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    },
  ]);

  // CREATE KYC RECORDS FOR BORROWERS
  await KYC.insertMany([
    // Ravi - Approved KYC
    {
      user_id: b1._id,
      kyc_status: "approved",
      risk_score: 15,
      risk_factors: [],
      pep_check_status: "clear",
      max_approved_loan_amount: 10000,
      overall_verified_by: verifiers[0]._id,
      overall_verification_date: new Date(
        Date.now() - 40 * 24 * 60 * 60 * 1000,
      ),
      evidence: [
        {
          document_type: "govt_id",
          file_url: "https://demo.example.com/ravi_aadhar.pdf",
          verification_status: "approved",
          verified_by: verifiers[0]._id,
          verified_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
        {
          document_type: "address_proof",
          file_url: "https://demo.example.com/ravi_bill.pdf",
          verification_status: "approved",
          verified_by: verifiers[0]._id,
          verified_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
      ],
    },
    // Meena - Approved KYC
    {
      user_id: b2._id,
      kyc_status: "approved",
      risk_score: 45,
      risk_factors: ["low_activity_score"],
      pep_check_status: "clear",
      max_approved_loan_amount: 2000,
      overall_verified_by: verifiers[1]._id,
      overall_verification_date: new Date(
        Date.now() - 50 * 24 * 60 * 60 * 1000,
      ),
      evidence: [
        {
          document_type: "govt_id",
          file_url: "https://demo.example.com/meena_pan.pdf",
          verification_status: "approved",
          verified_by: verifiers[1]._id,
          verified_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
        },
        {
          document_type: "address_proof",
          file_url: "https://demo.example.com/meena_utility.pdf",
          verification_status: "approved",
          verified_by: verifiers[1]._id,
          verified_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
        },
      ],
    },
    // Amit - Approved KYC
    {
      user_id: b3._id,
      kyc_status: "approved",
      risk_score: 25,
      risk_factors: [],
      pep_check_status: "clear",
      max_approved_loan_amount: 8000,
      overall_verified_by: verifiers[0]._id,
      overall_verification_date: new Date(
        Date.now() - 35 * 24 * 60 * 60 * 1000,
      ),
      evidence: [
        {
          document_type: "govt_id",
          file_url: "https://demo.example.com/amit_aadhar.pdf",
          verification_status: "approved",
          verified_by: verifiers[0]._id,
          verified_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        },
        {
          document_type: "address_proof",
          file_url: "https://demo.example.com/amit_bill.pdf",
          verification_status: "approved",
          verified_by: verifiers[0]._id,
          verified_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        },
      ],
    },
    // Priya - Approved KYC
    {
      user_id: b4._id,
      kyc_status: "approved",
      risk_score: 20,
      risk_factors: [],
      pep_check_status: "clear",
      max_approved_loan_amount: 9000,
      overall_verified_by: verifiers[1]._id,
      overall_verification_date: new Date(
        Date.now() - 45 * 24 * 60 * 60 * 1000,
      ),
      evidence: [
        {
          document_type: "govt_id",
          file_url: "https://demo.example.com/priya_aadhar.pdf",
          verification_status: "approved",
          verified_by: verifiers[1]._id,
          verified_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        },
        {
          document_type: "address_proof",
          file_url: "https://demo.example.com/priya_bill.pdf",
          verification_status: "approved",
          verified_by: verifiers[1]._id,
          verified_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        },
      ],
    },
    // Rajesh - Approved KYC
    {
      user_id: b5._id,
      kyc_status: "approved",
      risk_score: 50,
      risk_factors: ["inconsistent_employment"],
      pep_check_status: "clear",
      max_approved_loan_amount: 3000,
      overall_verified_by: verifiers[2]._id,
      overall_verification_date: new Date(
        Date.now() - 55 * 24 * 60 * 60 * 1000,
      ),
      evidence: [
        {
          document_type: "govt_id",
          file_url: "https://demo.example.com/rajesh_aadhar.pdf",
          verification_status: "approved",
          verified_by: verifiers[2]._id,
          verified_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
        },
        {
          document_type: "address_proof",
          file_url: "https://demo.example.com/rajesh_bill.pdf",
          verification_status: "approved",
          verified_by: verifiers[2]._id,
          verified_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
        },
      ],
    },
    // Anjali - Approved KYC
    {
      user_id: b6._id,
      kyc_status: "approved",
      risk_score: 10,
      risk_factors: [],
      pep_check_status: "clear",
      max_approved_loan_amount: 15000,
      overall_verified_by: verifiers[0]._id,
      overall_verification_date: new Date(
        Date.now() - 32 * 24 * 60 * 60 * 1000,
      ),
      evidence: [
        {
          document_type: "govt_id",
          file_url: "https://demo.example.com/anjali_pan.pdf",
          verification_status: "approved",
          verified_by: verifiers[0]._id,
          verified_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
        },
        {
          document_type: "address_proof",
          file_url: "https://demo.example.com/anjali_bill.pdf",
          verification_status: "approved",
          verified_by: verifiers[0]._id,
          verified_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
        },
      ],
    },
    // Vikram - Pending KYC for testing
    {
      user_id: b7._id,
      kyc_status: "pending_review",
      risk_score: 0,
      risk_factors: [],
      pep_check_status: "not_checked",
      max_approved_loan_amount: 0,
      evidence: [
        {
          document_type: "govt_id",
          file_url: "https://demo.example.com/vikram_aadhar.pdf",
          verification_status: "pending",
        },
      ],
    },
    // Divya - Approved KYC
    {
      user_id: b8._id,
      kyc_status: "approved",
      risk_score: 30,
      risk_factors: [],
      pep_check_status: "clear",
      max_approved_loan_amount: 7000,
      overall_verified_by: verifiers[2]._id,
      overall_verification_date: new Date(
        Date.now() - 25 * 24 * 60 * 60 * 1000,
      ),
      evidence: [
        {
          document_type: "govt_id",
          file_url: "https://demo.example.com/divya_aadhar.pdf",
          verification_status: "approved",
          verified_by: verifiers[2]._id,
          verified_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        },
        {
          document_type: "address_proof",
          file_url: "https://demo.example.com/divya_bill.pdf",
          verification_status: "approved",
          verified_by: verifiers[2]._id,
          verified_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        },
      ],
    },
  ]);

  console.log("\n" + "=".repeat(70));
  console.log(
    "SEED COMPLETE - DATABASE POPULATED WITH 14 ACCOUNTS".padStart(75),
  );
  console.log("=".repeat(70) + "\n");

  console.log("📊 SUMMARY:");
  console.log("   • Borrowers: 8 accounts");
  console.log("   • Verifiers: 3 accounts");
  console.log("   • Lenders: 3 accounts");
  console.log("   • Total Activities: 26+");
  console.log("   • Total Loans: 6");
  console.log("   • KYC Records: 8 (7 approved, 1 pending review)\n");

  console.log("━".repeat(70));
  console.log("👤 BORROWER ACCOUNTS (Loan Eligible)".padEnd(70));
  console.log("━".repeat(70));
  console.log(
    "Email".padEnd(25) + "Password".padEnd(20) + "Score".padEnd(10) + "Status",
  );
  console.log("-".repeat(70));
  console.log(
    "ravi@demo.com".padEnd(25) +
      "password123".padEnd(20) +
      "92".padEnd(10) +
      "✓ HIGH SCORE - Approved Loan",
  );
  console.log(
    "priya@demo.com".padEnd(25) +
      "password123".padEnd(20) +
      "85".padEnd(10) +
      "✓ MID-HIGH - Approved Loan",
  );
  console.log(
    "anjali@demo.com".padEnd(25) +
      "password123".padEnd(20) +
      "88".padEnd(10) +
      "✓ HIGH SCORE - Approved Loan",
  );
  console.log(
    "divya@demo.com".padEnd(25) +
      "password123".padEnd(20) +
      "72".padEnd(10) +
      "✓ MID - Approved Loan",
  );
  console.log(
    "amit@demo.com".padEnd(25) +
      "password123".padEnd(20) +
      "78".padEnd(10) +
      "⏳ PENDING - Application",
  );
  console.log(
    "rajesh@demo.com".padEnd(25) +
      "password123".padEnd(20) +
      "55".padEnd(10) +
      "❌ LOW - Not Eligible",
  );
  console.log(
    "meena@demo.com".padEnd(25) +
      "password123".padEnd(20) +
      "45".padEnd(10) +
      "❌ REJECTED",
  );
  console.log(
    "vikram@demo.com".padEnd(25) +
      "password123".padEnd(20) +
      "30".padEnd(10) +
      "⏳ PENDING KYC",
  );

  console.log("\n" + "━".repeat(70));
  console.log("🔍 VERIFIER ACCOUNTS".padEnd(70));
  console.log("━".repeat(70));
  console.log("Email".padEnd(30) + "Password");
  console.log("-".repeat(70));
  console.log("verifier1@demo.com".padEnd(30) + "password123");
  console.log("verifier2@demo.com".padEnd(30) + "password123");
  console.log("verifier3@demo.com".padEnd(30) + "password123");

  console.log("\n" + "━".repeat(70));
  console.log("💰 LENDER ACCOUNTS".padEnd(70));
  console.log("━".repeat(70));
  console.log("Email".padEnd(30) + "Password");
  console.log("-".repeat(70));
  console.log("lender1@demo.com".padEnd(30) + "password123");
  console.log("lender2@demo.com".padEnd(30) + "password123");
  console.log("lender3@demo.com".padEnd(30) + "password123");

  console.log("\n" + "=".repeat(70));
  console.log("📝 TEST SCENARIOS:");
  console.log("=".repeat(70));
  console.log(
    "  1. HIGH RISK: Login as ravi@demo.com (score 92) → See approved loans",
  );
  console.log(
    "  2. MEDIUM RISK: Login as amit@demo.com (score 78) → See pending application",
  );
  console.log(
    "  3. LOW RISK: Login as meena@demo.com (score 45) → See rejected loan",
  );
  console.log(
    "  4. FRAUD TEST: Login as verifier1@demo.com → Check fraud alerts dashboard",
  );
  console.log(
    "  5. DEFAULT TEST: Login as lender1@demo.com → Check default management",
  );
  console.log(
    "  6. KYC TEST: Login as verifier2@demo.com → Review pending KYC for vikram",
  );
  console.log("=".repeat(70) + "\n");

  await mongoose.connection.close();
}

seed().catch(async (e) => {
  console.error(e);
  await mongoose.connection.close();
  process.exit(1);
});
