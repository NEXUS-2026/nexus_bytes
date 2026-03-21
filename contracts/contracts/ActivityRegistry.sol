// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ActivityRegistry
 * @notice Stores tamper-proof hashes of verified real-world activities
 *         linked to each user's wallet address.
 */
contract ActivityRegistry {
    // ─── Structs ────────────────────────────────────────────────────────────

    struct Activity {
        bytes32 dataHash;       // keccak256 of off-chain activity JSON
        string  category;       // "health" | "education" | "sustainability"
        uint256 timestamp;
        address verifier;       // who approved it on-chain
        bool    exists;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    // wallet → array of activity IDs
    mapping(address => uint256[]) private userActivityIds;
    // activityId → Activity
    mapping(uint256 => Activity)  private activities;
    // hash → already stored? (prevents duplicates)
    mapping(bytes32 => bool)      private hashExists;

    uint256 private nextId = 1;
    address public  owner;

    // Approved verifier wallets
    mapping(address => bool) public verifiers;

    // ─── Events ──────────────────────────────────────────────────────────────

    event ActivityStored(
        uint256 indexed activityId,
        address indexed user,
        bytes32         dataHash,
        string          category,
        address         verifier
    );
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ActivityRegistry: not owner");
        _;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender], "ActivityRegistry: not a verifier");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        verifiers[msg.sender] = true; // deployer is initial verifier
    }

    // ─── Admin functions ─────────────────────────────────────────────────────

    function addVerifier(address _v) external onlyOwner {
        verifiers[_v] = true;
        emit VerifierAdded(_v);
    }

    function removeVerifier(address _v) external onlyOwner {
        verifiers[_v] = false;
        emit VerifierRemoved(_v);
    }

    // ─── Core functions ──────────────────────────────────────────────────────

    /**
     * @notice Called by a verifier after approving an activity off-chain.
     * @param _user     The borrower's wallet address.
     * @param _dataHash keccak256 of the activity data stored in PostgreSQL.
     * @param _category Activity category string.
     * @return activityId The new on-chain activity ID.
     */
    function storeActivity(
        address _user,
        bytes32 _dataHash,
        string calldata _category
    ) external onlyVerifier returns (uint256 activityId) {
        require(_user != address(0), "ActivityRegistry: zero address");
        require(!hashExists[_dataHash], "ActivityRegistry: duplicate hash");
        require(bytes(_category).length > 0, "ActivityRegistry: empty category");

        activityId = nextId++;
        activities[activityId] = Activity({
            dataHash:  _dataHash,
            category:  _category,
            timestamp: block.timestamp,
            verifier:  msg.sender,
            exists:    true
        });

        userActivityIds[_user].push(activityId);
        hashExists[_dataHash] = true;

        emit ActivityStored(activityId, _user, _dataHash, _category, msg.sender);
    }

    // ─── View functions ──────────────────────────────────────────────────────

    function getActivity(uint256 _id)
        external
        view
        returns (
            bytes32 dataHash,
            string memory category,
            uint256 timestamp,
            address verifier
        )
    {
        Activity storage a = activities[_id];
        require(a.exists, "ActivityRegistry: not found");
        return (a.dataHash, a.category, a.timestamp, a.verifier);
    }

    function getUserActivityIds(address _user)
        external
        view
        returns (uint256[] memory)
    {
        return userActivityIds[_user];
    }

    function getActivityCount(address _user)
        external
        view
        returns (uint256)
    {
        return userActivityIds[_user].length;
    }

    function isHashStored(bytes32 _hash) external view returns (bool) {
        return hashExists[_hash];
    }
}
