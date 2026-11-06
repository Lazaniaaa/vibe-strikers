# REWARDS.md — weekly STRIKE payout (owner's steps, Windows)

Robinhood Chain **testnet** only (chain id 46630). The game never asks players for a transaction; only the owner
signs, in MetaMask, from the local admin page. Rules: GAME.md 6.9. Numbers: `src/config/rewards.ts`.

## Once
1. MetaMask with the wallet that holds STRIKE. It needs a little **testnet ETH** for gas (Robinhood Chain testnet
   faucet: https://faucet.testnet.chain.robinhood.com).
2. Open the admin site **https://vibe-strikers-admin.pages.dev** in the browser that has MetaMask
   (or locally: `npm run game:dev`, then http://127.0.0.1:5190/admin.html).
3. **Connect MetaMask** (the page asks MetaMask to switch to / add Robinhood Chain testnet).
4. **Deploy new distributor** → confirm in MetaMask. The page shows the contract address: send it to Claude
   (it goes into `REWARDS.distributor`, so the page and the docs remember it).
5. **Fund**: amount `100000000` (10% of supply) → **Send to distributor** → confirm.

## Every Monday (after 00:00 UTC)
1. Open https://vibe-strikers-admin.pages.dev, **Connect MetaMask**.
2. Week = last week (filled in), Pool = what to pay this week → **Load points**. Check the list.
3. **Pay this week** → confirm each transaction (100 players per transaction).
   Paid players are skipped if you press it again, so a failed or cancelled batch can simply be sent again.
4. What the 10% per-wallet cap leaves stays in the contract for later weeks (**Withdraw** takes it back).

## Contract
`contracts/WeeklyDistributor.sol` (Solidity 0.8.38, EVM `paris`): `distribute(week, players[], amounts[])`,
`withdraw(to, amount)`, `setOwner(next)`; owner only. Each (week, player) pays once (`paidOf`), `weekTotal(week)`.
Admin site update: `npm run admin:build`, copy `work/admin-dist` to a folder outside the repo, rename
`admin.html` to `index.html`, then `npx wrangler@4.158.0 pages deploy <folder> --project-name vibe-strikers-admin --branch main`.
Build: `npm run contract:build` (writes `contracts/build/`, committed). Test on an in-process EVM:
`npm run contract:test`.
