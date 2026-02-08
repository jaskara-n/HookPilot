// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseHook} from "../utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FeeThresholdHook
/// @notice Fee collection hook that distributes to a treasury once a threshold is reached.
contract FeeThresholdHook is BaseHook {
    using SafeERC20 for IERC20;
    using BalanceDeltaLibrary for BalanceDelta;
    using PoolIdLibrary for PoolKey;

    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant DEFAULT_FEE = 100; // 1%
    uint256 public constant MINIMUM_DISTRIBUTION_THRESHOLD = 50e6;

    address public treasury;
    IERC20 public stablecoin;
    uint8 public stableDecimals;

    mapping(bytes32 => uint256) public accumulatedFees;
    mapping(bytes32 => uint256) public totalFeesCollected;
    mapping(bytes32 => uint256) public totalFeesDistributed;

    error AddressCannotBeZero();
    error InvalidStablecoin();

    constructor(IPoolManager _manager, address _treasury, IERC20 _stablecoin) BaseHook(_manager) {
        if (_treasury == address(0) || address(_stablecoin) == address(0)) revert AddressCannotBeZero();
        treasury = _treasury;
        stablecoin = _stablecoin;
        stableDecimals = _getDecimals(address(_stablecoin));
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        _onlyPoolManager();
        return (BaseHook.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    ) external override returns (bytes4, int128) {
        _onlyPoolManager();

        bytes32 poolId = _poolId(key);
        (Currency stableCurrency,,) = _getStableAndToken(key);
        int256 stableDelta = _getStableDelta(key, delta);

        if (stableDelta != 0) {
            uint256 feeAmount = (uint256(stableDelta > 0 ? stableDelta : -stableDelta) * DEFAULT_FEE) / FEE_DENOMINATOR;
            accumulatedFees[poolId] += feeAmount;
            totalFeesCollected[poolId] += feeAmount;
            _distributeFees(poolId, stableCurrency);
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    function distributeFees(PoolKey calldata key) external {
        (Currency stableCurrency,,) = _getStableAndToken(key);
        bytes32 poolId = _poolId(key);
        _distributeFees(poolId, stableCurrency);
    }

    function _poolId(PoolKey calldata key) internal pure returns (bytes32) {
        PoolId id = key.toId();
        return PoolId.unwrap(id);
    }

    function _getStableDelta(PoolKey calldata key, BalanceDelta delta) internal view returns (int256) {
        (,, bool stableIsCurrency0) = _getStableAndToken(key);
        return stableIsCurrency0 ? int256(delta.amount0()) : int256(delta.amount1());
    }

    function _getStableAndToken(PoolKey calldata key)
        internal
        view
        returns (Currency stableCurrency, Currency tokenCurrency, bool stableIsCurrency0)
    {
        if (Currency.unwrap(key.currency0) == address(stablecoin)) {
            return (key.currency0, key.currency1, true);
        }
        if (Currency.unwrap(key.currency1) == address(stablecoin)) {
            return (key.currency1, key.currency0, false);
        }
        revert InvalidStablecoin();
    }

    function _distributeFees(bytes32 poolId, Currency stableCurrency) internal {
        if (accumulatedFees[poolId] < MINIMUM_DISTRIBUTION_THRESHOLD) return;

        uint256 totalFees = accumulatedFees[poolId];
        accumulatedFees[poolId] = 0;
        totalFeesDistributed[poolId] += totalFees;
        IERC20(Currency.unwrap(stableCurrency)).safeTransfer(treasury, totalFees);
    }

    function _getDecimals(address token) internal view returns (uint8) {
        if (token == address(0)) return 18;
        try IERC20Metadata(token).decimals() returns (uint8 dec) {
            return dec;
        } catch {
            return 18;
        }
    }
}
