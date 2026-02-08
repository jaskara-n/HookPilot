// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LimitOrderhook} from "../../src/brand-token/LimitOrderhook.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LimitOrderhookHarness is LimitOrderhook {
    using PoolIdLibrary for PoolKey;

    uint256 public mockPrice;

    constructor(IPoolManager manager, address treasury, IERC20 stablecoin) LimitOrderhook(manager, treasury, stablecoin) {}

    function setMockPrice(uint256 price) external {
        mockPrice = price;
    }

    function _getCurrentPrice(PoolKey calldata) internal view override returns (uint256) {
        return mockPrice;
    }

    function exposeCheckCrossedPriceLevels(
        bytes32 poolId_,
        uint256 oldPrice,
        uint256 newPrice,
        PoolKey calldata key
    ) external {
        _checkCrossedPriceLevels(poolId_, oldPrice, newPrice, key);
    }

    function exposeExecuteOrdersAtPrice(bytes32 poolId_, uint256 price, bool isBuy, PoolKey calldata key) external {
        _executeOrdersAtPrice(poolId_, price, isBuy, key);
    }

    function exposeShouldCheckLimitOrders(bytes32 poolId_) external returns (bool) {
        return _shouldCheckLimitOrders(poolId_);
    }

    function exposeUpdateUserAccounting(bytes32 poolId_, uint256 price, bool isBuy, address user) external {
        _updateUserAccounting(poolId_, price, isBuy, user);
    }

    function setLastCheckedPrice(bytes32 poolId_, uint256 price) external {
        lastCheckedPrice[poolId_] = price;
    }

    function setLastLimitOrderTraversal(bytes32 poolId_, uint256 blockNumber) external {
        lastLimitOrderTraversal[poolId_] = blockNumber;
    }

    function setPoolCumulativeConsumedPerInput(bytes32 poolId_, uint256 price, bool isBuy, uint256 value) external {
        LimitOrders storage orders = isBuy ? buyOrders[poolId_][price] : sellOrders[poolId_][price];
        orders.cumulativeConsumedPerInput = value;
    }

    function setPoolCumulativeOutputPerInput(bytes32 poolId_, uint256 price, bool isBuy, uint256 value) external {
        LimitOrders storage orders = isBuy ? buyOrders[poolId_][price] : sellOrders[poolId_][price];
        orders.cumulativeOutputPerInput = value;
    }

    function poolId(PoolKey calldata key) external pure returns (bytes32) {
        PoolId id = key.toId();
        return PoolId.unwrap(id);
    }
}
