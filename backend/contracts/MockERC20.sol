// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Simple ERC20 token with initial supply minted to deployer – used only for tests/demo.
contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 initialSupply_) ERC20(name_, symbol_) {
        _mint(msg.sender, initialSupply_);
    }
} 