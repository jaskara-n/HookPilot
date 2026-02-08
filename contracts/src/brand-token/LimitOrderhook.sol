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
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LimitOrderhook
/// @notice Uniswap v4 hook with fee threshold distribution + onchain limit orders.
contract LimitOrderhook is BaseHook {
    using SafeERC20 for IERC20;
    using BalanceDeltaLibrary for BalanceDelta;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant DEFAULT_FEE = 100; // 1%
    uint256 public constant MINIMUM_DISTRIBUTION_THRESHOLD = 50e6;
    uint256 public constant CUMULATIVE_SCALE = 1e36;

    uint256 public constant PRICE_STEP = 1e4;
    uint256 public constant MAX_PRICE_STEPS = 2_500;
    uint256 public constant BLOCK_INTERVAL = 5;

    address public treasury;
    IERC20 public stablecoin;
    uint8 public stableDecimals;

    mapping(bytes32 => uint256) public accumulatedFees;
    mapping(bytes32 => mapping(uint256 => LimitOrders)) public buyOrders;
    mapping(bytes32 => mapping(uint256 => LimitOrders)) public sellOrders;
    mapping(bytes32 => uint256) public lastLimitOrderTraversal;
    mapping(bytes32 => uint256) public lastCheckedPrice;
    mapping(bytes32 => mapping(uint256 => uint256)) public lastExecutedBlock;

    struct LimitOrders {
        uint256 totalLiquidity;
        uint256 cumulativeConsumedPerInput;
        uint256 cumulativeOutputPerInput;
        mapping(address => uint256) userLiquidity;
        mapping(address => uint256) userClaimable;
        mapping(address => uint256) userPaidOut;
        mapping(address => uint256) userPaidConsumed;
    }

    error InvalidAmount();
    error InvalidPriceLimit();
    error NoOrderAtPrice(uint256 price);
    error NothingToClaim();
    error AddressCannotBeZero();
    error InvalidStablecoin();
    error InvalidNativeValue();
    error ZeroPrice();

    constructor(IPoolManager _manager, address _treasury, IERC20 _stablecoin) BaseHook(_manager) {
        if (_treasury == address(0) || address(_stablecoin) == address(0)) revert AddressCannotBeZero();
        treasury = _treasury;
        stablecoin = _stablecoin;
        stableDecimals = _getDecimals(address(_stablecoin));
    }

    receive() external payable {}

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

    // ------------------------------------------------------------
    // Hook entry points
    // ------------------------------------------------------------

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
            _distributeFees(poolId, stableCurrency);
        }

        if (_shouldCheckLimitOrders(poolId)) {
            uint256 currentPrice = _getCurrentPrice(key);
            uint256 lastPrice = lastCheckedPrice[poolId];

            if (lastPrice == 0) {
                lastCheckedPrice[poolId] = currentPrice;
                return (BaseHook.afterSwap.selector, 0);
            }

            if (currentPrice != lastPrice) {
                _checkCrossedPriceLevels(poolId, lastPrice, currentPrice, key);
                lastCheckedPrice[poolId] = currentPrice;
            }
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    // ------------------------------------------------------------
    // Limit order API
    // ------------------------------------------------------------

    function placeLimitOrder(
        PoolKey calldata key,
        uint256 amount,
        uint256 priceLimit,
        bool isBuy
    ) external payable {
        if (amount == 0) revert InvalidAmount();
        if (priceLimit < PRICE_STEP) revert InvalidPriceLimit();

        (Currency stableCurrency, Currency tokenCurrency,) = _getStableAndToken(key);
        bytes32 poolId = _poolId(key);
        uint256 normalizedPrice = _normalizePrice(priceLimit);

        _updateUserAccounting(poolId, normalizedPrice, isBuy, msg.sender);

        LimitOrders storage orders = isBuy ? buyOrders[poolId][normalizedPrice] : sellOrders[poolId][normalizedPrice];
        orders.totalLiquidity += amount;
        orders.userLiquidity[msg.sender] += amount;

        address token = isBuy ? Currency.unwrap(stableCurrency) : Currency.unwrap(tokenCurrency);
        _pullToken(token, msg.sender, amount);
    }

    function cancelLimitOrder(PoolKey calldata key, uint256 price, bool isBuy) external {
        (Currency stableCurrency, Currency tokenCurrency,) = _getStableAndToken(key);
        bytes32 poolId = _poolId(key);
        uint256 normalizedPrice = _normalizePrice(price);

        _updateUserAccounting(poolId, normalizedPrice, isBuy, msg.sender);

        LimitOrders storage orders = isBuy ? buyOrders[poolId][normalizedPrice] : sellOrders[poolId][normalizedPrice];
        uint256 userLiquidity = orders.userLiquidity[msg.sender];
        if (userLiquidity == 0) revert NoOrderAtPrice(normalizedPrice);

        orders.userLiquidity[msg.sender] = 0;
        uint256 transferAmount = userLiquidity > orders.totalLiquidity ? orders.totalLiquidity : userLiquidity;
        orders.totalLiquidity -= transferAmount;

        address token = isBuy ? Currency.unwrap(stableCurrency) : Currency.unwrap(tokenCurrency);
        _pushToken(token, msg.sender, transferAmount);
    }

    function claimExecutedLimitOrders(PoolKey calldata key, uint256[] calldata prices, bool isBuy) external {
        (Currency stableCurrency, Currency tokenCurrency,) = _getStableAndToken(key);
        bytes32 poolId = _poolId(key);
        uint256 totalClaim;

        for (uint256 i = 0; i < prices.length; i++) {
            uint256 normalizedPrice = _normalizePrice(prices[i]);
            LimitOrders storage orders = isBuy ? buyOrders[poolId][normalizedPrice] : sellOrders[poolId][normalizedPrice];

            _updateUserAccounting(poolId, normalizedPrice, isBuy, msg.sender);

            uint256 claimable = orders.userClaimable[msg.sender];
            if (claimable > 0) {
                orders.userClaimable[msg.sender] = 0;
                totalClaim += claimable;
            }
        }

        if (totalClaim == 0) revert NothingToClaim();

        address token = isBuy ? Currency.unwrap(tokenCurrency) : Currency.unwrap(stableCurrency);
        _pushToken(token, msg.sender, totalClaim);
    }

    function distributeFees(PoolKey calldata key) external {
        (Currency stableCurrency,,) = _getStableAndToken(key);
        bytes32 poolId = _poolId(key);
        _distributeFees(poolId, stableCurrency);
    }

    function getPoolOrders(PoolKey calldata key, uint256 price, bool isBuy)
        external
        view
        returns (uint256 totalLiquidity, uint256 cumulativeConsumedPerInput, uint256 cumulativeOutputPerInput)
    {
        bytes32 poolId = _poolId(key);
        uint256 normalizedPrice = _normalizePrice(price);
        LimitOrders storage orders = isBuy ? buyOrders[poolId][normalizedPrice] : sellOrders[poolId][normalizedPrice];
        return (orders.totalLiquidity, orders.cumulativeConsumedPerInput, orders.cumulativeOutputPerInput);
    }

    function getUserOrder(PoolKey calldata key, uint256 price, bool isBuy, address user)
        external
        view
        returns (uint256 liquidity, uint256 claimable, uint256 userPaidOut, uint256 userPaidConsumed)
    {
        bytes32 poolId = _poolId(key);
        uint256 normalizedPrice = _normalizePrice(price);
        LimitOrders storage orders = isBuy ? buyOrders[poolId][normalizedPrice] : sellOrders[poolId][normalizedPrice];
        liquidity = orders.userLiquidity[user];
        claimable = orders.userClaimable[user];
        userPaidOut = orders.userPaidOut[user];
        userPaidConsumed = orders.userPaidConsumed[user];
    }

    function getUpdatedUserOrder(PoolKey calldata key, uint256 price, bool isBuy, address user)
        external
        view
        returns (uint256 claimable, uint256 consumedLiquidity)
    {
        bytes32 poolId = _poolId(key);
        uint256 normalizedPrice = _normalizePrice(price);
        return _getUpdatedUserOrder(poolId, normalizedPrice, isBuy, user);
    }

    function getNormalizedPrice(uint256 price) external pure returns (uint256) {
        return _normalizePrice(price);
    }

    // ------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------

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

    function _getTokenDecimals(PoolKey calldata key) internal view returns (uint8) {
        (, Currency tokenCurrency,) = _getStableAndToken(key);
        return _getDecimals(Currency.unwrap(tokenCurrency));
    }

    function _getCurrentPrice(PoolKey calldata key) internal view virtual returns (uint256) {
        (, Currency tokenCurrency, bool stableIsCurrency0) = _getStableAndToken(key);
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint8 tokenDecimals = _getDecimals(Currency.unwrap(tokenCurrency));
        return _priceFromSqrtPrice(sqrtPriceX96, stableIsCurrency0, stableDecimals, tokenDecimals);
    }

    function _priceFromSqrtPrice(
        uint160 sqrtPriceX96,
        bool stableIsCurrency0,
        uint8 stableDec,
        uint8 tokenDec
    ) internal pure returns (uint256) {
        uint256 numerator = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        uint256 stableScale = 10 ** stableDec;
        uint256 tokenScale = 10 ** tokenDec;
        uint256 q192 = uint256(1) << 192;

        if (stableIsCurrency0) {
            uint256 denomStable = FullMath.mulDiv(numerator, tokenScale, 1);
            return FullMath.mulDiv(q192, stableScale, denomStable);
        }

        uint256 denomToken = FullMath.mulDiv(q192, tokenScale, 1);
        return FullMath.mulDiv(numerator, stableScale, denomToken);
    }

    function _shouldCheckLimitOrders(bytes32 poolId) internal returns (bool) {
        if (lastLimitOrderTraversal[poolId] == 0) {
            lastLimitOrderTraversal[poolId] = block.number;
            return true;
        }
        if (block.number >= lastLimitOrderTraversal[poolId] + BLOCK_INTERVAL) {
            lastLimitOrderTraversal[poolId] = block.number;
            return true;
        }
        return false;
    }

    function _checkCrossedPriceLevels(
        bytes32 poolId,
        uint256 oldPrice,
        uint256 newPrice,
        PoolKey calldata key
    ) internal {
        uint256 oldNormalized = _normalizePrice(oldPrice);
        uint256 newNormalized = _normalizePrice(newPrice);

        uint256 steps;

        if (newPrice > oldPrice && newNormalized > oldNormalized) {
            for (
                uint256 price = oldNormalized + PRICE_STEP;
                price <= newNormalized && steps < MAX_PRICE_STEPS;
                price += PRICE_STEP
            ) {
                if (sellOrders[poolId][price].totalLiquidity > 0) {
                    _executeOrdersAtPrice(poolId, price, false, key);
                }
                steps++;
            }
        } else if (newPrice < oldPrice && newNormalized < oldNormalized) {
            for (
                uint256 price = oldNormalized - PRICE_STEP;
                price >= newNormalized && steps < MAX_PRICE_STEPS;
                price -= PRICE_STEP
            ) {
                if (buyOrders[poolId][price].totalLiquidity > 0) {
                    _executeOrdersAtPrice(poolId, price, true, key);
                }
                steps++;
                if (price == newNormalized) break;
            }
        }
    }

    function _executeOrdersAtPrice(bytes32 poolId, uint256 price, bool isBuy, PoolKey calldata key) internal {
        if (lastExecutedBlock[poolId][price] == block.number) return;
        lastExecutedBlock[poolId][price] = block.number;

        LimitOrders storage orders = isBuy ? buyOrders[poolId][price] : sellOrders[poolId][price];
        uint256 orgLiquidity = orders.totalLiquidity;
        if (orgLiquidity == 0) return;

        uint256 executedAmount = orders.totalLiquidity;
        orders.totalLiquidity -= executedAmount;

        orders.cumulativeConsumedPerInput += (executedAmount * CUMULATIVE_SCALE) / orgLiquidity;

        uint256 currentPrice = _getCurrentPrice(key);
        if (currentPrice == 0) revert ZeroPrice();
        uint8 tokenDecimals = _getTokenDecimals(key);
        uint256 outputAmount = _quoteOutput(executedAmount, currentPrice, tokenDecimals, isBuy);

        orders.cumulativeOutputPerInput += (outputAmount * CUMULATIVE_SCALE) / orgLiquidity;
    }

    function _quoteOutput(uint256 amountIn, uint256 price, uint8 tokenDecimals, bool isBuy)
        internal
        pure
        returns (uint256)
    {
        if (price == 0) revert ZeroPrice();
        uint256 tokenScale = 10 ** tokenDecimals;
        if (isBuy) {
            return FullMath.mulDiv(amountIn, tokenScale, price);
        }
        return FullMath.mulDiv(amountIn, price, tokenScale);
    }

    function _updateUserAccounting(bytes32 poolId, uint256 price, bool isBuy, address user) internal {
        LimitOrders storage orders = isBuy ? buyOrders[poolId][price] : sellOrders[poolId][price];

        (uint256 claimable, uint256 consumedLiquidity) = _getUpdatedUserOrder(poolId, price, isBuy, user);
        orders.userClaimable[user] += claimable;
        orders.userLiquidity[user] -= consumedLiquidity;
        orders.userPaidOut[user] = orders.cumulativeOutputPerInput;
        orders.userPaidConsumed[user] = orders.cumulativeConsumedPerInput;
    }

    function _getUpdatedUserOrder(bytes32 poolId, uint256 price, bool isBuy, address user)
        internal
        view
        returns (uint256 claimable, uint256 consumedLiquidity)
    {
        LimitOrders storage orders = isBuy ? buyOrders[poolId][price] : sellOrders[poolId][price];

        uint256 prevLiquidity = orders.userLiquidity[user];
        uint256 deltaOut = orders.cumulativeOutputPerInput - orders.userPaidOut[user];
        uint256 deltaCons = orders.cumulativeConsumedPerInput - orders.userPaidConsumed[user];

        if (deltaOut == 0 && deltaCons == 0) {
            return (0, 0);
        }

        if (deltaOut > 0) {
            claimable = (prevLiquidity * deltaOut) / CUMULATIVE_SCALE;
        }

        if (deltaCons > 0) {
            consumedLiquidity = (prevLiquidity * deltaCons) / CUMULATIVE_SCALE;
        }
    }

    function _normalizePrice(uint256 price) internal pure returns (uint256) {
        return (price / PRICE_STEP) * PRICE_STEP;
    }

    function _distributeFees(bytes32 poolId, Currency stableCurrency) internal {
        if (accumulatedFees[poolId] < MINIMUM_DISTRIBUTION_THRESHOLD) return;

        uint256 totalFees = accumulatedFees[poolId];
        accumulatedFees[poolId] = 0;
        IERC20(Currency.unwrap(stableCurrency)).safeTransfer(treasury, totalFees);
    }

    function _pullToken(address token, address from, uint256 amount) internal {
        if (token == address(0)) {
            if (msg.value != amount) revert InvalidNativeValue();
            return;
        }
        if (msg.value != 0) revert InvalidNativeValue();
        IERC20(token).safeTransferFrom(from, address(this), amount);
    }

    function _pushToken(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "Native transfer failed");
            return;
        }
        IERC20(token).safeTransfer(to, amount);
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
