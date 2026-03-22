// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRestakingGuard
/// @notice Interface for the StakeGuard on-chain restaking risk registry
interface IRestakingGuard {
    // ── Structs ───────────────────────────────────────────────────────────────

    struct ValidatorInfo {
        bytes32 validatorId;
        uint256 totalStake;       // in wei (ETH)
        uint256 slashedStake;     // cumulative slashed amount
        uint8   serviceCount;     // number of AVS services allocated to
        bool    active;
    }

    struct AVSInfo {
        bytes32 avsId;
        string  name;
        uint256 totalTVL;         // total value locked in wei
        uint8   validatorCount;   // number of validators allocated
        uint8   slashedCount;     // validators that have been slashed
        bool    byzantine;        // flagged as Byzantine
        bool    active;
    }

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new validator is registered
    event ValidatorRegistered(bytes32 indexed validatorId, uint256 stake);

    /// @notice Emitted when a new AVS is registered
    event AVSRegistered(bytes32 indexed avsId, string name);

    /// @notice Emitted when a validator is allocated to an AVS
    event ValidatorAllocated(bytes32 indexed validatorId, bytes32 indexed avsId);

    /// @notice Emitted when a validator is deallocated from an AVS
    event ValidatorDeallocated(bytes32 indexed validatorId, bytes32 indexed avsId);

    /// @notice Emitted when an AVS is flagged as Byzantine
    event AVSFlaggedByzantine(bytes32 indexed avsId, address indexed reporter, uint256 timestamp);

    /// @notice Emitted when a validator is slashed due to Byzantine AVS
    event ValidatorSlashed(
        bytes32 indexed validatorId,
        bytes32 indexed byzantineAvsId,
        uint256 slashedAmount,
        uint256 timestamp
    );

    /// @notice Emitted when cascade risk is detected on a secondary AVS
    event CascadeRiskDetected(
        bytes32 indexed avsId,
        uint256 slashedValidatorCount,
        uint256 totalValidatorCount,
        uint256 timestamp
    );

    /// @notice Emitted when the network risk score is updated
    event RiskScoreUpdated(uint256 newScore, uint256 totalSlashed, uint256 timestamp);

    // ── Errors ────────────────────────────────────────────────────────────────

    error ValidatorAlreadyRegistered(bytes32 validatorId);
    error ValidatorNotFound(bytes32 validatorId);
    error AVSAlreadyRegistered(bytes32 avsId);
    error AVSNotFound(bytes32 avsId);
    error AlreadyAllocated(bytes32 validatorId, bytes32 avsId);
    error NotAllocated(bytes32 validatorId, bytes32 avsId);
    error AVSAlreadyByzantine(bytes32 avsId);
    error ValidatorAlreadySlashed(bytes32 validatorId, bytes32 avsId);
    error InsufficientStake();
    error Unauthorized();
    error ZeroAddress();

    // ── Core Functions ────────────────────────────────────────────────────────

    function registerValidator(bytes32 validatorId, uint256 stake) external;
    function registerAVS(bytes32 avsId, string calldata name, uint256 tvl) external;
    function allocateValidator(bytes32 validatorId, bytes32 avsId) external;
    function deallocateValidator(bytes32 validatorId, bytes32 avsId) external;
    function reportByzantine(bytes32 avsId) external;
    function executeSlashing(bytes32 avsId, uint256 slashBps) external;

    // ── View Functions ────────────────────────────────────────────────────────

    function getValidator(bytes32 validatorId) external view returns (ValidatorInfo memory);
    function getAVS(bytes32 avsId) external view returns (AVSInfo memory);
    function getNetworkRiskScore() external view returns (uint256);
    function getCascadeRisk(bytes32 avsId) external view returns (uint256 riskBps);
    function getValidatorServices(bytes32 validatorId) external view returns (bytes32[] memory);
    function getAVSValidators(bytes32 avsId) external view returns (bytes32[] memory);
    function isAllocated(bytes32 validatorId, bytes32 avsId) external view returns (bool);
}
