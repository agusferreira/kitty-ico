MVP Definition – AI-Scored “Pitch-Bid” ICO (Kitty ICO)
1 ⟡ Problem & Goal
Launch a token sale that is fair, front-run-proof and strategic (founders choose backers by merit, not only price) – all autonomously, in < 24 h hackathon time.

2 ⟡ Core Flow
Issuer locks N tokens + JSON scoring policy in the Confidential Auction Contract (Oasis Sapphire).


Bidder → browser encrypts {maxPrice, quantity, pitch, country} with contract’s pub-key and submits with an EIP-2612 permit (no ETH up-front leaks).


At deadline a ROFL task inside a TEE:


decrypts every blob,


runs score = 0.6·price + 0.2·geoBoost + 0.2·LLM_pitch(),


chooses allocations to maximise total score,


signs {clearingPrice, winners[], sig}.


Contract verifies sig, pulls funds from winners, transfers tokens, refunds losers – one atomic tx.


Raw pitches & KYC data never leave the enclave; only hashes are written back for audit.


3 ⟡ High-Level Architecture

┌────────────────────────┐
│ Front-End (Next.js)    │
│  • wallet connect      │
│  • HPKE bid encryption │
└───────▲────────────────┘
        │            encrypted blob + permit
        │
┌───────┴──────────────┐
│ Sapphire ICO Contract│ (Confidential EVM)
│  • createSale()      │
│  • submitBid()       │
│  • finalize()        │
│  * encrypted state * │
└───────▲───────┬──────┘
        │       │ AuctionEnded(id, blobs)
        │       ▼
        │  ┌────────────┐ HTTPS / KYC API
        │  │  ROFL TEE  │  LLM call (⟂)
        │  │ (Node/TS)  │──────────►
        │  └────────────┘
        │       │ signed result
        ▼       │
┌──────────────────────┐
│ ERC-20 (USDC/WETH)   │ (permit)
└──────────────────────┘



4 ⟡ UML Workflow

sequenceDiagram
    title AI-Scored Pitch-Bid ICO – Full Flow

    %% ─── ACTORS ──────────────────────────────
    participant Founder
    participant Bidder
    participant UI   as Browser
    participant ICO  as ICO_Contract
    participant TEE  as ROFL_TEE
    participant WETH

    %% ─── 1. SALE CREATION ───────────────────
    Founder ->> ICO: createSale(N tokens, deadline, policyHash)
    Note right of ICO: stores policy hash\nlocks tokens\nemits SaleCreated
    ICO -->> Founder: SaleCreated(id)

    %% ─── 2. BID PREPARATION (OFF-CHAIN) ────
    Note over UI,Bidder: browser encrypts {maxPrice, qty, pitch, country}\nwith ICO public key (HPKE)

    %% ─── 3. BID SUBMISSION ──────────────────
    Bidder ->> UI: sign permit(maxSpend)
    UI ->> ICO: submitBid(id, encBlob, maxSpend, permitSig)
    ICO -->> Bidder: BidReceipt
    Note right of ICO: blob + permit stored privately\nno funds moved yet

    %% ─── 4. DEADLINE REACHED ────────────────
    Note over ICO: deadline hits → SaleEnded event
    ICO -->> TEE: SaleEnded(id, allBlobs)

    %% ─── 5. CONFIDENTIAL SCORING ───────────
    TEE ->> TEE: decrypt bids · run KYC · AI-score · pick winners
    TEE -->> ICO: finalize(id, clearingPrice, winners[], sig)

    %% ─── 6. ATOMIC SETTLEMENT ──────────────
    loop winner in winners[]
        ICO ->> WETH: permit + transferFrom(winner → ICO, pay_i)
        ICO -->> winner: transfer NEW tokens_i
    end
    ICO -->> Founder: transfer proceeds (Σ pay_i)
    ICO -->> All: SaleFinalized(id)




5 ⟡ Tech Stack (Hack-friendly)
Layer
Choice
Rationale
Confidential EVM
Oasis Sapphire
Private state; Solidity unchanged.
Off-chain compute
ROFL task in SGX
Verifiable + confidential AI scoring.
AI Scoring
Call OpenAI GPT-4o via HTTPS inside TEE (small prompt)
Fast – no on-prem model to ship.
Encryption
HPKE (libsodium.js)
Browser side; enclaves use same suite.
Payment token
WETH (EIP-2612)
permit() ⇒ zero upfront leak.
Frontend
Next 14, wagmi + viem
Minimal boilerplate.


6 ⟡ Contract Interface (Solidity 0.8.24)
event SaleCreated(uint256 id, address issuer, uint256 supply);
event BidSubmitted(uint256 id, address bidder);
event SaleFinalized(uint256 id, uint256 price);

function createSale(
    uint256 supply,
    uint256 deadline,
    bytes   policyJsonHash   // stored publicly
) external;

function submitBid(
    uint256 saleId,
    bytes   encBlob,         // HPKE ciphertext
    uint256 maxSpend,        // cap for permit
    bytes   permitSig        // EIP-2612
) external;

function finalize(
    uint256 saleId,
    bytes   result,          // {price, winners[]}
    bytes   teeSig           // enclave signature
) external; // pulls funds, transfers tokens


7 ⟡ Scoring Policy JSON (example)
{
  "hardFilters": { "kyc": true, "allowedCountries": ["US","FR","JP"] },
  "weights": { "price": 0.6, "geoDiversity": 0.2, "pitchAI": 0.2 },
  "maxAllocationPerWallet": 50000
}

Stored on-chain so anyone can audit that the enclave followed it.

8 ⟡ Hackathon Timeline (24 h)
Hour
Deliverable
0-3
Scaffold contract & Foundry tests.
3-6
HPKE encryption util + permit flow.
6-9
ROFL script: decrypt → dummy score → sign.
9-12
Wire finalize(); atomic pull & transfer.
12-15
Integrate OpenAI call inside TEE.
15-18
Front-end: bid form, countdown, result toast.
18-21
Edge-case tests (cap > balance, duplicate bids).
21-24
Polish demo + slides.


9 ⟡ Why Investors Will Like It
Solves real pain: fair allocation > gas wars; founders choose strategic backers.


Demonstrates Oasis USP: confidential storage and verifiable off-chain AI.


Clear revenue: 1-2 % protocol fee on raise; white-label launch platform.


Scalable: same primitive → private NFT drops, domain auctions, DAO bond sales.


One-liner pitch: “We turned an ICO whitelist into an AI-powered, privacy-preserving auction that proves it followed the rules—no bots, no insiders, just the best bids and the best backers.”

