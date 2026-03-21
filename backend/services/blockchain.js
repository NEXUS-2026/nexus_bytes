// services/blockchain.js
// Handles all on-chain interactions via ethers.js.
// The backend wallet acts as the "verifier" trusted by the contracts.

const { ethers } = require("ethers");
require("dotenv").config();

// ─── ABIs (minimal, only functions we call) ───────────────────────────────────

const ACTIVITY_REGISTRY_ABI = [
  "function storeActivity(address _user, bytes32 _dataHash, string calldata _category) external returns (uint256)",
  "function getUserActivityIds(address _user) external view returns (uint256[])",
  "function getActivity(uint256 _id) external view returns (bytes32, string, uint256, address)",
  "event ActivityStored(uint256 indexed activityId, address indexed user, bytes32 dataHash, string category, address verifier)",
];

const IMPACT_SCORE_ABI = [
  "function getScore(address _user) external view returns (uint256)",
  "function setScore(address _user, uint256 _score) external",
];

const LOAN_MANAGER_ABI = [
  "function applyLoan(uint256 _amount, uint256 _durationDays) external returns (uint256)",
  "function calculateLoanTerms(uint256 _score) external pure returns (uint8, uint256, uint256)",
  "function getLoan(uint256 _loanId) external view returns (tuple(address,uint256,uint256,uint256,uint256,uint8,uint8,uint256,uint256,uint256,string))",
  "event LoanApproved(uint256 indexed loanId, uint256 approvedAmount, uint256 interestRate, uint8 tier)",
  "event LoanRejected(uint256 indexed loanId, string reason)",
];

// ─── Setup ────────────────────────────────────────────────────────────────────

let provider, backendWallet;

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  }
  return provider;
}

function getSigner() {
  if (!backendWallet) {
    if (!process.env.BACKEND_WALLET_PRIVATE_KEY) {
      throw new Error("BACKEND_WALLET_PRIVATE_KEY not set");
    }
    backendWallet = new ethers.Wallet(
      process.env.BACKEND_WALLET_PRIVATE_KEY,
      getProvider()
    );
  }
  return backendWallet;
}

function getContract(address, abi, withSigner = false) {
  return new ethers.Contract(address, abi, withSigner ? getSigner() : getProvider());
}

// ─── Activity Registry ────────────────────────────────────────────────────────

/**
 * Stores an approved activity hash on-chain.
 * @returns { txHash, activityId }
 */
async function storeActivityOnChain(borrowerWallet, dataHashHex, category) {
  const contract = getContract(
    process.env.CONTRACT_ACTIVITY_REGISTRY,
    ACTIVITY_REGISTRY_ABI,
    true
  );

  // Normalise hex to bytes32
  const bytes32Hash = dataHashHex.startsWith("0x")
    ? dataHashHex.padEnd(66, "0")
    : "0x" + dataHashHex.padEnd(64, "0");

  const tx       = await contract.storeActivity(borrowerWallet, bytes32Hash, category);
  const receipt  = await tx.wait();

  // Extract activityId from event
  const iface      = new ethers.Interface(ACTIVITY_REGISTRY_ABI);
  let activityId   = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === "ActivityStored") {
        activityId = Number(parsed.args.activityId);
        break;
      }
    } catch {}
  }

  return { txHash: receipt.hash, activityId };
}

// ─── Impact Score ─────────────────────────────────────────────────────────────

/**
 * Reads the on-chain score for a wallet address.
 */
async function getOnChainScore(walletAddress) {
  if (!walletAddress) return 0;
  const contract = getContract(
    process.env.CONTRACT_IMPACT_SCORE,
    IMPACT_SCORE_ABI
  );
  const score = await contract.getScore(walletAddress);
  return Number(score);
}

// ─── Loan Manager ─────────────────────────────────────────────────────────────

/**
 * Submits a loan application on-chain via the backend wallet acting as proxy.
 * NOTE: In production the borrower would sign this tx themselves.
 * For demo purposes the backend wallet submits on their behalf.
 */
async function applyLoanOnChain(userId, amountCents, durationDays) {
  const contract = getContract(
    process.env.CONTRACT_LOAN_MANAGER,
    LOAN_MANAGER_ABI,
    true
  );

  const tx      = await contract.applyLoan(amountCents, durationDays);
  const receipt = await tx.wait();

  const iface  = new ethers.Interface(LOAN_MANAGER_ABI);
  let loanId   = null;
  let status   = "pending";

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === "LoanApproved") {
        loanId = Number(parsed.args.loanId);
        status = "approved";
        break;
      }
      if (parsed.name === "LoanRejected") {
        loanId = Number(parsed.args.loanId);
        status = "rejected";
        break;
      }
    } catch {}
  }

  return { txHash: receipt.hash, loanId, status };
}

/**
 * Preview loan terms without spending gas.
 */
async function previewLoanTerms(score) {
  const contract = getContract(
    process.env.CONTRACT_LOAN_MANAGER,
    LOAN_MANAGER_ABI
  );
  const [tier, rate, maxAmount] = await contract.calculateLoanTerms(score);
  return {
    tier:       ["none", "low", "medium", "high"][Number(tier)] || "none",
    rateRaw:    Number(rate),      // basis points (500 = 5%)
    ratePct:    Number(rate) / 100,
    maxAmount:  Number(maxAmount), // in cents
  };
}

module.exports = {
  storeActivityOnChain,
  getOnChainScore,
  applyLoanOnChain,
  previewLoanTerms,
};
