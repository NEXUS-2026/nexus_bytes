# 🌟 ImpactScore — Blockchain-Enabled Micro-Finance Ecosystem

**A fully decentralized micro-finance platform built on blockchain principles** enabling underserved users (street vendors, gig workers, informal economy) to access loans through a **tamper-proof Impact Score** instead of centralized credit history.

**Blockchain-first architecture:** Every activity verification, score update, and loan decision is recorded immutably on-chain (Polygon Mumbai), creating an auditable, transparent, and manipulation-resistant lending ecosystem.

---

## 📁 Project Structure

```
impactscore/
├── contracts/                  # Solidity smart contracts (Hardhat)
│   ├── ActivityRegistry.sol    # Stores verified activity hashes on-chain
│   ├── ImpactScore.sol         # Manages wallet scores with category weights (capped at 1000)
│   ├── LoanManager.sol         # Automated score-based loan tier decisions
│   ├── deploy.js               # Deployment script
│   └── test/contracts.test.js  # Unit tests
│
├── backend/                    # Node.js + Express
│   ├── config/db.js            # PostgreSQL connection
│   ├── middleware/auth.js      # JWT + role-based access
│   ├── routes/                 # API endpoints (auth, activity, verification, score, loan, admin)
│   ├── services/               # blockchain.js, scoreEngine.js, ipfs.js
│   ├── scripts/seed.js         # Database seeding
│   └── server.js               # Express server
│
└── frontend/                   # React.js + Tailwind CSS
    ├── context/AuthContext.jsx # JWT & MetaMask integration
    ├── pages/                  # Dashboard, SubmitActivity, VerifierPanel, LoanApplication, etc.
    ├── components/Navbar.jsx   # Navigation
    └── utils/api.js            # Axios with JWT interceptor
```

---

## 🏗️ How It Works — Blockchain-Powered Trust

**Workflow**: Borrower submits activity → Verifier approves → **Activity hash stored immutably on-chain** → Score updated via smart contract → Lender reviews on-chain history → Loan decision executes automatically

**Key Blockchain Principles**:
- **Immutability**: Every verified activity is recorded as a permanent hash on-chain (ActivityRegistry contract) — no retroactive modification.
- **Transparency**: All verifications and score updates are publicly auditable on the Polygon blockchain.
- **Smart Contract Enforcement**: Scoring rules, tier calculations, and access controls are encoded in contracts — enforced by the network, not bypassed by individuals.
- **Decentralized Verification**: Verifier credentials and permissions are managed on-chain; any approved verifier can record activities globally.
- **Permanent Audit Trail**: Complete record of borrower activity history, verification decisions, and lending offers — immutable and cryptographically verified.

**Architecture**:
- **ActivityRegistry (on-chain)**: Stores normalized hashes of verified activities, preventing duplicates and creating an auditable ledger.
- **ImpactScore (on-chain)**: Maintains borrower scores as a transparent, rule-based state machine; score updates only via allowed verifier calls.
- **LoanManager (on-chain)**: Calculates loan tiers and interest rates deterministically from on-chain scores — no hidden logic, no manipulation.
- **PostgreSQL Off-chain**: Stores activity metadata and user profiles (privacy); on-chain stores only hashes for audit + transparency.

---

## 🔐 Blockchain-First Features

✅ **Immutable Activity Ledger** — Every verified activity recorded on Polygon as a permanent hash; no retroactive modifications.

✅ **Smart Contract Enforcement** — Scoring rules and tier calculations encoded in contracts; executed by the network, not individuals. **No hidden logic, no manipulation.**

✅ **Decentralized Verification** — Verifiers registered on-chain; any approved verifier globally can approve activities. Censorship-resistant and transparent.

✅ **Transparent Audit Trail** — Complete queryable history of all activities, verifications, scores, and lending decisions. Public on blockchain.

✅ **Trustless Lending** — Users don't trust a company or bank; they trust math encoded in smart contracts. Verified by network consensus.

✅ **On-Chain Governance Ready** — Architecture supports future DAO governance: community votes on categories, thresholds, and verifier onboarding.

**→ Read our [BLOCKCHAIN.md](BLOCKCHAIN.md) for deep dive into architecture, smart contract design, and why blockchain matters here.**

---

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
npm run seed
```

**Start the API:**
```bash
npm run dev       # Development (nodemon)
npm start         # Production
```

**Ensure admin login (recommended for demos):**
```bash
npm run ensure-admin
# default credentials: admin@demo.com / password123
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

## 🔌 API Endpoints

| Category | Endpoints |
|----------|-----------|
| **Auth** | `POST /auth/signup` • `POST /auth/login` • `GET /auth/me` • `PUT /auth/wallet` |
| **Activities** | `POST /activity` (borrower) • `GET /activity` • `GET /verify/pending` (verifier) • `POST /verify` (approve/reject) |
| **Scoring** | `GET /score` • `POST /score/sync` |
| **Loans** | `POST /loan/apply` • `GET /loan/status` • `GET /loan/pending` (lender) • `POST /loan/:id/decide` (lender) |
| **Admin** | `GET /admin/users` • `PATCH /admin/users/:id/role` • `GET /admin/stats` |

---

## ⛓️ Smart Contracts

| Contract | Purpose |
|----------|---------|
| **ActivityRegistry** | Stores verified activity hashes on-chain; only verifiers can write; prevents duplicates |
| **ImpactScore** | Maintains wallet → score mapping; category weights: health +10, education +20, sustainability +15; capped at 1000 |
| **LoanManager** | Score > 80 → LOW tier (5%, max $5k) • Score > 50 → MEDIUM (12%, $2k) • Score ≥ 20 → HIGH (20%, $500) • Score < 20 → REJECT

---

## 🔐 Security

- **Auth**: JWT (7-day expiry), bcrypt password hashing (12 rounds)
- **API**: Rate limiting (100 req/15min global, 20 req/15min auth), Helmet headers, CORS
- **Data**: PostgreSQL off-chain storage, IPFS for documents, only hashes on-chain
- **Access**: Role-based middleware + smart contract modifiers
- **Fraud Prevention**: Duplicate hash detection on-chain, score cap at 1000

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


## ✨ Key Features

- ✅ Role-based access (Borrower, Verifier, Lender, Admin)
- ✅ Activity submission with file upload & IPFS storage
- ✅ Automatic score calculation from verified activities
- ✅ Score-based loan tier system with lender override
- ✅ On-chain activity hashing for fraud prevention
- ✅ MetaMask wallet integration
- ✅ Real-time EMI calculator
- ✅ Admin dashboard with platform stats
- ✅ Mobile-responsive UI (Tailwind CSS)
- ✅ Data visualization (Chart.js)

---

### Video:- https://drive.google.com/file/d/1hapgdRoNvuXHXSqJ0EImfyuqEN7uAF89/view?usp=sharing
