# REWARDS.md — weekly STRIKE payout (owner's steps, Windows)

Robinhood Chain **testnet** only (chain id 46630). The game never asks players for a transaction; only the owner
signs, in MetaMask, from the local admin page. Rules: GAME.md 6.9. Numbers: `src/config/rewards.ts`.

## Once
1. MetaMask with the wallet that holds STRIKE. It needs a little **testnet ETH** for gas (Robinhood Chain testnet
   faucet: https://faucet.testnet.chain.robinhood.com).
2. Start the admin page (PowerShell, in the project folder):
   ```powershell
   npm run game:dev
   ```
   Open http://127.0.0.1:5190/admin.html in the browser that has MetaMask.
3. **Connect MetaMask** (the page asks MetaMask to switch to / add Robinhood Chain testnet).
4. **Deploy new distributor** → confirm in MetaMask. The page shows the contract address: send it to Claude
   (it goes into `REWARDS.distributor`, so the page and the docs remember it).
5. **Fund**: amount `100000000` (10% of supply) → **Send to distributor** → confirm.

## Every Monday (after 00:00 UTC)
1. `npm run game:dev`, open the admin page, **Connect MetaMask**.
2. Week = last week (filled in), Pool = what to pay this week → **Load points**. Check the list.
3. **Pay this week** → confirm each transaction (100 players per transaction).
   Paid players are skipped if you press it again, so a failed or cancelled batch can simply be sent again.
4. What the 10% per-wallet cap leaves stays in the contract for later weeks (**Withdraw** takes it back).

## Contract
`contracts/WeeklyDistributor.sol` (Solidity 0.8.38, EVM `paris`): `distribute(week, players[], amounts[])`,
`withdraw(to, amount)`, `setOwner(next)`; owner only. Each (week, player) pays once (`paidOf`), `weekTotal(week)`.
Build: `npm run contract:build` (writes `contracts/build/`, committed). Test on an in-process EVM:
`npm run contract:test`.
