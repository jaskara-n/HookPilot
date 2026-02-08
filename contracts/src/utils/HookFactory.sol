// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title HookFactory
/// @notice Minimal CREATE2 deployer for Uniswap v4 hooks.
contract HookFactory {
    error Create2Failed();

    event HookDeployed(address indexed hook, bytes32 salt);

    function deploy(bytes32 salt, bytes memory creationCode) external returns (address hook) {
        assembly {
            hook := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        if (hook == address(0)) revert Create2Failed();
        emit HookDeployed(hook, salt);
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash))))
        );
    }
}
