// SPDX-License-Identifier: MIT
/**
 * @title ICO_Contract
 * @notice Minimal confidential ICO sale contract for Sapphire.
 *         - Issuer locks ERC-20 tokens (NEW) in createSale()
 *         - Bidders submit encrypted bids off-chain through submitBid()
 *           along with a maxSpend cap and an EIP-2612 permit signature.
 *         - After the deadline, a TEE scores bids, chooses winners and
 *           signs the result blob. Anyone can call finalize() to perform
 *           atomic settlement: verify TEE signature, pull funds via permit,
 *           and distribute the NEW tokens.
 *
 * NOTE:  This is a hack-day skeleton, not production-ready!  Many checks
 *        (overflow, re-entrancy, front-running, partial fills, refunds,
 *        dust handling, etc.) are intentionally left out for clarity.
 */
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ICO_Contract {
    /* ========== Events ========== */

    /// Emitted when a new sale is created and tokens are locked.
    event SaleCreated(uint256 indexed id, address indexed issuer, uint256 supply);

    /// Emitted every time a bid is stored.
    event BidSubmitted(uint256 indexed id, address indexed bidder);

    /// Emitted once the TEE-signed settlement succeeds.
    event SaleFinalized(uint256 indexed id, uint256 price);

    /// Emitted for each winning allocation (TEE agent will execute these on Ethereum)
    event TokensAllocated(uint256 indexed saleId, address indexed winner, uint256 amount, uint256 price);

    /// Emitted when all settlements are recorded
    event SettlementRecorded(uint256 indexed saleId, uint256 totalWinners, uint256 totalTokens);

    /* ========== Data Types ========== */

    struct Sale {
        address issuer;      // sale creator, receives funds
        uint256 supply;      // total tokens locked for sale
        uint256 deadline;    // unix timestamp when bidding ends
        bytes   policyHash;  // hash of public scoring policy JSON
        bool    finalized;   // settlement happened
    }

    struct Bid {
        bytes   encBlob;     // HPKE ciphertext {price, qty, pitch, country}
        uint256 maxSpend;    // cap approved by permit()
        bytes   permitSig;   // ABI-encoded permit signature
        bool    claimed;     // prevents double use
    }

    /* ========== Storage ========== */

    // Sale id => Sale struct
    mapping(uint256 => Sale) public sales;

    // sale id => bidder => Bid struct
    mapping(uint256 => mapping(address => Bid)) private _bids;

    // Incrementing counter for sale ids
    uint256 public nextSaleId;

    // Token contract address (on Ethereum) - for reference only
    IERC20 public immutable newToken;

    // Public address derived from the enclave private key
    address public immutable teePubKey;

    /* ========== Constructor ========== */

    constructor(address teePubKey_, address newToken_) {
        require(teePubKey_ != address(0), "zero tee key");
        require(newToken_ != address(0), "zero token");
        teePubKey = teePubKey_;
        newToken = IERC20(newToken_);
    }

    /* ========== Public API ========== */

    /**
     * @notice Creates a new sale (cross-chain version).
     * @param supply      Amount of NEW tokens put up for sale (on Ethereum).
     * @param deadline    Unix timestamp when bidding ends.
     * @param policyHash  SHA-256 or keccak-256 hash of the scoring policy JSON.
     *
     * NOTE: Tokens remain on Ethereum. Issuer must pre-approve TEE agent
     *       to spend tokens before calling createSale().
     */
    function createSale(
        uint256 supply,
        uint256 deadline,
        bytes calldata policyHash
    ) external returns (uint256 saleId) {
        require(supply > 0, "supply=0");
        require(deadline > block.timestamp, "deadline in past");

        // NOTE: No token transfer here - tokens stay on Ethereum
        // Issuer must pre-approve TEE agent: kittyToken.approve(teeAgent, supply)

        saleId = ++nextSaleId;

        sales[saleId] = Sale({
            issuer: msg.sender,
            supply: supply,
            deadline: deadline,
            policyHash: policyHash,
            finalized: false
        });

        emit SaleCreated(saleId, msg.sender, supply);
    }

    /**
     * @notice Stores an encrypted bid blob plus permit signature.
     * @dev All heavy processing (HPKE decryption, AI scoring, KYC)
     *      occurs off-chain inside the TEE.
     */
    function submitBid(
        uint256 saleId,
        bytes calldata encBlob,
        uint256 maxSpend,
        bytes calldata permitSig
    ) external {
        Sale storage sale = sales[saleId];
        require(sale.deadline != 0, "sale not found");
        require(block.timestamp < sale.deadline, "bidding closed");

        // Each wallet may overwrite its bid; last one counts.
        _bids[saleId][msg.sender] = Bid({
            encBlob: encBlob,
            maxSpend: maxSpend,
            permitSig: permitSig,
            claimed: false
        });

        emit BidSubmitted(saleId, msg.sender);
    }

    /**
     * @notice Verifies the TEE signature and distributes tokens.
     * @param result  ABI-encoded (uint256 clearingPrice, address[] winners)
     *                produced and signed by the enclave.
     * @param teeSig  Signature over keccak256(address(this), saleId, result)
     *
     * Caller can be anyone – verification makes the execution trustless.
     */
    function finalize(
        uint256 saleId,
        bytes calldata result,
        bytes calldata teeSig
    ) external {
        Sale storage sale = sales[saleId];
        require(sale.deadline != 0, "sale not found");
        require(!sale.finalized, "already finalized");
        require(block.timestamp >= sale.deadline, "too early");

        // -------- Verify enclave signature --------
        bytes32 digest = keccak256(abi.encodePacked(address(this), saleId, result));
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(digest), teeSig);
        require(signer == teePubKey, "bad tee sig");

        // Decode result blob: (clearingPrice, winners[])
        (, address[] memory winners) = abi.decode(result, (uint256, address[]));

        // Simple uniform allocation: equally divide remaining supply.
        uint256 amountPerWinner = sale.supply / winners.length;

        // -------- Settle each winning allocation --------
        for (uint256 i = 0; i < winners.length; i++) {
            _settleWinner(saleId, winners[i], amountPerWinner);
        }

        sale.finalized = true;
        emit SaleFinalized(saleId, amountPerWinner);
        
        // Emit summary for TEE agent to know settlement is complete
        emit SettlementRecorded(saleId, winners.length, winners.length * amountPerWinner);
    }

    /* ========== Internal Helpers ========== */

    /**
     * @dev Records settlement for cross-chain execution.
     *      TEE agent will monitor TokensAllocated events and execute 
     *      the actual token transfers on Ethereum.
     */
    function _settleWinner(
        uint256 saleId,
        address winner,
        uint256 amount
    ) internal {
        Bid storage bid = _bids[saleId][winner];
        require(!bid.claimed, "already claimed");

        bid.claimed = true;

        // TODO: decode bid.permitSig and call IERC20Permit for payment token.
        // Skipped for minimal implementation.

        // Record allocation (no actual transfer - TEE agent will execute on Ethereum)
        require(amount <= sales[saleId].supply, "insufficient supply");
        sales[saleId].supply -= amount;

        // Emit event for TEE agent to execute on Ethereum
        emit TokensAllocated(saleId, winner, amount, 0); // price=0 for now
    }

    /* ========== View Helpers ========== */

    function bidOf(uint256 saleId, address bidder) external view returns (Bid memory) {
        return _bids[saleId][bidder];
    }
} 