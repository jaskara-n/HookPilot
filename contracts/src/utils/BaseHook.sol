// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

abstract contract BaseHook is IHooks {
    IPoolManager public immutable poolManager;

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    function getHookPermissions() public pure virtual returns (Hooks.Permissions memory);

    function beforeInitialize(address, PoolKey calldata, uint160) external virtual override returns (bytes4) {
        _onlyPoolManager();
        return BaseHook.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external virtual override returns (bytes4) {
        _onlyPoolManager();
        return BaseHook.afterInitialize.selector;
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external virtual override returns (bytes4) {
        _onlyPoolManager();
        return BaseHook.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external virtual override returns (bytes4, BalanceDelta) {
        _onlyPoolManager();
        return (BaseHook.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external virtual override returns (bytes4) {
        _onlyPoolManager();
        return BaseHook.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external virtual override returns (bytes4, BalanceDelta) {
        _onlyPoolManager();
        return (BaseHook.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external virtual override returns (bytes4, BeforeSwapDelta, uint24) {
        _onlyPoolManager();
        return (BaseHook.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    function afterSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external virtual override returns (bytes4, int128) {
        _onlyPoolManager();
        return (BaseHook.afterSwap.selector, 0);
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        virtual
        override
        returns (bytes4)
    {
        _onlyPoolManager();
        return BaseHook.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        virtual
        override
        returns (bytes4)
    {
        _onlyPoolManager();
        return BaseHook.afterDonate.selector;
    }

    function _onlyPoolManager() internal view {
        require(msg.sender == address(poolManager), "Not PoolManager");
    }
}
