// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LimitOrderV4Base} from "./base/LimitOrderV4Base.sol";
import {BalanceDelta, toBalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

contract LimitOrderHookUnit is LimitOrderV4Base {
    function test_revert_InvalidAmount_placeLimitOrder() public {
        vm.expectRevert();
        hook.placeLimitOrder(poolKey, 0, 1e6, true);
    }

    function test_revert_InvalidPriceLimit_placeLimitOrder() public {
        vm.expectRevert();
        hook.placeLimitOrder(poolKey, 1e6, 0, true);
    }

    function test_feeAccumulation_noDistributionBelowThreshold() public {
        stablecoin.mint(address(hook), 1_000_000e6);
        hook.setMockPrice(1e6);

        BalanceDelta delta = _swapStableForToken(user1, 1_000e6);
        uint256 expectedFee = _expectedFeeFromDelta(delta);

        assertGt(expectedFee, 0);
        assertEq(hook.accumulatedFees(poolId), expectedFee);
        assertEq(hook.totalFeesCollected(poolId), expectedFee);
        assertEq(hook.totalFeesDistributed(poolId), 0);
        assertEq(stablecoin.balanceOf(treasury), 0);
    }

    function test_feeDistribution_atThreshold() public {
        stablecoin.mint(address(hook), 1_000_000e6);
        hook.setMockPrice(1e6);

        uint256 treasuryBefore = stablecoin.balanceOf(treasury);
        BalanceDelta delta = _swapStableForToken(user1, 10_000e6);
        uint256 expectedFee = _expectedFeeFromDelta(delta);

        assertGe(expectedFee, hook.MINIMUM_DISTRIBUTION_THRESHOLD());
        assertEq(hook.accumulatedFees(poolId), 0);
        assertEq(hook.totalFeesCollected(poolId), expectedFee);
        assertEq(hook.totalFeesDistributed(poolId), expectedFee);
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore + expectedFee);
    }

    function test_executedOrdersCount_increments() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        hook.setMockPrice(1e6);
        _swapStableForToken(user1, 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(8e5);
        _swapStableForToken(user1, 1e6);

        assertEq(hook.executedOrdersCount(poolId), 1);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, 0);
    }

    function test_placeLimitOrder_buy_and_cancel() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, normalized, true);
        (uint256 userLiquidity,,,) = hook.getUserOrder(poolKey, normalized, true, user1);
        assertEq(totalLiquidity, amount);
        assertEq(userLiquidity, amount);

        uint256 balanceBefore = stablecoin.balanceOf(user1);
        vm.prank(user1);
        hook.cancelLimitOrder(poolKey, normalized, true);

        (uint256 totalAfter,,) = hook.getPoolOrders(poolKey, normalized, true);
        (uint256 userAfter,,,) = hook.getUserOrder(poolKey, normalized, true, user1);
        assertEq(totalAfter, 0);
        assertEq(userAfter, 0);
        assertEq(stablecoin.balanceOf(user1), balanceBefore + amount);
    }

    function test_placeLimitOrder_sell_and_cancel() public {
        uint256 amount = 100e18;
        uint256 priceLimit = 12e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user2);
        hook.placeLimitOrder(poolKey, amount, priceLimit, false);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, normalized, false);
        (uint256 userLiquidity,,,) = hook.getUserOrder(poolKey, normalized, false, user2);
        assertEq(totalLiquidity, amount);
        assertEq(userLiquidity, amount);

        uint256 balanceBefore = token.balanceOf(user2);
        vm.prank(user2);
        hook.cancelLimitOrder(poolKey, normalized, false);

        (uint256 totalAfter,,) = hook.getPoolOrders(poolKey, normalized, false);
        (uint256 userAfter,,,) = hook.getUserOrder(poolKey, normalized, false, user2);
        assertEq(totalAfter, 0);
        assertEq(userAfter, 0);
        assertEq(token.balanceOf(user2), balanceBefore + amount);
    }

    function test_placeLimitOrder_multipleSamePrice_sameUser() public {
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, priceLimit, true);
        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 150e6, priceLimit, true);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, normalized, true);
        (uint256 userLiquidity,,,) = hook.getUserOrder(poolKey, normalized, true, user1);
        assertEq(totalLiquidity, 250e6);
        assertEq(userLiquidity, 250e6);
    }

    function test_placeLimitOrder_multipleSamePrice_differentUsers() public {
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, priceLimit, true);
        vm.prank(user2);
        hook.placeLimitOrder(poolKey, 200e6, priceLimit, true);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, normalized, true);
        (uint256 liq1,,,) = hook.getUserOrder(poolKey, normalized, true, user1);
        (uint256 liq2,,,) = hook.getUserOrder(poolKey, normalized, true, user2);
        assertEq(totalLiquidity, 300e6);
        assertEq(liq1, 100e6);
        assertEq(liq2, 200e6);
    }

    function test_placeLimitOrder_multipleDifferentPrices() public {
        uint256 price1 = 9e5;
        uint256 price2 = 8e5;
        uint256 n1 = hook.getNormalizedPrice(price1);
        uint256 n2 = hook.getNormalizedPrice(price2);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, price1, true);
        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 150e6, price2, true);

        (uint256 total1,,) = hook.getPoolOrders(poolKey, n1, true);
        (uint256 total2,,) = hook.getPoolOrders(poolKey, n2, true);
        assertEq(total1, 100e6);
        assertEq(total2, 150e6);
    }

    function test_limitOrder_buy_executes_after_price_drop() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        hook.setMockPrice(1e6);
        _swapStableForToken(user1, 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(8e5);
        _swapStableForToken(user1, 1e6);

        (uint256 totalLiquidity, uint256 ccons, uint256 cout) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, 0);
        assertEq(ccons, CUMULATIVE_SCALE);
        assertGt(cout, 0);

        uint256 expectedOut = (amount * 1e18) / normalized;
        token.mint(address(hook), expectedOut);

        uint256 balanceBefore = token.balanceOf(user1);
        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;
        vm.prank(user1);
        hook.claimExecutedLimitOrders(poolKey, prices, true);

        assertApproxEqAbs(token.balanceOf(user1), balanceBefore + expectedOut, 2);
        (uint256 finalLiq, uint256 claimable,,) = hook.getUserOrder(poolKey, normalized, true, user1);
        assertEq(finalLiq, 0);
        assertEq(claimable, 0);
    }

    function test_limitOrder_sell_executes_after_price_rise() public {
        uint256 amount = 100e18;
        uint256 priceLimit = 12e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user2);
        hook.placeLimitOrder(poolKey, amount, priceLimit, false);

        hook.setMockPrice(1e6);
        _swapStableForToken(user2, 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(13e5);
        _swapStableForToken(user2, 1e6);

        (uint256 totalLiquidity, uint256 ccons, uint256 cout) = hook.getPoolOrders(poolKey, normalized, false);
        assertEq(totalLiquidity, 0);
        assertEq(ccons, CUMULATIVE_SCALE);
        assertGt(cout, 0);

        uint256 expectedOut = (amount * normalized) / 1e18;
        stablecoin.mint(address(hook), expectedOut);

        uint256 balanceBefore = stablecoin.balanceOf(user2);
        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;
        vm.prank(user2);
        hook.claimExecutedLimitOrders(poolKey, prices, false);

        assertApproxEqAbs(stablecoin.balanceOf(user2), balanceBefore + expectedOut, 2);
    }

    function test_claimExecutedLimitOrders_partialExecution_claimsAvailable() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 8e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        uint256 ccons = CUMULATIVE_SCALE / 2;
        uint256 expectedOut = (amount / 2) * 1e18 / priceLimit;
        uint256 cout = (expectedOut * CUMULATIVE_SCALE) / amount;

        hook.setPoolCumulativeConsumedPerInput(poolId, normalized, true, ccons);
        hook.setPoolCumulativeOutputPerInput(poolId, normalized, true, cout);

        token.mint(address(hook), expectedOut);

        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;

        uint256 balanceBefore = token.balanceOf(user1);
        vm.prank(user1);
        hook.claimExecutedLimitOrders(poolKey, prices, true);

        assertApproxEqAbs(token.balanceOf(user1), balanceBefore + expectedOut, 2);

        (uint256 userLiq, uint256 claimable,,) = hook.getUserOrder(poolKey, normalized, true, user1);
        assertEq(userLiq, amount / 2);
        assertEq(claimable, 0);
    }

    function test_cancelLimitOrder_partiallyExecuted_refundsRemaining_buy() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 8e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        uint256 ccons = CUMULATIVE_SCALE / 2;
        uint256 expectedOut = (amount / 2) * 1e18 / priceLimit;
        uint256 cout = (expectedOut * CUMULATIVE_SCALE) / amount;

        hook.setPoolCumulativeConsumedPerInput(poolId, normalized, true, ccons);
        hook.setPoolCumulativeOutputPerInput(poolId, normalized, true, cout);

        uint256 stableBefore = stablecoin.balanceOf(user1);
        vm.prank(user1);
        hook.cancelLimitOrder(poolKey, normalized, true);

        assertEq(stablecoin.balanceOf(user1), stableBefore + amount / 2);
    }

    function test_cancelLimitOrder_partiallyExecuted_refundsRemaining_sell() public {
        uint256 amount = 100e18;
        uint256 priceLimit = 12e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user2);
        hook.placeLimitOrder(poolKey, amount, priceLimit, false);

        uint256 ccons = CUMULATIVE_SCALE / 2;
        uint256 expectedOut = (amount / 2) * priceLimit / 1e18;
        uint256 cout = (expectedOut * CUMULATIVE_SCALE) / amount;

        hook.setPoolCumulativeConsumedPerInput(poolId, normalized, false, ccons);
        hook.setPoolCumulativeOutputPerInput(poolId, normalized, false, cout);

        uint256 tokenBefore = token.balanceOf(user2);
        vm.prank(user2);
        hook.cancelLimitOrder(poolKey, normalized, false);

        assertEq(token.balanceOf(user2), tokenBefore + amount / 2);
    }

    function test_shouldCheckLimitOrders_blockInterval() public {
        hook.setLastLimitOrderTraversal(poolId, 0);
        assertEq(hook.exposeShouldCheckLimitOrders(poolId), true);
        assertEq(hook.lastLimitOrderTraversal(poolId), block.number);

        assertEq(hook.exposeShouldCheckLimitOrders(poolId), false);

        vm.roll(block.number + 5);
        assertEq(hook.exposeShouldCheckLimitOrders(poolId), true);
        assertEq(hook.lastLimitOrderTraversal(poolId), block.number);
    }

    function test_checkCrossedPriceLevels_wrongDirection_noExecution() public {
        uint256 price = 9e5;
        uint256 normalized = hook.getNormalizedPrice(price);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, price, true);

        hook.exposeCheckCrossedPriceLevels(poolId, 9e5, 12e5, poolKey);

        (uint256 totalLiquidity, uint256 ccons,) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, 100e6);
        assertEq(ccons, 0);
    }

    function test_checkCrossedPriceLevels_respectsMaxPriceSteps_buy() public {
        uint256 farPrice = hook.getNormalizedPrice(1e5);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, farPrice, true);

        hook.exposeCheckCrossedPriceLevels(poolId, 30e6, 1e5, poolKey);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, farPrice, true);
        assertEq(totalLiquidity, 100e6);
    }

    function test_checkCrossedPriceLevels_respectsMaxPriceSteps_sell() public {
        uint256 farPrice = hook.getNormalizedPrice(30e6);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e18, farPrice, false);

        hook.exposeCheckCrossedPriceLevels(poolId, 1e5, 30e6, poolKey);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, farPrice, false);
        assertEq(totalLiquidity, 100e18);
    }

    function test_checkCrossedPriceLevels_buy_multipleLevels_executes() public {
        uint256 price1 = 9e5;
        uint256 price2 = 8e5;
        uint256 price3 = 7e5;

        uint256 n1 = hook.getNormalizedPrice(price1);
        uint256 n2 = hook.getNormalizedPrice(price2);
        uint256 n3 = hook.getNormalizedPrice(price3);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, price1, true);
        vm.prank(user2);
        hook.placeLimitOrder(poolKey, 200e6, price2, true);
        vm.prank(user3);
        hook.placeLimitOrder(poolKey, 150e6, price3, true);

        hook.exposeCheckCrossedPriceLevels(poolId, 1e6, 6e5, poolKey);

        (uint256 liq1, uint256 ccons1, uint256 cout1) = hook.getPoolOrders(poolKey, n1, true);
        (uint256 liq2, uint256 ccons2, uint256 cout2) = hook.getPoolOrders(poolKey, n2, true);
        (uint256 liq3, uint256 ccons3, uint256 cout3) = hook.getPoolOrders(poolKey, n3, true);

        assertEq(liq1, 0);
        assertEq(liq2, 0);
        assertEq(liq3, 0);
        assertEq(ccons1, CUMULATIVE_SCALE);
        assertEq(ccons2, CUMULATIVE_SCALE);
        assertEq(ccons3, CUMULATIVE_SCALE);
        assertGt(cout1, 0);
        assertGt(cout2, 0);
        assertGt(cout3, 0);
    }

    function test_checkCrossedPriceLevels_sell_multipleLevels_executes() public {
        uint256 price1 = 11e5;
        uint256 price2 = 12e5;
        uint256 price3 = 13e5;

        uint256 n1 = hook.getNormalizedPrice(price1);
        uint256 n2 = hook.getNormalizedPrice(price2);
        uint256 n3 = hook.getNormalizedPrice(price3);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e18, price1, false);
        vm.prank(user2);
        hook.placeLimitOrder(poolKey, 200e18, price2, false);
        vm.prank(user3);
        hook.placeLimitOrder(poolKey, 150e18, price3, false);

        hook.exposeCheckCrossedPriceLevels(poolId, 1e6, 14e5, poolKey);

        (uint256 liq1, uint256 ccons1, uint256 cout1) = hook.getPoolOrders(poolKey, n1, false);
        (uint256 liq2, uint256 ccons2, uint256 cout2) = hook.getPoolOrders(poolKey, n2, false);
        (uint256 liq3, uint256 ccons3, uint256 cout3) = hook.getPoolOrders(poolKey, n3, false);

        assertEq(liq1, 0);
        assertEq(liq2, 0);
        assertEq(liq3, 0);
        assertEq(ccons1, CUMULATIVE_SCALE);
        assertEq(ccons2, CUMULATIVE_SCALE);
        assertEq(ccons3, CUMULATIVE_SCALE);
        assertGt(cout1, 0);
        assertGt(cout2, 0);
        assertGt(cout3, 0);
    }

    function test_executeOrdersAtPrice_doubleExecution_sameBlock() public {
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, priceLimit, true);
        hook.exposeExecuteOrdersAtPrice(poolId, normalized, true, poolKey);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 50e6, priceLimit, true);
        hook.exposeExecuteOrdersAtPrice(poolId, normalized, true, poolKey);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, 50e6);
    }

    function test_executeOrdersAtPrice_executes_nextBlock() public {
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, priceLimit, true);
        hook.exposeExecuteOrdersAtPrice(poolId, normalized, true, poolKey);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 50e6, priceLimit, true);
        vm.roll(block.number + 1);
        hook.exposeExecuteOrdersAtPrice(poolId, normalized, true, poolKey);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, 0);
    }

    function test_revert_NoOrderAtPrice_cancelLimitOrder() public {
        uint256 price = hook.getNormalizedPrice(9e5);
        vm.expectRevert();
        hook.cancelLimitOrder(poolKey, price, true);
    }

    function test_revert_NothingToClaim_claimExecutedLimitOrders() public {
        uint256[] memory prices = new uint256[](0);
        vm.expectRevert();
        hook.claimExecutedLimitOrders(poolKey, prices, true);
    }

    function test_getUpdatedUserOrder_partialExecution() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 8e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        uint256 ccons = CUMULATIVE_SCALE / 2;
        uint256 executedAmount = amount / 2;
        uint256 expectedOut = (executedAmount * 1e18) / priceLimit;
        uint256 cout = (expectedOut * CUMULATIVE_SCALE) / amount;

        hook.setPoolCumulativeConsumedPerInput(poolId, normalized, true, ccons);
        hook.setPoolCumulativeOutputPerInput(poolId, normalized, true, cout);

        (uint256 claimable, uint256 consumed) =
            hook.getUpdatedUserOrder(poolKey, normalized, true, user1);

        assertEq(consumed, amount / 2);
        assertEq(claimable, expectedOut);
    }

    function test_updateUserAccounting_clearsStale_buy() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        uint256 ccons = CUMULATIVE_SCALE / 2;
        uint256 expectedOut = (amount / 2) * 1e18 / priceLimit;
        uint256 cout = (expectedOut * CUMULATIVE_SCALE) / amount;

        hook.setPoolCumulativeConsumedPerInput(poolId, normalized, true, ccons);
        hook.setPoolCumulativeOutputPerInput(poolId, normalized, true, cout);

        hook.exposeUpdateUserAccounting(poolId, normalized, true, user1);

        (uint256 userLiq, uint256 claimable, uint256 paidOut, uint256 paidCons) =
            hook.getUserOrder(poolKey, normalized, true, user1);

        assertEq(userLiq, amount / 2);
        assertEq(claimable, expectedOut);
        assertEq(paidOut, cout);
        assertEq(paidCons, ccons);
    }

    function test_afterSwap_noPriceChange_skipsExecution() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        hook.setLastCheckedPrice(poolId, 9e5);
        hook.setLastLimitOrderTraversal(poolId, block.number);

        vm.roll(block.number + 6);
        hook.setMockPrice(9e5);
        _swapStableForToken(user2, 1e6);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, amount);
    }

    function test_feeAccumulation_handlesTokenToStableSwap() public {
        stablecoin.mint(address(hook), 1_000_000e6);

        int128 stableDelta = -int128(1_000e6);
        BalanceDelta delta = stableIsCurrency0 ? toBalanceDelta(stableDelta, 0) : toBalanceDelta(0, stableDelta);

        IPoolManager.SwapParams memory params =
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: 0, sqrtPriceLimitX96: 0});

        vm.prank(address(manager));
        hook.afterSwap(address(this), poolKey, params, delta, "");

        uint256 expectedFee = _expectedFeeFromDelta(delta);

        assertGt(expectedFee, 0);
        assertEq(hook.accumulatedFees(poolId), expectedFee);
        assertEq(hook.totalFeesCollected(poolId), expectedFee);
    }

    function test_executeOrdersAtPrice_noLiquidity_returnsZero() public {
        uint256 price = hook.getNormalizedPrice(9e5);
        hook.exposeExecuteOrdersAtPrice(poolId, price, true, poolKey);

        (uint256 totalLiquidity, uint256 ccons, uint256 cout) = hook.getPoolOrders(poolKey, price, true);
        assertEq(totalLiquidity, 0);
        assertEq(ccons, 0);
        assertEq(cout, 0);
    }

    function test_getNormalizedPrice_roundsDown() public {
        uint256 price = 123456;
        uint256 normalized = hook.getNormalizedPrice(price);
        assertEq(normalized, (price / hook.PRICE_STEP()) * hook.PRICE_STEP());
    }
}
