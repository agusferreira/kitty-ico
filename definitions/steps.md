🚀 Hack-Day POC — Task List for Codex
(“AI-Scored Pitch-Bid ICO”, Oasis Sapphire + ROFL — 24 h build)

0. Repo Bootstrap (~30 min)
npx degit oasisprotocol/sapphire-hardhat-example ico-pitch-bid
cd ico-pitch-bid
pnpm i            # installs Hardhat, Sapphire plug-ins
mkdir tee front scripts docs
git init && git add . && git commit -m "scaffold"


1. Smart-Contract Minimal (ICO_Contract.sol)
Task
Boilerplate / Hint
createSale() – lock ERC-20 (NEW), store policyHash, deadline
Copy SimpleTokenLocker from sapphire-hardhat-example; add mapping saleId ⇒ Sale
submitBid() – store encBlob, permitSig, maxSpend (private storage)
Use bytes32 bidKey = keccak256(abi.encode(msg.sender, saleId));
finalize() – verify TEE_PUBKEY, loop winners, call IERC20Permit.permit + transferFrom & ERC20.transfer tokens
Study Oasis “confidential counter” sample for signature check

Hard filters, AI weight calc all live in TEE, not Solidity.

2. ROFL TEE Task (tee/score.ts)
Task
Boilerplate / Hint
Decrypt all encBlobs (libsodium HPKE)
Copy hpke-decrypt.ts from ROFL quickstart
fetch("https://kyc-sandbox.xyz/api/check") for each wallet
Use ROFL HTTPS helper (roflFetch)
openai.chat.completions small prompt → 0-1 pitch score
CURL + OPENAI_KEY env; outcome stays sealed
Compute score = 0.6*price + 0.2*geo + 0.2*pitch
Simple JS loop; choose winners via greedy fill
Sign {price, winners[]} with roflSign()
Store enclave pub key in .env for deployment


3. Front-End (front/)
Task
Boilerplate / Hint
npx create-next-app + wagmi + viem template
Use connectKit for wallet UI
Bid form: amount, price, pitch textarea
On submit: hpkeEncrypt(blob) + permit (viem writeContract)
Countdown bar (deadline) from contract call
useContractRead({ functionName: "saleEndTime" })
Result toast after SaleFinalized event
useContractEvent hook


4. Crypto Helpers (scripts/encrypt.ts)
Minimal node util:
// node scripts/encrypt.ts price qty pitch country pubKey

Outputs encBlob hex for manual bid testing.

5. Tests & CI
Task
Tool
Foundry forge test – happy path + deadline
forge-std cheatcodes
Hardhat task npx hardhat run deploy.ts --network sapphire-test
Confirm contract deployed
GitHub Actions: pnpm hardhat test, pnpm tsc, forge test -vvv
Simple “lint-build-test” pipeline


6. Demo Script
Terminal 1: pnpm hardhat node --network sapphire-local.


Terminal 2: pnpm ts-node scripts/demoDeploy.ts (mints NEW, creates sale).


Browser: two wallets → place bids.


Wait deadline (set 2 min).


Manual rofl run tee/score.ts → outputs finalize tx.


pnpm hardhat run scripts/finalize.ts.


Refresh UI ⇒ winners show NEW balance, founder shows USDC.



7. Presentation Checklist
1 slide: Problem (gas wars)


1 slide: Architecture diagram (contract ↔ TEE ↔ OpenAI).


Live 2-min demo: encrypted bids → finalize → atomic settlement.


1 slide: “Where this goes next” (white-label launchpad, DAO sales).



Focus mantra:
 Private bids → AI scoring → single signed finalize → atomic fund pull.
 Anything not on that critical path ⇒ cut or stub.

