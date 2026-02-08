// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LimitOrderV4Base} from "./base/LimitOrderV4Base.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

contract LimitOrderHookE2E is LimitOrderV4Base {
    function test_scenario_multipleBuyOrders_allExecute_and_claim() public {
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100e6;
        amounts[1] = 150e6;
        amounts[2] = 200e6;

        uint256[] memory prices = new uint256[](3);
        prices[0] = 9e5;
        prices[1] = 8e5;
        prices[2] = 7e5;

        uint256[] memory normalized = new uint256[](3);

        vm.startPrank(user1);
        for (uint256 i = 0; i < 3; i++) {
            hook.placeLimitOrder(poolKey, amounts[i], prices[i], true);
            normalized[i] = hook.getNormalizedPrice(prices[i]);
        }
        vm.stopPrank();

        hook.setMockPrice(1e6);
        _swapStableForToken(user2, 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(6e5);
        _swapStableForToken(user2, 1e6);

        for (uint256 i = 0; i < 3; i++) {
            (uint256 totalLiq, uint256 ccons,) = hook.getPoolOrders(poolKey, normalized[i], true);
            assertEq(totalLiq, 0);
            assertEq(ccons, CUMULATIVE_SCALE);
        }

        uint256 totalExpectedOut;
        for (uint256 i = 0; i < 3; i++) {
            // Execution uses the limit price level, not the new price.
            totalExpectedOut += (amounts[i] * 1e18) / normalized[i];
        }
        token.mint(address(hook), totalExpectedOut);

        uint256 balanceBefore = token.balanceOf(user1);
        vm.prank(user1);
        hook.claimExecutedLimitOrders(poolKey, normalized, true);

        assertApproxEqAbs(token.balanceOf(user1), balanceBefore + totalExpectedOut, 10);
    }

    function test_scenario_multipleUsers_samePrice_claims_proportional() public {
        uint256 price = 8e5;
        uint256 normalized = hook.getNormalizedPrice(price);

        uint256 amt1 = 100e6;
        uint256 amt2 = 200e6;
        uint256 amt3 = 300e6;
        uint256 total = amt1 + amt2 + amt3;

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amt1, price, true);
        vm.prank(user2);
        hook.placeLimitOrder(poolKey, amt2, price, true);
        vm.prank(user3);
        hook.placeLimitOrder(poolKey, amt3, price, true);

        hook.setMockPrice(1e6);
        _swapStableForToken(user1, 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(7e5);
        _swapStableForToken(user1, 1e6);

        (uint256 totalLiq, uint256 ccons,) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiq, 0);
        assertEq(ccons, CUMULATIVE_SCALE);

        // Execution uses the limit price level.
        uint256 totalOut = (total * 1e18) / normalized;
        uint256 out1 = (amt1 * 1e18) / normalized;
        uint256 out2 = (amt2 * 1e18) / normalized;
        uint256 out3 = (amt3 * 1e18) / normalized;

        token.mint(address(hook), totalOut);

        uint256 b1 = token.balanceOf(user1);
        uint256 b2 = token.balanceOf(user2);
        uint256 b3 = token.balanceOf(user3);

        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;

        vm.prank(user1);
        hook.claimExecutedLimitOrders(poolKey, prices, true);
        vm.prank(user2);
        hook.claimExecutedLimitOrders(poolKey, prices, true);
        vm.prank(user3);
        hook.claimExecutedLimitOrders(poolKey, prices, true);

        assertApproxEqAbs(token.balanceOf(user1), b1 + out1, 10);
        assertApproxEqAbs(token.balanceOf(user2), b2 + out2, 10);
        assertApproxEqAbs(token.balanceOf(user3), b3 + out3, 10);
    }

    function test_scenario_userPlacesOrder_partiallyExecutes_cancelsRemainder() public {
        uint256 orderAmount = 500e6;
        uint256 priceLimit = 8e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, orderAmount, priceLimit, true);

        hook.setMockPrice(1e6);
        _swapStableForToken(user2, 1e6);

        // Simulate 50% execution via cumulative rates.
        uint256 ccons = CUMULATIVE_SCALE / 2;
        uint256 expectedOut = (orderAmount / 2) * 1e18 / priceLimit;
        uint256 cout = (expectedOut * CUMULATIVE_SCALE) / orderAmount;
        hook.setPoolCumulativeConsumedPerInput(poolId, normalized, true, ccons);
        hook.setPoolCumulativeOutputPerInput(poolId, normalized, true, cout);

        token.mint(address(hook), expectedOut);

        uint256[] memory prices = new uint256[](1);
        prices[0] = normalized;

        uint256 tokenBefore = token.balanceOf(user1);
        vm.prank(user1);
        hook.claimExecutedLimitOrders(poolKey, prices, true);
        assertApproxEqAbs(token.balanceOf(user1), tokenBefore + expectedOut, 2);

        uint256 stableBefore = stablecoin.balanceOf(user1);
        vm.prank(user1);
        hook.cancelLimitOrder(poolKey, normalized, true);
        assertEq(stablecoin.balanceOf(user1), stableBefore + orderAmount / 2);
    }

    function test_scenario_marketCrash_manyBuyOrdersExecute() public {
        uint256 baseAmount = 50e6;

        uint256[] memory prices = new uint256[](5);
        prices[0] = 95e4;
        prices[1] = 90e4;
        prices[2] = 85e4;
        prices[3] = 80e4;
        prices[4] = 75e4;

        uint256[] memory normalized = new uint256[](5);

        vm.startPrank(user1);
        for (uint256 i = 0; i < 5; i++) {
            hook.placeLimitOrder(poolKey, baseAmount, prices[i], true);
            normalized[i] = hook.getNormalizedPrice(prices[i]);
        }
        vm.stopPrank();

        hook.setMockPrice(1e6);
        _swapStableForToken(user2, 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(7e4);
        _swapStableForToken(user2, 1e6);

        for (uint256 i = 0; i < 5; i++) {
            (uint256 totalLiq, uint256 ccons,) = hook.getPoolOrders(poolKey, normalized[i], true);
            assertEq(totalLiq, 0);
            assertEq(ccons, CUMULATIVE_SCALE);
        }
    }

    function test_scenario_marketPump_manySellOrdersExecute() public {
        uint256 baseAmount = 50e18;

        uint256[] memory prices = new uint256[](5);
        prices[0] = 11e5;
        prices[1] = 12e5;
        prices[2] = 13e5;
        prices[3] = 14e5;
        prices[4] = 15e5;

        uint256[] memory normalized = new uint256[](5);

        vm.startPrank(user1);
        for (uint256 i = 0; i < 5; i++) {
            hook.placeLimitOrder(poolKey, baseAmount, prices[i], false);
            normalized[i] = hook.getNormalizedPrice(prices[i]);
        }
        vm.stopPrank();

        hook.setMockPrice(1e6);
        _swapStableForToken(user2, 1e6);

        vm.roll(block.number + 6);
        hook.setMockPrice(16e5);
        _swapStableForToken(user2, 1e6);

        for (uint256 i = 0; i < 5; i++) {
            (uint256 totalLiq, uint256 ccons,) = hook.getPoolOrders(poolKey, normalized[i], false);
            assertEq(totalLiq, 0);
            assertEq(ccons, CUMULATIVE_SCALE);
        }
    }

    function test_scenario_longIdleTime_noIssuesOnResume() public {
        uint256 amount = 100e6;
        uint256 priceLimit = 8e5;
        uint256 normalized = hook.getNormalizedPrice(priceLimit);

        vm.prank(user1);
        hook.placeLimitOrder(poolKey, amount, priceLimit, true);

        hook.setMockPrice(1e6);
        _swapStableForToken(user2, 1e6);

        vm.roll(block.number + 1000);
        hook.setMockPrice(7e5);
        _swapStableForToken(user2, 1e6);

        (uint256 totalLiq, uint256 ccons,) = hook.getPoolOrders(poolKey, normalized, true);
        assertEq(totalLiq, 0);
        assertEq(ccons, CUMULATIVE_SCALE);
    }

    function test_scenario_highVolume_feesDistributeCorrectly() public {
        stablecoin.mint(address(hook), 1_000_000e6);
        hook.setMockPrice(1e6);

        uint256 treasuryBefore = stablecoin.balanceOf(treasury);
        BalanceDelta delta = _swapStableForToken(user1, 5_000e6);
        uint256 expectedFee = _expectedFeeFromDelta(delta);

        assertGe(expectedFee, hook.MINIMUM_DISTRIBUTION_THRESHOLD());
        assertEq(hook.totalFeesCollected(poolId), expectedFee);
        assertEq(hook.totalFeesDistributed(poolId), expectedFee);
        assertEq(stablecoin.balanceOf(treasury), treasuryBefore + expectedFee);
    }
}
