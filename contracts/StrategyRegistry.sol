// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StrategyRegistry
 * @dev Immutable on-chain registry for cryptographic strategy rules and verifiable trade event logging.
 */
contract StrategyRegistry {
    struct StrategyRecord {
        bytes32 strategyId;
        bytes32 strategyHash;
        string ipfsCid;
        string name;
        string asset;
        string timeframe;
        address creator;
        uint256 registrationTimestamp;
        bool isRegistered;
    }

    struct TradeRecord {
        bytes32 strategyId;
        bytes32 tradeId;
        string asset;
        uint8 direction; // 0: BUY, 1: SELL, 2: HOLD
        uint256 price;   // Multiplied by 1e8 for precision
        uint256 quantity;// Multiplied by 1e8
        uint256 timestamp;
        uint256 blockNumber;
    }

    // Storage mappings
    mapping(bytes32 => StrategyRecord) public strategies;
    mapping(bytes32 => TradeRecord) public trades;
    mapping(bytes32 => bytes32[]) public strategyTradeIds;

    bytes32[] public allStrategyIds;

    // Verifiable Events
    event StrategyRegistered(
        bytes32 indexed strategyId,
        bytes32 indexed strategyHash,
        address indexed creator,
        string ipfsCid,
        string name,
        string asset,
        string timeframe,
        uint256 timestamp
    );

    event TradeRecorded(
        bytes32 indexed strategyId,
        bytes32 indexed tradeId,
        string asset,
        uint8 direction,
        uint256 price,
        uint256 quantity,
        uint256 timestamp
    );

    error StrategyAlreadyExists(bytes32 strategyId);
    error StrategyNotFound(bytes32 strategyId);
    error InvalidStrategyHash();

    /**
     * @notice Registers a new deterministic strategy hash and its IPFS metadata CID.
     */
    function registerStrategy(
        bytes32 strategyId,
        bytes32 strategyHash,
        string calldata ipfsCid,
        string calldata name,
        string calldata asset,
        string calldata timeframe
    ) external returns (bytes32) {
        if (strategies[strategyId].isRegistered) {
            revert StrategyAlreadyExists(strategyId);
        }
        if (strategyHash == bytes32(0)) {
            revert InvalidStrategyHash();
        }

        strategies[strategyId] = StrategyRecord({
            strategyId: strategyId,
            strategyHash: strategyHash,
            ipfsCid: ipfsCid,
            name: name,
            asset: asset,
            timeframe: timeframe,
            creator: msg.sender,
            registrationTimestamp: block.timestamp,
            isRegistered: true
        });

        allStrategyIds.push(strategyId);

        emit StrategyRegistered(
            strategyId,
            strategyHash,
            msg.sender,
            ipfsCid,
            name,
            asset,
            timeframe,
            block.timestamp
        );

        return strategyId;
    }

    /**
     * @notice Records an executed paper or live trade event on-chain for public verification.
     */
    function recordTrade(
        bytes32 strategyId,
        bytes32 tradeId,
        string calldata asset,
        uint8 direction,
        uint256 price,
        uint256 quantity
    ) external {
        if (!strategies[strategyId].isRegistered) {
            revert StrategyNotFound(strategyId);
        }

        trades[tradeId] = TradeRecord({
            strategyId: strategyId,
            tradeId: tradeId,
            asset: asset,
            direction: direction,
            price: price,
            quantity: quantity,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        strategyTradeIds[strategyId].push(tradeId);

        emit TradeRecorded(
            strategyId,
            tradeId,
            asset,
            direction,
            price,
            quantity,
            block.timestamp
        );
    }

    function getStrategy(bytes32 strategyId) external view returns (StrategyRecord memory) {
        if (!strategies[strategyId].isRegistered) {
            revert StrategyNotFound(strategyId);
        }
        return strategies[strategyId];
    }

    function getTradesForStrategy(bytes32 strategyId) external view returns (bytes32[] memory) {
        return strategyTradeIds[strategyId];
    }

    function totalStrategies() external view returns (uint256) {
        return allStrategyIds.length;
    }
}
