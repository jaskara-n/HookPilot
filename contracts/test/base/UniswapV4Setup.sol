// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {SwapMath} from "@uniswap/v4-core/src/libraries/SwapMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {EasyPosm} from "./uniswap-v4-utils/EasyPosm.sol";
import {Fixtures} from "./uniswap-v4-utils/Fixtures.sol";
import {V4Quoter} from "@uniswap/v4-periphery/src/lens/V4Quoter.sol";
import {IV4Quoter} from "@uniswap/v4-periphery/src/interfaces/IV4Quoter.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
    constructor() ERC20("ERC20Mock", "E20M") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}

/**
 * @title  UniswapV4Setup
 * @author Jaskaran Singh
 * @notice This contract sets up a fresh Uniswap V4 environment for testing.
 * It deploys the pool manager, utility routers, and test tokens.
 * @notice It provides utility functions to create and initialize pools, mint positions,
 * increase and decrease liquidity, and perform swaps.
 * @notice It also includes functions to set up mock tokens and pools for testing purposes.
 * @dev This contract is used as a base for other test contracts, such as MVMNTManager Unit
 * and TradeHandlerV4Unit.
 * @dev Base contracts are present in test/base that deploy the trade handler which is the
 * actual mock contract that interacts with the Uniswap V4 contracts.
 */

contract UniswapV4Setup is Fixtures {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    V4Quoter public v4Quoter;

    function setUp() public virtual {
        /// @dev creates the pool manager, utility routers, and test tokens
        deployFreshManagerAndRouters();
        /// @dev deployMintAndApprove2Currencies();
        deployPosm(manager);

        v4Quoter = new V4Quoter(manager);
    }

    function _createAndInitializePool(address tokenA, address tokenB, uint24 poolFee, uint160 priceRatio)
        internal
        returns (PoolKey memory _key, int24 tick)
    {
        _key = PoolKey(Currency.wrap(tokenA), Currency.wrap(tokenB), poolFee, 60, IHooks(address(0)));
        tick = manager.initialize(_key, priceRatio);
    }

    function _mintNewPositionInPool(PoolKey memory _key, uint128 liquidity, uint160 poolPrice, address recipient)
        internal
        returns (uint256 _tokenId)
    {
        /// @dev Provide full-range liquidity to the pool
        int24 tickLower = TickMath.minUsableTick(_key.tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(_key.tickSpacing);

        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            poolPrice, TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), liquidity
        );

        (_tokenId,) = posm.mint(
            _key,
            tickLower,
            tickUpper,
            liquidity,
            amount0Expected + 1,
            amount1Expected + 1,
            recipient,
            block.timestamp,
            ZERO_BYTES
        );
    }

    function _increaseLiquidityInPool(uint256 _tokenId, uint128 _liquidity, uint256 _maxTokenA, uint256 _maxTokenB)
        internal
    {
        posm.increaseLiquidity(_tokenId, _liquidity, _maxTokenA, _maxTokenB, block.timestamp, ZERO_BYTES);
    }

    function _decreaseLiquidityInPool(uint256 _tokenId, uint128 _liquidity, address recipient) internal {
        posm.decreaseLiquidity(
            _tokenId,
            _liquidity,
            MAX_SLIPPAGE_REMOVE_LIQUIDITY,
            MAX_SLIPPAGE_REMOVE_LIQUIDITY,
            recipient,
            block.timestamp,
            ZERO_BYTES
        );
    }

    function _setupMockTokensPoolAndMintPos()
        internal
        returns (PoolKey memory _key, uint256 _tokenId, address _tokenA, address _tokenB)
    {
        address tempA = address(new ERC20Mock());
        address tempB = address(new ERC20Mock());

        (_tokenA, _tokenB) = tempA < tempB ? (tempA, tempB) : (tempB, tempA);

        // address user = makeAddr("user");
        (_key,) = _createAndInitializePool(_tokenA, _tokenB, 3000, SQRT_PRICE_1_2);

        deal(_tokenA, address(this), 10000e18);
        deal(_tokenB, address(this), 10000e18);
        ERC20(_tokenB).approve(address(permit2), type(uint256).max);
        ERC20(_tokenA).approve(address(permit2), type(uint256).max);
        permit2.approve(_tokenB, address(posm), type(uint160).max, uint48(block.timestamp));
        permit2.approve(_tokenA, address(posm), type(uint160).max, uint48(block.timestamp));
        _tokenId = _mintNewPositionInPool(_key, 1000e18, SQRT_PRICE_1_2, address(this));
    }

    function _createPoolWithInitialLiquidity(
        address _tokenA,
        address _tokenB,
        uint160 _sqrtPriceX96,
        uint128 _initialLiquidity
    ) internal returns (PoolKey memory _key, uint256 _tokenId) {
        (address tokenA, address tokenB) = _tokenA < _tokenB ? (_tokenA, _tokenB) : (_tokenB, _tokenA);

        (_key,) = _createAndInitializePool(tokenA, tokenB, 3000, _sqrtPriceX96);

        int24 tickLower = TickMath.minUsableTick(_key.tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(_key.tickSpacing);

        console.log("tick lower", tickLower);
        console.log("tick upper", tickUpper);

        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            _sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            _initialLiquidity
        );

        console.log("amount0", amount0);
        console.log("amount1", amount1);

        console.log("tokenA", tokenA);
        console.log("tokenB", tokenB);

        // Deal tokens with extra buffer
        if (tokenA != address(0)) {
            deal(tokenA, address(this), amount0 + 2);
        } else {
            vm.deal(address(this), amount0 + 2);
        }
        if (tokenB != address(0)) {
            deal(tokenB, address(this), amount1 + 2);
        } else {
            vm.deal(address(this), amount1 + 2);
        }

        // console.log("balance of tokenA", address(this).balance);
        // console.log(
        //     "balance of tokenA",
        //     ERC20(tokenA).balanceOf(address(this))
        // );
        // console.log(
        //     "balance of tokenB",
        //     ERC20(tokenB).balanceOf(address(this))
        // );

        // Rest remains the same...
        if (tokenB != address(0)) {
            ERC20(tokenB).approve(address(permit2), type(uint256).max);
        }
        if (tokenA != address(0)) {
            ERC20(tokenA).approve(address(permit2), type(uint256).max);
        }
        if (tokenB != address(0)) {
            permit2.approve(tokenB, address(posm), type(uint160).max, uint48(block.timestamp));
        }
        if (tokenA != address(0)) {
            permit2.approve(tokenA, address(posm), type(uint160).max, uint48(block.timestamp));
        }

        _tokenId = _mintNewPositionInPool(_key, _initialLiquidity, _sqrtPriceX96, address(this));
    }

    function _exactInputPoolSwap(PoolKey memory _key, bool _zeroForOne, int256 _amountIn)
        public
        returns (BalanceDelta swapDelta)
    {
        swapDelta = swap(
            _key,
            _zeroForOne,
            -_amountIn, /// @dev negative number indicates exact input swap
            ZERO_BYTES
        );
    }

    function _exactOutputSinglePoolNativeSwap(PoolKey memory _key, bool _zeroForOne, int256 _amountOut)
        public
        returns (BalanceDelta swapDelta)
    {
        (uint256 quotedAmountIn,) = _getExactOutputSinglePoolSwapQuote(_key, uint128(uint256(_amountOut)), _zeroForOne);
        swapDelta = swapNativeInput(
            _key,
            _zeroForOne,
            _amountOut, /// @dev positive number indicates exact output swap
            ZERO_BYTES,
            quotedAmountIn
        );
    }

    function _exactOutputSinglePoolSwap(PoolKey memory _key, bool _zeroForOne, int256 _amountOut)
        public
        returns (BalanceDelta swapDelta)
    {
        // ERC20(Currency.unwrap(_key.currency0)).approve(
        //     address(swapRouter),
        //     type(uint256).max
        // );
        swapDelta = swap(
            _key,
            _zeroForOne,
            _amountOut, /// @dev positive number indicates exact output swap
            ZERO_BYTES
        );
    }

    function _getExactOutputSinglePoolSwapQuote(PoolKey memory _key, uint128 amountOut, bool zeroForOne)
        internal
        returns (uint256 amountIn, uint256 gasEstimate)
    {
        (amountIn, gasEstimate) = v4Quoter.quoteExactOutputSingle(
            IV4Quoter.QuoteExactSingleParams({
                poolKey: _key, zeroForOne: zeroForOne, exactAmount: uint128(amountOut), hookData: ZERO_BYTES
            })
        );
    }

    function _getExactInputSinglePoolSwapQuote(PoolKey memory _key, uint128 amountIn, bool zeroForOne)
        internal
        returns (uint256 amountOut, uint256 gasEstimate)
    {
        (amountOut, gasEstimate) = v4Quoter.quoteExactInputSingle(
            IV4Quoter.QuoteExactSingleParams({
                poolKey: _key, zeroForOne: zeroForOne, exactAmount: amountIn, hookData: ZERO_BYTES
            })
        );
    }
}
