// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
/**
 * @title BatchSettlement
 * @notice Atomically settles ICO winners on Ethereum after Sapphire processing.
 *         Handles token distribution and payment collection in single transaction.
 */
contract BatchSettlement {
    
    /* ========== Events ========== */
    
    event BatchSettled(
        uint256 indexed saleId,
        uint256 winnersCount,
        uint256 totalTokens,
        uint256 totalPayment
    );
    
    event SettlementFailed(
        uint256 indexed saleId,
        address indexed winner,
        uint256 amount,
        string reason
    );
    
    /* ========== Data Types ========== */
    
    struct SettlementData {
        address winner;
        uint256 tokenAmount;
        uint256 payment;
        bytes permitSig;
    }
    
    struct BatchSettleParams {
        uint256 saleId;
        address issuer;
        address tokenAddress;
        address paymentToken;
        SettlementData[] settlements;
        bytes teeSignature;
    }
    
    /* ========== Storage ========== */
    
    // TEE public key for signature verification
    address public immutable teePubKey;
    
    // Processed sales to prevent double settlement
    mapping(uint256 => bool) public processedSales;
    
    /* ========== Constructor ========== */
    
    constructor(address teePubKey_) {
        require(teePubKey_ != address(0), "zero tee key");
        teePubKey = teePubKey_;
    }
    
    /* ========== Public API ========== */
    
    /**
     * @notice Atomically settles all winners for a sale.
     * @param params Batch settlement parameters including winners and signatures.
     * @dev Fails gracefully - if any winner fails, continues with others.
     */
    function batchSettle(BatchSettleParams calldata params) 
        external 
    {
        require(!processedSales[params.saleId], "sale already processed");
        require(params.settlements.length > 0, "no settlements");
        
        // Verify TEE signature
        bytes32 digest = keccak256(abi.encode(params.saleId, params.settlements));
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(digest), params.teeSignature);
        require(signer == teePubKey, "invalid tee signature");
        
        processedSales[params.saleId] = true;
        
        IERC20 token = IERC20(params.tokenAddress);
        IERC20Permit paymentToken = IERC20Permit(params.paymentToken);
        
        uint256 successCount = 0;
        uint256 totalTokens = 0;
        uint256 totalPayment = 0;
        
        // Process each settlement
        for (uint256 i = 0; i < params.settlements.length; i++) {
            SettlementData calldata settlement = params.settlements[i];
            
            if (_processSettlement(
                params.saleId,
                params.issuer,
                settlement,
                token,
                paymentToken
            )) {
                successCount++;
                totalTokens += settlement.tokenAmount;
                totalPayment += settlement.payment;
            }
        }
        
        emit BatchSettled(params.saleId, successCount, totalTokens, totalPayment);
    }
    
    /* ========== Internal Helpers ========== */
    
    /**
     * @dev Processes a single settlement with error handling.
     * @return success Whether the settlement succeeded.
     */
    function _processSettlement(
        uint256 saleId,
        address issuer,
        SettlementData calldata settlement,
        IERC20 token,
        IERC20Permit paymentToken
    ) internal returns (bool success) {
        try this._executeSettlement(
            issuer,
            settlement,
            token,
            paymentToken
        ) {
            return true;
        } catch Error(string memory reason) {
            emit SettlementFailed(saleId, settlement.winner, settlement.tokenAmount, reason);
            return false;
        } catch {
            emit SettlementFailed(saleId, settlement.winner, settlement.tokenAmount, "unknown error");
            return false;
        }
    }
    
    /**
     * @dev Executes a single settlement (tokens + payment).
     * @dev Made external to use try/catch for error handling.
     */
    function _executeSettlement(
        address issuer,
        SettlementData calldata settlement,
        IERC20 token,
        IERC20Permit paymentToken
    ) external {
        require(msg.sender == address(this), "internal only");
        
        // Decode and execute permit for payment
        (uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) = 
            abi.decode(settlement.permitSig, (uint256, uint256, uint8, bytes32, bytes32));
        
        paymentToken.permit(
            settlement.winner,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );
        
        // Collect payment from winner and send to issuer
        require(
            IERC20(address(paymentToken)).transferFrom(settlement.winner, issuer, settlement.payment),
            "payment transfer failed"
        );
        
        // Transfer tokens from issuer to winner (issuer must have approved this contract)
        require(
            token.transferFrom(issuer, settlement.winner, settlement.tokenAmount),
            "token transfer failed"
        );
    }
} 