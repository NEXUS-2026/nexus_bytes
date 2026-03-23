# ImpactScore Platform - Login Credentials

**Password for all accounts:** `password123`

---

## 📊 Database Summary

- **Total Accounts:** 14
- **Borrowers:** 8
- **Verifiers:** 3
- **Lenders:** 3
- **Total Activities:** 26+
- **Total Loans:** 6

---

## 👤 BORROWER ACCOUNTS (Score-Based Lending Eligible)

| Email           | Password    | Score  | Status          | KYC            | Notes                                                  |
| --------------- | ----------- | ------ | --------------- | -------------- | ------------------------------------------------------ |
| ravi@demo.com   | password123 | **92** | ✅ APPROVED     | ✅ Verified    | Tier: HIGH - ₹5,000 loan approved @ 4.5%               |
| priya@demo.com  | password123 | **85** | ✅ APPROVED     | ✅ Verified    | Tier: MEDIUM - ₹4,000 loan approved @ 5.0%             |
| anjali@demo.com | password123 | **88** | ✅ APPROVED     | ✅ Verified    | Tier: HIGH - ₹6,000 loan approved @ 4.0%               |
| divya@demo.com  | password123 | **72** | ✅ APPROVED     | ✅ Verified    | Tier: MEDIUM - ₹3,500 loan approved @ 5.5%             |
| amit@demo.com   | password123 | **78** | ⏳ PENDING      | ✅ Verified    | Tier: MEDIUM - Loan application under review           |
| rajesh@demo.com | password123 | **55** | ❌ NOT ELIGIBLE | ✅ Verified    | Low score - Not qualified for lending                  |
| meena@demo.com  | password123 | **45** | ❌ REJECTED     | ✅ Verified    | Low score - Loan application rejected                  |
| vikram@demo.com | password123 | **30** | ⏳ PENDING      | ⏳ **PENDING** | KYC verification pending - Upload documents to proceed |

---

## 🔍 VERIFIER ACCOUNTS (KYC & Activity Verification)

| Email              | Password    | Role                    | Responsibilities                          |
| ------------------ | ----------- | ----------------------- | ----------------------------------------- |
| verifier1@demo.com | password123 | NGO Verifier - South    | Review KYC documents, verify activities   |
| verifier2@demo.com | password123 | NGO Verifier - North    | Review KYC documents, verify activities   |
| verifier3@demo.com | password123 | Community Health Worker | Verify health & sustainability activities |

**Verifier Features:**

- Access `/kyc/dashboard` - Review pending KYC documents
- Access `/verify` - Verify pending activities
- Access `/verifier/portfolio` - View portfolio analytics

---

## 💰 LENDER ACCOUNTS (Loan Management & Risk Monitoring)

| Email            | Password    | Institution        | Active Loans           |
| ---------------- | ----------- | ------------------ | ---------------------- |
| lender1@demo.com | password123 | HDFC Lending       | 2 loans (Ravi, Anjali) |
| lender2@demo.com | password123 | ICICI Microfinance | 2 loans (Priya, Meena) |
| lender3@demo.com | password123 | Equitas Fintech    | 2 loans (Amit, Divya)  |

**Lender Features:**

- Access `/lender` - Review all loan applications
- Access `/lender/portfolio` - Portfolio analytics
- Access `/default/management` - Track loan defaults & recovery

---

## 📋 ACTIVITY DATA OVERVIEW

### High-Score Borrowers (Score 85+)

- **Ravi** (92): 8 verified activities (health, education, sustainability)
- **Anjali** (88): 6 verified activities (health, education, sustainability)
- **Priya** (85): 5 verified + 1 pending activity

### Mid-Score Borrowers (Score 70-84)

- **Amit** (78): 4 verified + 1 pending activity
- **Divya** (72): 4 verified activities

### Low-Score Borrowers (Score <70)

- **Rajesh** (55): 2 verified activities
- **Meena** (45): 1 verified + 1 pending activity
- **Vikram** (30): 1 pending activity (KYC verification pending)

---

## 🔐 KYC Upload Flow

**NEW FEATURE**: Borrowers can now upload KYC documents to verify their identity!

### How it Works:

1. **Borrower uploads documents** → `/kyc/upload`
2. **Verifier reviews** → `/kyc/dashboard`
3. **Once approved**, borrower can **apply for loans** → `/loan`

### Document Types:

- ✅ **Government ID** (REQUIRED) - Aadhar, PAN, Passport
- ✅ **Address Proof** (REQUIRED) - Electricity bill, Rent agreement, Utility bill
- 📋 **Employment Proof** (Optional) - Salary slip, Appointment letter
- 📋 **Bank Statements** (Optional) - Last 3 months statements
- 📋 **Other Documents** (Optional) - Supporting documents

### Test KYC Scenarios:

#### Start KYC Upload as Borrower (vikram@demo.com - Pending KYC)

```
Login: vikram@demo.com / password123
Navigation: Go to "Upload KYC" in Navbar
Expected: See KYC upload form
Test: Select and upload documents
Status Change: From "pending_review" → "awaiting_verification"
```

#### Review KYC Documents as Verifier (verifier2@demo.com)

```
Login: verifier2@demo.com / password123
Navigation: Go to "KYC Review" → /kyc/dashboard
Expected: See pending KYC queue with vikram's documents
Test: Open modal → Approve/Reject/Request Resubmission
Result: vikram's KYC status updates
```

#### Check KYC Status as Borrower (vikram@demo.com)

```
After verifier approves:
Login: vikram@demo.com / password123
Navigation: Go to "Upload KYC" → /kyc/upload
Expected: See "✓ KYC Verified" message
Next Step: Can now apply for loan!
```

---

## 🎯 Test Scenarios

### Scenario 1: High-Score Borrower Journey

```
Login: ravi@demo.com / password123
Expected: See 8 verified activities, approved loan of ₹5,000
Test: View loan details, check impact score, verify activities
```

### Scenario 2: Medium-Score Borrower with Pending Application

```
Login: amit@demo.com / password123
Expected: See 4 verified activities, pending loan application
Test: Check application status, view activities
```

### Scenario 3: Rejected Low-Score Borrower

```
Login: meena@demo.com / password123
Expected: See 1 verified activity, rejected loan application
Test: Understand why loan was rejected
```

### Scenario 4: Pending KYC Borrower (NEW - Upload Documents)

```
Login: vikram@demo.com / password123
Navigation: Go to "Upload KYC" in Navbar
Expected: See "📋 Not Started" or "⏳ Under Review" status
- If not started: Upload Government ID + Address Proof
- If pending: Check status and submit more documents
Test: Upload documents, see status change to "⏳ Under Review"
```

### Scenario 5: KYC Verification by Verifier

```
Login: verifier2@demo.com / password123
Navigation: Go to "KYC Review" (/kyc/dashboard)
Expected: See vikram@demo.com pending KYC review queue
Test:
  1. Click on vikram's pending KYC
  2. View uploaded documents (govt_id, address_proof)
  3. Click Approve/Reject/Request Resubmission
  4. Add verification notes
Result: vikram's KYC status updates to "approved" or "rejected"
```

### Scenario 6: Default Management by Lender

```
Login: lender1@demo.com / password123
Navigation: Go to Default Management (/default/management)
Expected: View default delinquency stages and stats
Test: Mark loans as defaulted, log recovery actions
```

### Scenario 7: Verifier Portfolio Analytics

```
Login: verifier1@demo.com / password123
Navigation: Go to Portfolio (/verifier/portfolio)
Expected: See verified activities, verification stats
Test: View impact timeline, activity distribution
```

### Scenario 8: Lender Portfolio Analytics

```
Login: lender1@demo.com / password123
Navigation: Go to Portfolio (/lender/portfolio)
Expected: See loan portfolio, risk distribution, tier breakdown
Test: View portfolio metrics and risk analysis
```

---

## 🔐 Security Notes

⚠️ **DEVELOPMENT ONLY**: These are demo accounts for testing only.

- All accounts use the same password: `password123`
- Passwords are hashed with bcrypt (12 rounds)
- KYC documents are not validated (demo mode)
- Blockchain transactions are simulated

---

## 📱 Quick Access Links

| Feature              | Borrower              | Verifier                 | Lender                   |
| -------------------- | --------------------- | ------------------------ | ------------------------ |
| Dashboard            | ✅ `/dashboard`       | ✅ `/dashboard`          | ✅ `/dashboard`          |
| Submit Activity      | ✅ `/submit-activity` | ❌                       | ❌                       |
| My Activities        | ✅ `/activities`      | ❌                       | ❌                       |
| **Upload KYC Proof** | ✅ `/kyc/upload`      | ❌                       | ❌                       |
| Apply Loan           | ✅ `/loan`            | ❌                       | ❌                       |
| Verify Activities    | ❌                    | ✅ `/verify`             | ❌                       |
| KYC Dashboard        | ❌                    | ✅ `/kyc/dashboard`      | ❌                       |
| Fraud Alerts         | ❌                    | ✅ `/fraud/alerts`       | ✅ `/fraud/alerts`       |
| Loan Reviews         | ❌                    | ❌                       | ✅ `/lender`             |
| Default Management   | ❌                    | ❌                       | ✅ `/default/management` |
| Portfolio            | ✅                    | ✅ `/verifier/portfolio` | ✅ `/lender/portfolio`   |

---

## 🚀 Getting Started

1. **Frontend**: `npm --prefix frontend start`
2. **Backend**: `npm --prefix backend start`
3. **Open**: http://localhost:3000
4. **Login**: Use any account from above
5. **Test**: Follow the scenarios listed above

---

**Last Updated:** Post database seeding (14 accounts fully populated)
