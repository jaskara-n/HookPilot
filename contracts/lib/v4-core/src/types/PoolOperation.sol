// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @notice Compatibility shim for v4-periphery imports.
/// @dev Mirrors the struct definitions in IPoolManager for this v4-core version.
struct ModifyLiquidityParams {
    int24 tickLower;
    int24 tickUpper;
    int256 liquidityDelta;
    bytes32 salt;
}

struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}
