// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  RestakingGuard
/// @author StakeGuard (Hackathon MVP)
/// @notice On-chain restaking risk registry that tracks validator allocations,
///         detects Byzantine AVS failures, executes proportional slashing, and
///         emits cascade risk warnings when secondary services are endangered.
///
/// @dev    Inspired by "Elastic Restaking Networks" (Technion, 2024).
///         The contract models the paper's core insight: a single Byzantine AVS
///         can cascade slashing across the entire restaking network. This contract
///         makes that risk observable and enforceable on-chain.
///
///         Key design decisions:
///         - Basis points (BPS) throughout for precision without floating point
///         - Cascade threshold: 5000 BPS (50%) of an AVS's validators slashed
///         - Risk score: stake-weighted (55%) + cascade breadth (45%)
///         - Owner-only mutations; open reads for transparency
///         - All state changes emit events for off-chain indexing

contract RestakingGuard {

    // ── Constants ─────────────────────────────────────────────────────────────

    /// @notice 100% in basis points
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Cascade triggers when this fraction of an AVS's validators are slashed
    /// @dev 5000 BPS = 50%
    uint256 public constant CASCADE_THRESHOLD_BPS = 5_000;

    /// @notice Maximum slash percentage allowed per incident (circuit breaker)
    /// @dev 5000 BPS = 50%
    uint256 public constant MAX_SLASH_BPS = 5_000;

    /// @notice Weight of primary stake damage in risk score calculation
    /// @dev out of 100
    uint256 public constant PRIMARY_RISK_WEIGHT = 55;

    /// @notice Weight of cascade breadth in risk score calculation
    /// @dev out of 100
    uint256 public constant CASCADE_RISK_WEIGHT = 45;

    // ── Storage ───────────────────────────────────────────────────────────────

    address public owner;

    /// @notice Total ETH stake registered in the network (wei)
    uint256 public totalNetworkStake;

    /// @notice Total ETH slashed across all incidents (wei)
    uint256 public totalSlashedStake;

    /// @notice Latest computed network risk score (0–99)
    uint256 public networkRiskScore;

    /// @notice Number of AVS services currently registered
    uint256 public avsCount;

    // Validator storage
    struct ValidatorRecord {
        uint256 totalStake;
        uint256 slashedStake;
        bool    active;
        // tracks which AVS this validator is allocated to
        bytes32[] services;
        // tracks slash events per AVS (avsId => slashed)
        mapping(bytes32 => bool) slashedBy;
    }

    // AVS storage
    struct AVSRecord {
        string  name;
        uint256 totalTVL;
        bool    byzantine;
        bool    cascadeRisk;
        bool    active;
        // validators allocated to this AVS
        bytes32[] validators;
        // set membership for O(1) lookup
        mapping(bytes32 => bool) hasValidator;
        // allocation index for O(1) removal
        mapping(bytes32 => uint256) validatorIndex;
    }

    mapping(bytes32 => ValidatorRecord) private _validators;
    mapping(bytes32 => AVSRecord)       private _avs;

    // All registered IDs for enumeration
    bytes32[] public allValidatorIds;
    bytes32[] public allAvsIds;

    // ── Events ────────────────────────────────────────────────────────────────

    event ValidatorRegistered(bytes32 indexed validatorId, uint256 stake);
    event AVSRegistered(bytes32 indexed avsId, string name, uint256 tvl);
    event ValidatorAllocated(bytes32 indexed validatorId, bytes32 indexed avsId);
    event ValidatorDeallocated(bytes32 indexed validatorId, bytes32 indexed avsId);
    event AVSFlaggedByzantine(bytes32 indexed avsId, address indexed reporter, uint256 timestamp);
    event ValidatorSlashed(
        bytes32 indexed validatorId,
        bytes32 indexed byzantineAvsId,
        uint256 slashedAmount,
        uint256 remainingStake,
        uint256 timestamp
    );
    event CascadeRiskDetected(
        bytes32 indexed secondaryAvsId,
        uint256 slashedCount,
        uint256 totalCount,
        uint256 riskBps,
        uint256 timestamp
    );
    event RiskScoreUpdated(
        uint256 newScore,
        uint256 totalSlashedStake,
        uint256 totalNetworkStake,
        uint256 timestamp
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Errors ────────────────────────────────────────────────────────────────

    error Unauthorized();
    error ValidatorAlreadyRegistered(bytes32 id);
    error ValidatorNotFound(bytes32 id);
    error AVSAlreadyRegistered(bytes32 id);
    error AVSNotFound(bytes32 id);
    error AlreadyAllocated(bytes32 validatorId, bytes32 avsId);
    error NotAllocated(bytes32 validatorId, bytes32 avsId);
    error AVSAlreadyByzantine(bytes32 id);
    error ValidatorAlreadySlashedByAVS(bytes32 validatorId, bytes32 avsId);
    error SlashExceedsMax(uint256 provided, uint256 max);
    error InsufficientStake(bytes32 validatorId);
    error ZeroStake();

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier validatorExists(bytes32 id) {
        if (!_validators[id].active) revert ValidatorNotFound(id);
        _;
    }

    modifier avsExists(bytes32 id) {
        if (!_avs[id].active) revert AVSNotFound(id);
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Unauthorized();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── Registration ──────────────────────────────────────────────────────────

    /// @notice Register a new validator with its total stake
    /// @param validatorId  Unique identifier (e.g. keccak256 of validator pubkey)
    /// @param stake        Total stake in wei
    function registerValidator(bytes32 validatorId, uint256 stake) external onlyOwner {
        if (_validators[validatorId].active) revert ValidatorAlreadyRegistered(validatorId);
        if (stake == 0) revert ZeroStake();

        _validators[validatorId].totalStake = stake;
        _validators[validatorId].active = true;

        totalNetworkStake += stake;
        allValidatorIds.push(validatorId);

        emit ValidatorRegistered(validatorId, stake);
    }

    /// @notice Register a new AVS service
    /// @param avsId  Unique identifier (e.g. keccak256 of AVS address)
    /// @param name   Human-readable name
    /// @param tvl    Total value locked in wei
    function registerAVS(
        bytes32 avsId,
        string calldata name,
        uint256 tvl
    ) external onlyOwner {
        if (_avs[avsId].active) revert AVSAlreadyRegistered(avsId);

        _avs[avsId].name    = name;
        _avs[avsId].totalTVL = tvl;
        _avs[avsId].active  = true;

        avsCount++;
        allAvsIds.push(avsId);

        emit AVSRegistered(avsId, name, tvl);
    }

    // ── Allocation ────────────────────────────────────────────────────────────

    /// @notice Allocate a validator to an AVS (validator will secure that service)
    function allocateValidator(
        bytes32 validatorId,
        bytes32 avsId
    ) external onlyOwner validatorExists(validatorId) avsExists(avsId) {
        if (_avs[avsId].hasValidator[validatorId])
            revert AlreadyAllocated(validatorId, avsId);

        // Add validator to AVS
        _avs[avsId].validatorIndex[validatorId] = _avs[avsId].validators.length;
        _avs[avsId].validators.push(validatorId);
        _avs[avsId].hasValidator[validatorId] = true;

        // Add AVS to validator's service list
        _validators[validatorId].services.push(avsId);

        emit ValidatorAllocated(validatorId, avsId);
    }

    /// @notice Remove a validator's allocation from an AVS
    function deallocateValidator(
        bytes32 validatorId,
        bytes32 avsId
    ) external onlyOwner validatorExists(validatorId) avsExists(avsId) {
        if (!_avs[avsId].hasValidator[validatorId])
            revert NotAllocated(validatorId, avsId);

        // Swap-and-pop from AVS validators array
        uint256 idx = _avs[avsId].validatorIndex[validatorId];
        uint256 last = _avs[avsId].validators.length - 1;
        if (idx != last) {
            bytes32 lastId = _avs[avsId].validators[last];
            _avs[avsId].validators[idx] = lastId;
            _avs[avsId].validatorIndex[lastId] = idx;
        }
        _avs[avsId].validators.pop();
        delete _avs[avsId].hasValidator[validatorId];
        delete _avs[avsId].validatorIndex[validatorId];

        // Remove from validator's service list
        bytes32[] storage services = _validators[validatorId].services;
        for (uint256 i = 0; i < services.length; i++) {
            if (services[i] == avsId) {
                services[i] = services[services.length - 1];
                services.pop();
                break;
            }
        }

        emit ValidatorDeallocated(validatorId, avsId);
    }

    // ── Byzantine Detection & Slashing ────────────────────────────────────────

    /// @notice Flag an AVS as Byzantine (misbehaving or compromised)
    /// @dev    In production this would require quorum signatures or a fraud proof.
    ///         For the hackathon MVP, owner controls this flag.
    function reportByzantine(bytes32 avsId) external onlyOwner avsExists(avsId) {
        if (_avs[avsId].byzantine) revert AVSAlreadyByzantine(avsId);

        _avs[avsId].byzantine = true;

        emit AVSFlaggedByzantine(avsId, msg.sender, block.timestamp);
    }

    /// @notice Execute slashing on all validators allocated to a Byzantine AVS
    /// @param  avsId      The Byzantine AVS
    /// @param  slashBps   Slash percentage in basis points (e.g. 3000 = 30%)
    ///
    /// @dev    This implements the paper's elastic slashing model:
    ///         each validator loses slashBps of their stake proportionally.
    ///         After slashing, cascade risk is computed for all other services.
    function executeSlashing(
        bytes32 avsId,
        uint256 slashBps
    ) external onlyOwner avsExists(avsId) {
        if (!_avs[avsId].byzantine) revert AVSNotFound(avsId); // must be flagged first
        if (slashBps > MAX_SLASH_BPS) revert SlashExceedsMax(slashBps, MAX_SLASH_BPS);

        bytes32[] memory validators = _avs[avsId].validators;
        uint256 len = validators.length;

        for (uint256 i = 0; i < len; i++) {
            bytes32 vId = validators[i];
            ValidatorRecord storage v = _validators[vId];

            // Skip already-slashed-by-this-avs validators
            if (v.slashedBy[avsId]) continue;

            uint256 remaining = v.totalStake - v.slashedStake;
            if (remaining == 0) continue;

            uint256 slashAmount = (remaining * slashBps) / BPS_DENOMINATOR;
            v.slashedStake += slashAmount;
            v.slashedBy[avsId] = true;

            totalSlashedStake += slashAmount;

            emit ValidatorSlashed(
                vId,
                avsId,
                slashAmount,
                v.totalStake - v.slashedStake,
                block.timestamp
            );
        }

        // ── Cascade detection ────────────────────────────────────────────────
        // For each other active AVS, check if ≥50% of its validators were slashed
        uint256 totalAVS = allAvsIds.length;
        uint256 cascadedCount = 0;

        for (uint256 i = 0; i < totalAVS; i++) {
            bytes32 otherAvsId = allAvsIds[i];
            if (otherAvsId == avsId) continue;
            if (!_avs[otherAvsId].active) continue;

            bytes32[] memory otherVals = _avs[otherAvsId].validators;
            uint256 total = otherVals.length;
            if (total == 0) continue;

            uint256 slashedCount = 0;
            for (uint256 j = 0; j < total; j++) {
                if (_validators[otherVals[j]].slashedStake > 0) {
                    slashedCount++;
                }
            }

            uint256 riskBps = (slashedCount * BPS_DENOMINATOR) / total;

            if (riskBps >= CASCADE_THRESHOLD_BPS) {
                _avs[otherAvsId].cascadeRisk = true;
                cascadedCount++;

                emit CascadeRiskDetected(
                    otherAvsId,
                    slashedCount,
                    total,
                    riskBps,
                    block.timestamp
                );
            }
        }

        // ── Risk score update ─────────────────────────────────────────────────
        _updateRiskScore(cascadedCount);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /// @dev Computes and stores the network risk score
    ///      Formula mirrors the off-chain simulation engine for consistency:
    ///      score = (slashedStake/totalStake) * 55 + (cascadedServices/maxServices) * 45
    function _updateRiskScore(uint256 cascadedServices) internal {
        if (totalNetworkStake == 0) {
            networkRiskScore = 0;
            return;
        }

        uint256 maxOtherServices = avsCount > 1 ? avsCount - 1 : 1;

        uint256 primaryRisk = (totalSlashedStake * PRIMARY_RISK_WEIGHT * 100) / totalNetworkStake;
        uint256 cascadeRisk = (cascadedServices * CASCADE_RISK_WEIGHT * 100) / maxOtherServices;

        uint256 score = (primaryRisk + cascadeRisk) / 100;
        if (score > 99) score = 99;

        networkRiskScore = score;

        emit RiskScoreUpdated(
            score,
            totalSlashedStake,
            totalNetworkStake,
            block.timestamp
        );
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /// @notice Returns current network risk score (0–99)
    function getNetworkRiskScore() external view returns (uint256) {
        return networkRiskScore;
    }

    /// @notice Returns cascade risk of a given AVS in basis points
    /// @dev    riskBps = (slashedValidators / totalValidators) * 10000
    function getCascadeRisk(bytes32 avsId) external view avsExists(avsId) returns (uint256 riskBps) {
        bytes32[] memory vals = _avs[avsId].validators;
        uint256 total = vals.length;
        if (total == 0) return 0;

        uint256 slashed = 0;
        for (uint256 i = 0; i < total; i++) {
            if (_validators[vals[i]].slashedStake > 0) slashed++;
        }

        return (slashed * BPS_DENOMINATOR) / total;
    }

    /// @notice Returns all AVS IDs a validator is allocated to
    function getValidatorServices(bytes32 validatorId)
        external
        view
        validatorExists(validatorId)
        returns (bytes32[] memory)
    {
        return _validators[validatorId].services;
    }

    /// @notice Returns all validator IDs allocated to an AVS
    function getAVSValidators(bytes32 avsId)
        external
        view
        avsExists(avsId)
        returns (bytes32[] memory)
    {
        return _avs[avsId].validators;
    }

    /// @notice Check if a validator is allocated to a specific AVS
    function isAllocated(bytes32 validatorId, bytes32 avsId)
        external
        view
        returns (bool)
    {
        return _avs[avsId].hasValidator[validatorId];
    }

    /// @notice Returns validator summary data
    function getValidator(bytes32 validatorId)
        external
        view
        validatorExists(validatorId)
        returns (
            uint256 totalStake,
            uint256 slashedStake,
            uint256 remainingStake,
            uint8   serviceCount,
            bool    active
        )
    {
        ValidatorRecord storage v = _validators[validatorId];
        return (
            v.totalStake,
            v.slashedStake,
            v.totalStake - v.slashedStake,
            uint8(v.services.length),
            v.active
        );
    }

    /// @notice Returns AVS summary data
    function getAVS(bytes32 avsId)
        external
        view
        avsExists(avsId)
        returns (
            string memory name,
            uint256 totalTVL,
            uint256 validatorCount,
            bool    byzantine,
            bool    cascadeRisk,
            bool    active
        )
    {
        AVSRecord storage a = _avs[avsId];
        return (
            a.name,
            a.totalTVL,
            a.validators.length,
            a.byzantine,
            a.cascadeRisk,
            a.active
        );
    }

    /// @notice Returns all registered validator IDs
    function getAllValidatorIds() external view returns (bytes32[] memory) {
        return allValidatorIds;
    }

    /// @notice Returns all registered AVS IDs
    function getAllAvsIds() external view returns (bytes32[] memory) {
        return allAvsIds;
    }

    /// @notice Snapshot of full network state for off-chain consumption
    function getNetworkSnapshot()
        external
        view
        returns (
            uint256 _totalNetworkStake,
            uint256 _totalSlashedStake,
            uint256 _networkRiskScore,
            uint256 _validatorCount,
            uint256 _avsCount
        )
    {
        return (
            totalNetworkStake,
            totalSlashedStake,
            networkRiskScore,
            allValidatorIds.length,
            avsCount
        );
    }
}
