# 🌟 ImpactScore — Blockchain-Enabled Micro-Finance Ecosystem

A decentralized micro-finance platform that enables underserved users (e.g. street vendors) to access loans using a dynamic **Impact Score** instead of traditional credit history.

---

## 📁 Project Structure

```
impactscore/
├── contracts/                  # Solidity smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── ActivityRegistry.sol   # Stores tamper-proof activity hashes
│   │   ├── ImpactScore.sol        # Score per wallet + category weights
│   │   └── LoanManager.sol        # Automated loan decisions
│   ├── scripts/
│   │   └── deploy.js              # Deploys all 3 contracts in order
│   ├── test/
│   │   └── contracts.test.js      # Full unit test suite
│   └── hardhat.config.js
│
├── backend/                    # Node.js + Express REST API
│   ├── config/
│   │   ├── db.js                  # PostgreSQL pool
│   │   └── 001_init.sql           # Schema migration
│   ├── middleware/
│   │   └── auth.js                # JWT + role-based access
│   ├── routes/
│   │   ├── auth.js                # POST /auth/signup, /login, /me
│   │   ├── activity.js            # POST/GET /activity
│   │   ├── verification.js        # POST /verify, GET /verify/pending
│   │   ├── score.js               # GET /score
│   │   ├── loan.js                # POST /loan/apply, GET /loan/status
│   │   └── admin.js               # Admin-only management routes
│   ├── services/
│   │   ├── blockchain.js          # ethers.js on-chain interactions
│   │   ├── scoreEngine.js         # Impact Score calculation + sync
│   │   └── ipfs.js                # Pinata IPFS upload
│   ├── scripts/
│   │   └── seed.js                # Sample data for development
│   └── server.js                  # Express entry point
│
└── frontend/                   # React.js + Tailwind CSS
    └── src/
        ├── context/
        │   └── AuthContext.jsx    # JWT auth + MetaMask wallet state
        ├── pages/
        │   ├── Landing.jsx        # Hero, features, tier overview
        │   ├── Login.jsx          # Email/password login
        │   ├── Signup.jsx         # Role-based registration
        │   ├── Dashboard.jsx      # Score + charts + activities + loans
        │   ├── SubmitActivity.jsx # Submit health/education/sustainability
        │   ├── VerifierPanel.jsx  # Approve/reject queue for verifiers
        │   ├── LoanApplication.jsx# Apply for a loan via smart contract
        │   └── AdminPanel.jsx     # Platform stats + user management
        ├── components/
        │   └── Navbar.jsx         # Responsive nav with wallet button
        └── utils/
            └── api.js             # Axios instance with JWT interceptor
```

---

## ⚡ Quick Start

### Prerequisites

- Node.js ≥ 18
- PostgreSQL ≥ 14
- MetaMask browser extension
- Git

---

### 1. Smart Contracts

```bash
cd contracts
npm install

# Start a local Hardhat node
npm run node

# In a new terminal — deploy to local node
npm run deploy:local
```

The deploy script prints contract addresses and saves them to `contracts/deployed-addresses.json`.

**Run tests:**
```bash
npm test
# or with gas report:
REPORT_GAS=true npm test
```

**Deploy to Polygon Mumbai testnet:**
```bash
# Set in contracts/.env:
POLYGON_MUMBAI_RPC=https://rpc-mumbai.maticvigil.com
DEPLOYER_PRIVATE_KEY=your_private_key_here
POLYGONSCAN_API_KEY=your_key_here

npm run deploy:mumbai
```

---

### 2. Backend

```bash
cd backend
npm install

# Copy and fill in environment variables
cp .env.example .env
```

**Configure `.env`:**
```env
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/impactscore
JWT_SECRET=your-32-char-secret
RPC_URL=http://127.0.0.1:8545        # or Mumbai RPC
BACKEND_WALLET_PRIVATE_KEY=0x...     # Hardhat account #0 for local dev
CONTRACT_ACTIVITY_REGISTRY=0x...     # From deployed-addresses.json
CONTRACT_IMPACT_SCORE=0x...
CONTRACT_LOAN_MANAGER=0x...
PINATA_JWT=                          # Optional — leave blank for mock IPFS
```

**Database setup:**
```bash
createdb impactscore
psql impactscore < config/001_init.sql

# Seed sample data (optional)
node scripts/seed.js
```

**Start the API:**
```bash
npm run dev       # Development (nodemon)
npm start         # Production
```

The API runs at `http://localhost:5000`. Test with:
```bash
curl http://localhost:5000/health
```

---

### 3. Frontend

```bash
cd frontend
npm install

# Optional: set API URL (defaults to proxy on :5000)
echo "REACT_APP_API_URL=http://localhost:5000" > .env

npm start
```

Opens at `http://localhost:3000`.

---

## 🔌 API Reference

| Method | Endpoint             | Auth         | Description                    |
|--------|----------------------|--------------|-------------------------------|
| POST   | `/auth/signup`       | —            | Register (email + role)        |
| POST   | `/auth/login`        | —            | Login → JWT                    |
| GET    | `/auth/me`           | Bearer       | Current user profile           |
| PUT    | `/auth/wallet`       | Bearer       | Connect MetaMask wallet        |
| POST   | `/activity`          | borrower     | Submit activity + doc upload   |
| GET    | `/activity`          | Bearer       | List activities (role-filtered)|
| GET    | `/verify/pending`    | verifier     | Queue of pending activities    |
| POST   | `/verify`            | verifier     | Approve or reject activity     |
| GET    | `/score`             | Bearer       | User's score + breakdown       |
| POST   | `/score/sync`        | Bearer       | Force re-sync from blockchain  |
| POST   | `/loan/apply`        | borrower     | Apply for micro-loan           |
| GET    | `/loan/status`       | Bearer       | List user's loans              |
| GET    | `/admin/users`       | admin        | All users with scores          |
| PATCH  | `/admin/users/:id/role` | admin     | Change user role               |
| GET    | `/admin/stats`       | admin        | Platform statistics            |

---

## ⛓️ Smart Contract Architecture

### Scoring Logic

```
Category        Weight    Example
─────────────────────────────────
health          +10 pts   Vaccination, checkup
education       +20 pts   Certificate, course
sustainability  +15 pts   NGO work, eco activities

MAX_SCORE = 1000
```

### Loan Decision Tree

```
Score > 80  →  LOW tier    5%  interest  max $5,000
Score > 50  →  MEDIUM tier 12% interest  max $2,000
Score 20-50 →  HIGH tier   20% interest  max $500
Score < 20  →  AUTO-REJECT
```

### Contract Addresses (after deployment)

Update these in `backend/.env` after running `scripts/deploy.js`.

---

## 🔐 Security Design

| Concern              | Solution                                              |
|----------------------|-------------------------------------------------------|
| Sensitive user data  | Stored off-chain in PostgreSQL (encrypted at rest)    |
| Documents            | IPFS (content-addressed, tamper-evident)              |
| Activity proofs      | Only keccak256 hashes stored on-chain                 |
| Authentication       | JWT (HS256, 7-day expiry) + bcrypt (12 rounds)        |
| Role enforcement     | Both backend middleware AND smart contract modifiers  |
| Rate limiting        | 100 req/15min global, 20 req/15min on auth routes     |
| Smart contract       | Only approved verifier wallets can write to chain     |

---

## 🚀 Deployment

### Smart Contracts → Polygon Amoy Testnet

```bash
# Get test MATIC from https://faucet.polygon.technology
cd contracts
npm run deploy:mumbai
```

### Backend → Railway / Render

```bash
# Railway
railway login
railway init
railway up

# Set env vars in Railway dashboard
```

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod

# Set REACT_APP_API_URL=https://your-backend.railway.app in Vercel env
```

---

## 🧪 Test Accounts (after seeding)

| Email                | Password    | Role      | Score |
|----------------------|-------------|-----------|-------|
| borrower@demo.com    | password123 | borrower  | 90    |
| borrower2@demo.com   | password123 | borrower  | 10    |
| verifier@demo.com    | password123 | verifier  | —     |
| lender@demo.com      | password123 | lender    | —     |
| admin@demo.com       | password123 | admin     | —     |

---

## 🎯 Bonus Features Implemented

- ✅ Mobile-responsive UI (Tailwind breakpoints throughout)
- ✅ Score visualization with Chart.js (donut + bar charts)
- ✅ IPFS document storage (Pinata integration)
- ✅ Fraud prevention — duplicate hash detection on-chain
- ✅ Score cap (MAX_SCORE = 1000) prevents overflow attacks
- ✅ Role-based access at both API and smart contract level

---

## 📜 License

MIT
