// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ImpactScore
 * @notice Maintains a score for each user wallet.
 *         Score is updated by the ActivityRegistry whenever a verified
 *         activity is recorded. Only the ActivityRegistry (or owner) can
 *         update scores — preventing manipulation.
 *
 * Scoring weights:
 *   health         → +10
 *   education      → +20
 *   sustainability → +15
 */
contract ImpactScore {
    // ─── State ───────────────────────────────────────────────────────────────

    mapping(address => uint256) private scores;
    mapping(address => uint256) private lastUpdated;

    address public owner;
    address public activityRegistry; // only this contract may call updateScore

    // Category weights (basis points, not percent, for future flexibility)
    uint256 public constant WEIGHT_HEALTH         = 10;
    uint256 public constant WEIGHT_EDUCATION      = 20;
    uint256 public constant WEIGHT_SUSTAINABILITY = 15;

    uint256 public constant MAX_SCORE = 1000; // cap to prevent overflow abuse

    // ─── Events ──────────────────────────────────────────────────────────────

    event ScoreUpdated(address indexed user, uint256 delta, uint256 newScore, string category);
    event RegistrySet(address indexed registry);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ImpactScore: not owner");
        _;
    }

    modifier onlyRegistry() {
        require(
            msg.sender == activityRegistry || msg.sender == owner,
            "ImpactScore: caller not registry"
        );
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /**
     * @notice Link this contract to the deployed ActivityRegistry.
     *         Must be called once after both contracts are deployed.
     */
    function setActivityRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "ImpactScore: zero address");
        activityRegistry = _registry;
        emit RegistrySet(_registry);
    }

    // ─── Core ────────────────────────────────────────────────────────────────

    /**
     * @notice Add score points based on activity category.
     *         Called by the ActivityRegistry after storing a new activity.
     * @param _user     Borrower wallet.
     * @param _category Activity category string.
     */
    function updateScore(address _user, string calldata _category)
        external
        onlyRegistry
    {
        require(_user != address(0), "ImpactScore: zero address");

        uint256 delta = _categoryWeight(_category);
        require(delta > 0, "ImpactScore: unknown category");

        uint256 current = scores[_user];
        uint256 newScore = current + delta;
        if (newScore > MAX_SCORE) newScore = MAX_SCORE;

        scores[_user]       = newScore;
        lastUpdated[_user]  = block.timestamp;

        emit ScoreUpdated(_user, delta, newScore, _category);
    }

    /**
     * @notice Directly set a user's score (admin override / re-sync).
     */
    function setScore(address _user, uint256 _score) external onlyOwner {
        require(_score <= MAX_SCORE, "ImpactScore: exceeds max");
        scores[_user] = _score;
        lastUpdated[_user] = block.timestamp;
        emit ScoreUpdated(_user, 0, _score, "admin");
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getScore(address _user) external view returns (uint256) {
        return scores[_user];
    }

    function getLastUpdated(address _user) external view returns (uint256) {
        return lastUpdated[_user];
    }

    /**
     * @notice Returns category weight.
     *         Exposed publicly so the front-end can preview scores.
     */
    function categoryWeight(string calldata _category)
        external
        pure
        returns (uint256)
    {
        return _categoryWeight(_category);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _categoryWeight(string calldata _category)
        internal
        pure
        returns (uint256)
    {
        bytes32 h = keccak256(bytes(_category));
        if (h == keccak256("health"))         return WEIGHT_HEALTH;
        if (h == keccak256("education"))      return WEIGHT_EDUCATION;
        if (h == keccak256("sustainability")) return WEIGHT_SUSTAINABILITY;
        return 0;
    }
}
