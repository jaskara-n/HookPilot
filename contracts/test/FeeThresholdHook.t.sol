// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {BalanceDelta, toBalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

import {FeeThresholdHook} from "../src/brand-token/FeeThresholdHook.sol";
import {MintableERC20} from "./mocks/MintableERC20.sol";
import {MockPoolManager} from "./mocks/MockPoolManager.sol";

contract FeeThresholdHookTest is Test {
    using PoolIdLibrary for PoolKey;
    uint256 public constant DEFAULT_FEE = 100;
    uint256 public constant FEE_DENOMINATOR = 10_000;

    MockPoolManager public manager;
    FeeThresholdHook public hook;
    MintableERC20 public stablecoin;
    MintableERC20 public token;

    PoolKey public key;
    bytes32 public poolId;

    address public treasury;

    function setUp() public {
        treasury = makeAddr("treasury");

        manager = new MockPoolManager();
        stablecoin = new MintableERC20("USDC", "USDC", 6);
        token = new MintableERC20("TOKEN", "TKN", 18);

        hook = new FeeThresholdHook(IPoolManager(address(manager)), treasury, stablecoin);

        key = PoolKey({
            currency0: Currency.wrap(address(stablecoin)),
            currency1: Currency.wrap(address(token)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        PoolId id = key.toId();
        poolId = PoolId.unwrap(id);
    }

    function _afterSwapStableDelta(int128 stableDelta) internal {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 0,
            sqrtPriceLimitX96: 0
        });
        BalanceDelta delta = toBalanceDelta(stableDelta, 0);
        vm.prank(address(manager));
        hook.afterSwap(address(this), key, params, delta, "");
    }

    function test_feeAccumulation_belowThreshold_noDistribution() public {
        stablecoin.mint(address(hook), 1_000_000e6);
        uint256 treasuryBefore = stablecoin.balanceOf(treasury);

        _afterSwapStableDelta(10e6);

        uint256 expectedFee = (10e6 * DEFAULT_FEE) / FEE_DENOMINATOR;
        assertEq(hook.accumulatedFees(poolId), expectedFee);
        assertEq(hook.totalFeesCollected(poolId), expectedFee);
        assertEq(hook.totalFeesDistributed(poolId), 0);
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore);
    }

    function test_feeDistribution_atThreshold() public {
        stablecoin.mint(address(hook), 1_000_000e6);
        uint256 treasuryBefore = stablecoin.balanceOf(treasury);

        _afterSwapStableDelta(5_000e6);

        uint256 expectedFee = (5_000e6 * DEFAULT_FEE) / FEE_DENOMINATOR;
        assertEq(hook.accumulatedFees(poolId), 0);
        assertEq(hook.totalFeesCollected(poolId), expectedFee);
        assertEq(hook.totalFeesDistributed(poolId), expectedFee);
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore + expectedFee);
    }

    function test_distributeFees_manualCall() public {
        stablecoin.mint(address(hook), 1_000_000e6);
        uint256 treasuryBefore = stablecoin.balanceOf(treasury);

        _afterSwapStableDelta(10e6);
        uint256 expectedFee = (10e6 * DEFAULT_FEE) / FEE_DENOMINATOR;
        assertEq(hook.accumulatedFees(poolId), expectedFee);
        assertEq(hook.totalFeesCollected(poolId), expectedFee);
        assertEq(hook.totalFeesDistributed(poolId), 0);

        hook.distributeFees(key);
        assertEq(hook.accumulatedFees(poolId), expectedFee);
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore);

        _afterSwapStableDelta(4_000e6);
        uint256 totalFee = expectedFee + (4_000e6 * DEFAULT_FEE) / FEE_DENOMINATOR;
        // still below threshold, no distribution yet
        assertEq(hook.accumulatedFees(poolId), totalFee);
        assertEq(hook.totalFeesCollected(poolId), totalFee);
        assertEq(hook.totalFeesDistributed(poolId), 0);
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore);

        _afterSwapStableDelta(1_000e6);
        uint256 finalFee = totalFee + (1_000e6 * DEFAULT_FEE) / FEE_DENOMINATOR;
        assertEq(hook.accumulatedFees(poolId), 0);
        assertEq(hook.totalFeesCollected(poolId), finalFee);
        assertEq(hook.totalFeesDistributed(poolId), finalFee);
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore + finalFee);
    }

    function test_feeAccumulation_handlesNegativeDelta() public {
        stablecoin.mint(address(hook), 1_000_000e6);
        uint256 treasuryBefore = stablecoin.balanceOf(treasury);

        _afterSwapStableDelta(-10e6);

        uint256 expectedFee = (10e6 * DEFAULT_FEE) / FEE_DENOMINATOR;
        assertEq(hook.accumulatedFees(poolId), expectedFee);
        assertEq(hook.totalFeesCollected(poolId), expectedFee);
        assertEq(hook.totalFeesDistributed(poolId), 0);
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore);
    }
}
