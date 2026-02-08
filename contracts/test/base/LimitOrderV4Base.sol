// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {UniswapV4Setup} from "./UniswapV4Setup.sol";
import {LimitOrderhookHarness} from "./LimitOrderhookHarness.sol";
import {MintableERC20} from "../mocks/MintableERC20.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract LimitOrderV4Base is Test, UniswapV4Setup {
    using PoolIdLibrary for PoolKey;

    uint256 public constant DEFAULT_FEE = 100;
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant CUMULATIVE_SCALE = 1e36;

    LimitOrderhookHarness public hook;
    MintableERC20 public stablecoin;
    MintableERC20 public token;

    PoolKey public poolKey;
    bytes32 public poolId;
    bool public stableIsCurrency0;

    address public treasury;
    address public user1;
    address public user2;
    address public user3;

    function setUp() public virtual override {
        super.setUp();

        treasury = makeAddr("treasury");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        stablecoin = new MintableERC20("USDC", "USDC", 6);
        token = new MintableERC20("TOKEN", "TKN", 18);

        // Deploy implementation with correct immutables, then etch to a hook-permissioned address.
        LimitOrderhookHarness impl = new LimitOrderhookHarness(manager, treasury, IERC20(address(stablecoin)));
        address payable hookAddr = payable(address(uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG)));
        vm.etch(hookAddr, address(impl).code);

        // Copy initialized storage (treasury, stablecoin, stableDecimals).
        for (uint256 i = 0; i < 3; i++) {
            vm.store(hookAddr, bytes32(i), vm.load(address(impl), bytes32(i)));
        }

        hook = LimitOrderhookHarness(hookAddr);

        Currency stableCur = Currency.wrap(address(stablecoin));
        Currency tokenCur = Currency.wrap(address(token));
        (Currency currency0, Currency currency1) =
            Currency.unwrap(stableCur) < Currency.unwrap(tokenCur) ? (stableCur, tokenCur) : (tokenCur, stableCur);
        stableIsCurrency0 = Currency.unwrap(currency0) == address(stablecoin);

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hookAddr)
        });
        poolId = PoolId.unwrap(poolKey.toId());

        // Fund this contract and add liquidity for swaps.
        // Use deal to guarantee large balances regardless of token decimals.
        stablecoin.mint(address(this), 1e24);
        token.mint(address(this), 1e24);
        deal(address(stablecoin), address(this), 1e30);
        deal(address(token), address(this), 1e30);
        stablecoin.approve(address(modifyLiquidityRouter), type(uint256).max);
        token.approve(address(modifyLiquidityRouter), type(uint256).max);
        stablecoin.approve(address(swapRouter), type(uint256).max);
        token.approve(address(swapRouter), type(uint256).max);

        manager.initialize(poolKey, SQRT_PRICE_1_1);
        modifyLiquidityRouter.modifyLiquidity(poolKey, LIQUIDITY_PARAMS, ZERO_BYTES);

        // Fund users and set approvals.
        stablecoin.mint(user1, 1_000_000e6);
        stablecoin.mint(user2, 1_000_000e6);
        stablecoin.mint(user3, 1_000_000e6);
        token.mint(user1, 1_000_000e18);
        token.mint(user2, 1_000_000e18);
        token.mint(user3, 1_000_000e18);
        deal(address(stablecoin), user1, 1_000_000e6);
        deal(address(stablecoin), user2, 1_000_000e6);
        deal(address(stablecoin), user3, 1_000_000e6);
        deal(address(token), user1, 1_000_000e18);
        deal(address(token), user2, 1_000_000e18);
        deal(address(token), user3, 1_000_000e18);

        _approveUser(user1);
        _approveUser(user2);
        _approveUser(user3);

        vm.label(hookAddr, "LIMIT_ORDER_HOOK");
        vm.label(address(manager), "POOL_MANAGER");
    }

    function _approveUser(address user) internal {
        vm.startPrank(user);
        stablecoin.approve(address(modifyLiquidityRouter), type(uint256).max);
        token.approve(address(modifyLiquidityRouter), type(uint256).max);
        stablecoin.approve(address(swapRouter), type(uint256).max);
        token.approve(address(swapRouter), type(uint256).max);
        stablecoin.approve(address(hook), type(uint256).max);
        token.approve(address(hook), type(uint256).max);
        vm.stopPrank();
    }

    function _swapExactIn(address user, bool zeroForOne, uint256 amountIn) internal returns (BalanceDelta delta) {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT
        });
        PoolSwapTest.TestSettings memory settings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});

        vm.prank(user);
        delta = swapRouter.swap(poolKey, params, settings, ZERO_BYTES);
    }

    function _swapStableForToken(address user, uint256 amountIn) internal returns (BalanceDelta) {
        return _swapExactIn(user, stableIsCurrency0, amountIn);
    }

    function _swapTokenForStable(address user, uint256 amountIn) internal returns (BalanceDelta) {
        return _swapExactIn(user, !stableIsCurrency0, amountIn);
    }

    function _expectedFeeFromDelta(BalanceDelta delta) internal view returns (uint256) {
        int128 stableDelta = stableIsCurrency0 ? delta.amount0() : delta.amount1();
        uint256 absStable = stableDelta < 0 ? uint256(uint128(-stableDelta)) : uint256(uint128(stableDelta));
        return (absStable * DEFAULT_FEE) / FEE_DENOMINATOR;
    }
}
