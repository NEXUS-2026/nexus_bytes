// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ImpactScore.sol";

/**
 * @title LoanManager
 * @notice Automated micro-loan decisions based on Impact Score.
 *
 * Interest tiers:
 *   score > 80  → LOW    (5%)
 *   score > 50  → MEDIUM (12%)
 *   score ≤ 50  → HIGH   (20%) or REJECT if score < 20
 *
 * Loan amounts are simulated in smallest units (e.g. USD cents or
 * a stable-coin with 2 decimals). No real funds are transferred in
 * this contract — a lender backend handles actual disbursement.
 */
contract LoanManager {
    // ─── Enums & Structs ─────────────────────────────────────────────────────

    enum LoanStatus { PENDING, APPROVED, REJECTED, REPAID, DEFAULTED }
    enum InterestTier { NONE, LOW, MEDIUM, HIGH }

    struct Loan {
        address  borrower;
        uint256  amount;          // requested amount (in cents / stable unit)
        uint256  approvedAmount;  // may differ from requested
        uint256  interestRate;    // basis points (500 = 5%)
        uint256  durationDays;
        LoanStatus  status;
        InterestTier tier;
        uint256  score;           // score at time of application
        uint256  appliedAt;
        uint256  decidedAt;
        string   rejectionReason;
    }

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant SCORE_LOW_THRESHOLD    = 80;
    uint256 public constant SCORE_MEDIUM_THRESHOLD = 50;
    uint256 public constant SCORE_MIN_THRESHOLD    = 20;  // below → auto-reject

    uint256 public constant RATE_LOW    = 500;   // 5.00%
    uint256 public constant RATE_MEDIUM = 1200;  // 12.00%
    uint256 public constant RATE_HIGH   = 2000;  // 20.00%

    uint256 public constant MAX_LOAN_LOW    = 500_000;   // $5,000
    uint256 public constant MAX_LOAN_MEDIUM = 200_000;   // $2,000
    uint256 public constant MAX_LOAN_HIGH   = 50_000;    // $500

    // ─── State ───────────────────────────────────────────────────────────────

    ImpactScore public impactScore;
    address     public owner;

    mapping(uint256 => Loan)        private loans;
    mapping(address => uint256[])   private userLoans;
    uint256 private nextLoanId = 1;

    // Authorized lenders who can approve/reject
    mapping(address => bool) public lenders;

    // ─── Events ──────────────────────────────────────────────────────────────

    event LoanApplied(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 score);
    event LoanApproved(uint256 indexed loanId, uint256 approvedAmount, uint256 interestRate, InterestTier tier);
    event LoanRejected(uint256 indexed loanId, string reason);
    event LoanRepaid(uint256 indexed loanId);
    event LenderAdded(address indexed lender);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "LoanManager: not owner");
        _;
    }

    modifier onlyLender() {
        require(lenders[msg.sender] || msg.sender == owner, "LoanManager: not a lender");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _impactScore) {
        require(_impactScore != address(0), "LoanManager: zero address");
        impactScore = ImpactScore(_impactScore);
        owner       = msg.sender;
        lenders[msg.sender] = true;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function addLender(address _lender) external onlyOwner {
        lenders[_lender] = true;
        emit LenderAdded(_lender);
    }

    function updateImpactScore(address _impactScore) external onlyOwner {
        impactScore = ImpactScore(_impactScore);
    }

    // ─── Borrower functions ──────────────────────────────────────────────────

    /**
     * @notice Borrower submits a loan application.
     * @param _amount      Requested amount in stable-unit cents.
     * @param _durationDays Requested repayment period.
     * @return loanId
     */
    function applyLoan(uint256 _amount, uint256 _durationDays)
        external
        returns (uint256 loanId)
    {
        require(_amount > 0, "LoanManager: zero amount");
        require(_durationDays >= 7 && _durationDays <= 365, "LoanManager: invalid duration");

        uint256 score = impactScore.getScore(msg.sender);
        (InterestTier tier, uint256 rate, uint256 maxAmount) = calculateLoanTerms(score);

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower:        msg.sender,
            amount:          _amount,
            approvedAmount:  0,
            interestRate:    rate,
            durationDays:    _durationDays,
            status:          LoanStatus.PENDING,
            tier:            tier,
            score:           score,
            appliedAt:       block.timestamp,
            decidedAt:       0,
            rejectionReason: ""
        });

        userLoans[msg.sender].push(loanId);
        emit LoanApplied(loanId, msg.sender, _amount, score);

        // Auto-reject if score too low
        if (score < SCORE_MIN_THRESHOLD) {
            loans[loanId].status = LoanStatus.REJECTED;
            loans[loanId].rejectionReason = "Score below minimum threshold";
            loans[loanId].decidedAt = block.timestamp;
            emit LoanRejected(loanId, "Score below minimum threshold");
        } else {
            // Auto-approve up to the tier limit; remainder flagged for manual review
            uint256 approved = _amount <= maxAmount ? _amount : maxAmount;
            loans[loanId].approvedAmount = approved;
            loans[loanId].status   = LoanStatus.APPROVED;
            loans[loanId].decidedAt = block.timestamp;
            emit LoanApproved(loanId, approved, rate, tier);
        }
    }

    /**
     * @notice Lender manually overrides a pending loan decision.
     */
    function approveLoan(uint256 _loanId, uint256 _approvedAmount)
        external
        onlyLender
    {
        Loan storage loan = loans[_loanId];
        require(loan.borrower != address(0), "LoanManager: not found");
        require(loan.status == LoanStatus.PENDING, "LoanManager: not pending");

        loan.approvedAmount = _approvedAmount;
        loan.status         = LoanStatus.APPROVED;
        loan.decidedAt      = block.timestamp;
        emit LoanApproved(_loanId, _approvedAmount, loan.interestRate, loan.tier);
    }

    function rejectLoan(uint256 _loanId, string calldata _reason)
        external
        onlyLender
    {
        Loan storage loan = loans[_loanId];
        require(loan.borrower != address(0), "LoanManager: not found");
        require(loan.status == LoanStatus.PENDING, "LoanManager: not pending");

        loan.status          = LoanStatus.REJECTED;
        loan.rejectionReason = _reason;
        loan.decidedAt       = block.timestamp;
        emit LoanRejected(_loanId, _reason);
    }

    function markRepaid(uint256 _loanId) external onlyLender {
        Loan storage loan = loans[_loanId];
        require(loan.status == LoanStatus.APPROVED, "LoanManager: not approved");
        loan.status = LoanStatus.REPAID;
        emit LoanRepaid(_loanId);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /**
     * @notice Pure score-to-terms calculation — call this before applying.
     */
    function calculateLoanTerms(uint256 _score)
        public
        pure
        returns (InterestTier tier, uint256 rate, uint256 maxAmount)
    {
        if (_score > SCORE_LOW_THRESHOLD) {
            return (InterestTier.LOW, RATE_LOW, MAX_LOAN_LOW);
        } else if (_score > SCORE_MEDIUM_THRESHOLD) {
            return (InterestTier.MEDIUM, RATE_MEDIUM, MAX_LOAN_MEDIUM);
        } else {
            return (InterestTier.HIGH, RATE_HIGH, MAX_LOAN_HIGH);
        }
    }

    function getLoan(uint256 _loanId)
        external
        view
        returns (Loan memory)
    {
        require(loans[_loanId].borrower != address(0), "LoanManager: not found");
        return loans[_loanId];
    }

    function getUserLoans(address _user)
        external
        view
        returns (uint256[] memory)
    {
        return userLoans[_user];
    }

    function getLoanCount() external view returns (uint256) {
        return nextLoanId - 1;
    }
}
