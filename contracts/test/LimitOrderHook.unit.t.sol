// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LimitOrderV4Base} from "./base/LimitOrderV4Base.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

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
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore + expectedFee);
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
        assertEq(hook.lastCheckedPrice(poolId), 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(8e5);
        _swapStableForToken(user1, 1e6);

        (uint256 totalLiquidity, uint256 ccons, uint256 cout) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, 0);
        assertEq(ccons, CUMULATIVE_SCALE);
        assertGt(cout, 0);

        uint256 expectedOut = (amount * 1e18) / 8e5;
        token.mint(address(hook), expectedOut);

        uint256 balanceBefore = token.balanceOf(user1);
        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;
        vm.prank(user1);
        hook.claimExecutedLimitOrders(poolKey, prices, true);

        assertEq(token.balanceOf(user1), balanceBefore + expectedOut);
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
        assertEq(hook.lastCheckedPrice(poolId), 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(13e5);
        _swapStableForToken(user2, 1e6);

        (uint256 totalLiquidity, uint256 ccons, uint256 cout) = hook.getPoolOrders(poolKey, normalized, false);
        assertEq(totalLiquidity, 0);
        assertEq(ccons, CUMULATIVE_SCALE);
        assertGt(cout, 0);

        uint256 expectedOut = (amount * 13e5) / 1e18;
        stablecoin.mint(address(hook), expectedOut);

        uint256 balanceBefore = stablecoin.balanceOf(user2);
        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;
        vm.prank(user2);
        hook.claimExecutedLimitOrders(poolKey, prices, false);

        assertEq(stablecoin.balanceOf(user2), balanceBefore + expectedOut);
        (uint256 finalLiq, uint256 claimable,,) = hook.getUserOrder(poolKey, normalized, false, user2);
        assertEq(finalLiq, 0);
        assertEq(claimable, 0);
    }

    function test_revert_NothingToClaim() public {
        uint256[] memory prices = new uint256[](1);
        prices[0] = hook.getNormalizedPrice(9e5);
        vm.expectRevert();
        hook.claimExecutedLimitOrders(poolKey, prices, true);
    }

    function test_claimExecutedLimitOrders_fullExecution_buy() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        uint256 expectedOut = (amount * 1e18) / priceLimit;
        uint256 cout = (expectedOut * CUMULATIVE_SCALE) / amount;
        hook.setPoolCumulativeConsumedPerInput(poolId, normalized, true, CUMULATIVE_SCALE);
        hook.setPoolCumulativeOutputPerInput(poolId, normalized, true, cout);

        token.mint(address(hook), expectedOut);

        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;

        uint256 beforeBal = token.balanceOf(user1);
        vm.prank(user1);
        hook.claimExecutedLimitOrders(poolKey, prices, true);
        assertApproxEqAbs(token.balanceOf(user1), beforeBal + expectedOut, 2);
    }

    function test_claimExecutedLimitOrders_fullExecution_sell() public {
        uint256 amount = 100e18;
        uint256 priceLimit = 12e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user2);
        hook.placeLimitOrder(poolKey, amount, priceLimit, false);

        uint256 expectedOut = (amount * priceLimit) / 1e18;
        uint256 cout = (expectedOut * CUMULATIVE_SCALE) / amount;
        hook.setPoolCumulativeConsumedPerInput(poolId, normalized, false, CUMULATIVE_SCALE);
        hook.setPoolCumulativeOutputPerInput(poolId, normalized, false, cout);

        stablecoin.mint(address(hook), expectedOut);

        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;

        uint256 beforeBal = stablecoin.balanceOf(user2);
        vm.prank(user2);
        hook.claimExecutedLimitOrders(poolKey, prices, false);
        assertApproxEqAbs(stablecoin.balanceOf(user2), beforeBal + expectedOut, 2);
    }

    function test_shouldCheckLimitOrders_blockInterval() public {
        hook.setMockPrice(1e6);
        _swapStableForToken(user1, 1e6);
        uint256 first = hook.lastLimitOrderTraversal(poolId);

        _swapStableForToken(user1, 1e6);
        assertEq(hook.lastLimitOrderTraversal(poolId), first);

        uint256 nextBlock = block.number + 5;
        vm.roll(nextBlock);
        _swapStableForToken(user1, 1e6);
        assertEq(hook.lastLimitOrderTraversal(poolId), nextBlock);
    }

    function test_afterSwap_noExecution_ifPriceUnchanged() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 9e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        hook.setMockPrice(1e6);
        _swapStableForToken(user1, 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(1e6);
        _swapStableForToken(user1, 1e6);

        (uint256 totalLiquidity, uint256 ccons, uint256 cout) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, amount);
        assertEq(ccons, 0);
        assertEq(cout, 0);
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

        assertApproxEqAbs(token.balanceOf(user1), balanceBefore + expectedOut, 1);

        (uint256 userLiq, uint256 claimable,,) = hook.getUserOrder(poolKey, normalized, true, user1);
        assertEq(userLiq, amount / 2);
        assertEq(claimable, 0);
    }

    function test_cancelLimitOrder_partiallyExecuted_refundsRemaining() public {
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

        (uint256 userLiq, uint256 claimable,,) = hook.getUserOrder(poolKey, normalized, true, user1);
        assertEq(userLiq, 0);
        assertGt(claimable, 0);
    }

    function test_batchClaim_multiplePrices() public {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100e6;
        amounts[1] = 150e6;

        uint256[] memory prices = new uint256[](2);
        prices[0] = 9e5;
        prices[1] = 8e5;

        uint256[] memory normalized = new uint256[](2);

        vm.startPrank(user1);
        for (uint256 i = 0; i < 2; i++) {
            hook.placeLimitOrder(poolKey, amounts[i], prices[i], true);
            normalized[i] = hook.getNormalizedPrice(prices[i]);
        }
        vm.stopPrank();

        uint256 totalOut;
        for (uint256 i = 0; i < 2; i++) {
            uint256 expectedOut = amounts[i] * 1e18 / prices[i];
            uint256 cout = (expectedOut * CUMULATIVE_SCALE) / amounts[i];
            hook.setPoolCumulativeConsumedPerInput(poolId, normalized[i], true, CUMULATIVE_SCALE);
            hook.setPoolCumulativeOutputPerInput(poolId, normalized[i], true, cout);
            totalOut += expectedOut;
        }

        token.mint(address(hook), totalOut);
        uint256 beforeBal = token.balanceOf(user1);

        vm.prank(user1);
        hook.claimExecutedLimitOrders(poolKey, normalized, true);

        assertApproxEqAbs(token.balanceOf(user1), beforeBal + totalOut, 2);
    }

    function test_checkCrossedPriceLevels_buy_priceGoesUp_noExecution() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 8e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        hook.exposeCheckCrossedPriceLevels(poolId, 1e6, 15e5, poolKey);

        (uint256 totalLiquidity, uint256 ccons,) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiquidity, amount);
        assertEq(ccons, 0);
    }

    function test_checkCrossedPriceLevels_sell_priceGoesDown_noExecution() public {
        uint256 amount = 100e18;
        uint256 priceLimit = 12e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user2);
        hook.placeLimitOrder(poolKey, amount, priceLimit, false);

        hook.exposeCheckCrossedPriceLevels(poolId, 2e6, 1e6, poolKey);

        (uint256 totalLiquidity, uint256 ccons,) = hook.getPoolOrders(poolKey, normalized, false);
        assertEq(totalLiquidity, amount);
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

    function test_executeOrdersAtPrice_doubleExecutionSameBlock() public {
        uint256 price = hook.getNormalizedPrice(9e5);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, price, true);

        hook.setMockPrice(price);
        hook.exposeExecuteOrdersAtPrice(poolId, price, true, poolKey);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 50e6, price, true);

        hook.exposeExecuteOrdersAtPrice(poolId, price, true, poolKey);

        (uint256 totalLiquidity,,) = hook.getPoolOrders(poolKey, price, true);
        assertEq(totalLiquidity, 50e6);
    }

    function test_updateUserAccounting_accumulates() public {
        uint256 price = hook.getNormalizedPrice(9e5);
        uint256 amount = 100e6;

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, price, true);

        uint256 ccons = CUMULATIVE_SCALE * 3 / 10;
        uint256 cout = CUMULATIVE_SCALE * 2 / 10;
        hook.setPoolCumulativeConsumedPerInput(poolId, price, true, ccons);
        hook.setPoolCumulativeOutputPerInput(poolId, price, true, cout);

        hook.exposeUpdateUserAccounting(poolId, price, true, user1);

        (uint256 userLiq, uint256 claimable, uint256 paidOut, uint256 paidConsumed) =
            hook.getUserOrder(poolKey, price, true, user1);

        assertEq(userLiq, amount - (amount * ccons) / CUMULATIVE_SCALE);
        assertEq(claimable, (amount * cout) / CUMULATIVE_SCALE);
        assertEq(paidOut, cout);
        assertEq(paidConsumed, ccons);
    }

    function test_updateUserAccounting_noChange_ifDeltasZero() public {
        uint256 price = hook.getNormalizedPrice(9e5);
        hook.exposeUpdateUserAccounting(poolId, price, true, user1);
        (uint256 liq, uint256 claimable, uint256 paidOut, uint256 paidConsumed) =
            hook.getUserOrder(poolKey, price, true, user1);
        assertEq(liq, 0);
        assertEq(claimable, 0);
        assertEq(paidOut, 0);
        assertEq(paidConsumed, 0);
    }

    function test_checkCrossedPriceLevels_sell_multipleLevels() public {
        uint256 p1 = hook.getNormalizedPrice(11e5);
        uint256 p2 = hook.getNormalizedPrice(12e5);
        uint256 p3 = hook.getNormalizedPrice(13e5);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e18, 11e5, false);
        vm.prank(user2);
        hook.placeLimitOrder(poolKey, 200e18, 12e5, false);
        vm.prank(user3);
        hook.placeLimitOrder(poolKey, 150e18, 13e5, false);

        hook.setMockPrice(12e5);
        hook.exposeCheckCrossedPriceLevels(poolId, 1e6, 14e5, poolKey);

        (uint256 l1, uint256 c1,) = hook.getPoolOrders(poolKey, p1, false);
        (uint256 l2, uint256 c2,) = hook.getPoolOrders(poolKey, p2, false);
        (uint256 l3, uint256 c3,) = hook.getPoolOrders(poolKey, p3, false);

        assertEq(l1, 0);
        assertEq(l2, 0);
        assertEq(l3, 0);
        assertEq(c1, CUMULATIVE_SCALE);
        assertEq(c2, CUMULATIVE_SCALE);
        assertEq(c3, CUMULATIVE_SCALE);
    }

    function test_checkCrossedPriceLevels_buy_multipleLevels() public {
        uint256 p1 = hook.getNormalizedPrice(9e5);
        uint256 p2 = hook.getNormalizedPrice(8e5);
        uint256 p3 = hook.getNormalizedPrice(7e5);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, 100e6, 9e5, true);
        vm.prank(user2);
        hook.placeLimitOrder(poolKey, 200e6, 8e5, true);
        vm.prank(user3);
        hook.placeLimitOrder(poolKey, 150e6, 7e5, true);

        hook.setMockPrice(8e5);
        hook.exposeCheckCrossedPriceLevels(poolId, 1e6, 6e5, poolKey);

        (uint256 l1, uint256 c1,) = hook.getPoolOrders(poolKey, p1, true);
        (uint256 l2, uint256 c2,) = hook.getPoolOrders(poolKey, p2, true);
        (uint256 l3, uint256 c3,) = hook.getPoolOrders(poolKey, p3, true);

        assertEq(l1, 0);
        assertEq(l2, 0);
        assertEq(l3, 0);
        assertEq(c1, CUMULATIVE_SCALE);
        assertEq(c2, CUMULATIVE_SCALE);
        assertEq(c3, CUMULATIVE_SCALE);
    }

    function test_getNormalizedPrice_roundsDown() public {
        uint256 price = 123456;
        uint256 normalized = hook.getNormalizedPrice(price);
        assertEq(normalized, (price / hook.PRICE_STEP()) * hook.PRICE_STEP());
    }
}
