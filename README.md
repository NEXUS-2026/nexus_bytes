# 🌟 ImpactScore — Blockchain-Enabled Micro-Finance Ecosystem

A decentralized micro-finance platform that enables underserved users (e.g. street vendors) to access loans using a dynamic **Impact Score** instead of traditional credit history.

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
│   ├── config/db.js            # MongoDB Atlas connection
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

## 🏗️ How It Works

**Workflow**: Borrower submits activity → Verifier approves & writes to blockchain → Score recalculated → Lender sees tier & approves/rejects loan

**Key Components**:

- **Backend (Node.js)**: Express API with JWT auth, MongoDB Atlas database, ethers.js blockchain integration, Pinata IPFS
- **Smart Contracts (Solidity)**: ActivityRegistry (stores activity hashes), ImpactScore (maintains scores), LoanManager (tier-based decisions)
- **Frontend (React)**: Role-based dashboard, MetaMask wallet binding, Chart.js visualizations

---

## ⚡ Quick Start

### Prerequisites

- Node.js ≥ 18
- MongoDB Atlas cluster (or local MongoDB for development)
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
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=<app-name>
MONGODB_DB_NAME=impactscore
JWT_SECRET=your-32-char-secret
RPC_URL=http://127.0.0.1:8545        # or Mumbai RPC
BACKEND_WALLET_PRIVATE_KEY=0x...     # Hardhat account #0 for local dev
CONTRACT_ACTIVITY_REGISTRY=0x...     # From deployed-addresses.json
CONTRACT_IMPACT_SCORE=0x...
CONTRACT_LOAN_MANAGER=0x...
PINATA_JWT=                          # Preferred Pinata auth
# or use PINATA_API_KEY and PINATA_API_SECRET
PINATA_API_KEY=
PINATA_API_SECRET=
IPFS_GATEWAY_BASE=                   # Optional (defaults to Pinata gateway)
```

### Pinata Setup (Recommended for real document links)

Why Pinata is used:

- The app stores uploaded activity documents on IPFS and keeps only references in the DB.
- Pinata makes IPFS pinning reliable and keeps files available (instead of temporary/mock local links).
- Verifiers can open borrower documents through stable gateway URLs.

Steps to configure Pinata:

1. Create a Pinata account at https://pinata.cloud.
2. In Pinata, create an API key (or JWT) with `pinFileToIPFS` permission.
3. In `backend/.env`, set one of:
   - `PINATA_JWT=<your_jwt>`
   - or `PINATA_API_KEY=<your_key>` and `PINATA_API_SECRET=<your_secret>`
4. Optional: set `IPFS_GATEWAY_BASE` if you want a custom gateway.
5. Restart backend (`npm run dev` in `backend`).

Behavior after setup:

- New uploaded activity documents are pinned to IPFS via Pinata.
- Verifier "Document" button opens IPFS gateway URL directly.
- If Pinata credentials are missing, app automatically falls back to local file storage for development.

**Database setup:**

1. Create a MongoDB Atlas cluster and database user.
2. Whitelist your IP in Atlas Network Access.
3. Put the connection string in `MONGODB_URI` in `backend/.env`.

Then seed sample data (optional):

```bash
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

## 🔌 API Endpoints

| Category       | Endpoints                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Auth**       | `POST /auth/signup` • `POST /auth/login` • `GET /auth/me` • `PUT /auth/wallet`                                     |
| **Activities** | `POST /activity` (borrower) • `GET /activity` • `GET /verify/pending` (verifier) • `POST /verify` (approve/reject) |
| **Scoring**    | `GET /score` • `POST /score/sync`                                                                                  |
| **Loans**      | `POST /loan/apply` • `GET /loan/status` • `GET /loan/pending` (lender) • `POST /loan/:id/decide` (lender)          |
| **Admin**      | `GET /admin/users` • `PATCH /admin/users/:id/role` • `GET /admin/stats`                                            |

---

## ⛓️ Smart Contracts

| Contract             | Purpose                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **ActivityRegistry** | Stores verified activity hashes on-chain; only verifiers can write; prevents duplicates                                    |
| **ImpactScore**      | Maintains wallet → score mapping; category weights: health +10, education +20, sustainability +15; capped at 1000          |
| **LoanManager**      | Score > 80 → LOW tier (5%, max $5k) • Score > 50 → MEDIUM (12%, $2k) • Score ≥ 20 → HIGH (20%, $500) • Score < 20 → REJECT |

---

## 🔐 Security

- **Auth**: JWT (7-day expiry), bcrypt password hashing (12 rounds)
- **API**: Rate limiting (100 req/15min global, 20 req/15min auth), Helmet headers, CORS
- **Data**: MongoDB Atlas off-chain storage, IPFS for documents, only hashes on-chain
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
