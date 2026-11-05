# Marketplace — overnight report (branch `market`, 2026-11-05/06)

Owner decisions (2026-11-05): everything in the game is tradable (now 33 characters + 5 lobby emotes), every
character stays playable for everyone, coins only from matches (start 200; win 50 / loss 20 / kill +5 /
headshot +2, cap 150 per match), prices 10-5000, player-to-player only, no push and no merge without the owner.
Added by Claude (allowed by the owner): a 5% sale fee that is burned, +50 for the first win of the UTC day.
Contract: `docs/GAME.md` 6.7. Numbers: `src/config/market.ts`.

## What was built
- Server (SpacetimeDB): tables `wallet`, `owned_item`, `listing`, `trade`, `economy` (public), `match_stat`,
  `match_clock` (private); reducers `list_item`, `cancel_listing`, `buy_listing`; a wallet with 200 coins and a
  starter set (3 random characters + 1 emote) on first connect; rewards at match end; per-identity rate limit.
- Client: `GameNet.subscribeMarket()`, `market` view, `listItem` / `cancelListing` / `buyListing`.
- Lobby: tab **3 MARKET** (Settings is now 4): Browse (filter, sort), My items (sell / cancel), History; buying
  needs a second click to confirm; the coin balance shows on the player card.
- Identity: the first tab of a browser keeps its identity across reloads and restarts (wallet and items stay);
  a second tab gets its own identity, so two tabs are still two players.

## How it was tested
- `node scripts/test-market.mjs`: wallets and starter sets, every refusal (bad price, someone else's item, own
  listing, stale price, not enough coins, cancel someone else's listing), fee and coin movement, two buyers at the
  same moment (exactly one wins), rate limit, no reward for an instant lonely win, coin conservation. `--slow`: a
  real 305 s free-for-all with 7 bots paid exactly the 20-coin loss reward.
- `node scripts/sim-market.mjs`: up to 100 bot traders at once doing honest trades, cheats, same-moment buys,
  bursts over the rate limit, and dropping the connection mid-purchase then coming back with the same token.
  An auditor checks every 2 s: coins conserved (sum of wallets = minted - burned), no bad balance, every item has
  one owner and the right count, every listing belongs to its seller, fees burned match the trades, and at the end
  each bot's own view equals the auditor's.

| Run | Trades | Drops mid-trade | Violations | Unexpected answers |
|---|---:|---:|---:|---:|
| 20 bots x 30 s | 155 | 20 | 0 | 0 |
| 60 bots x 90 s | 411 | 196 | 0 | 0 |
| 100 bots x 90 s | 441 | 129 | 0 | 0 |
| 40 bots x 45 s (after the last server change) | 126 | 53 | 0 | 0 |

Reports: `docs/evidence/market-sim-60bots.json`, `docs/evidence/market-sim-100bots.json`.
Also passing: typecheck, 20 gameplay checks, `scripts/test-server.mjs`, online smoke, menu -> match -> menu.

## Bugs found and fixed
1. **Hanging calls after a dropped connection** (found by the simulation): a buy sent just before the connection
   dropped never finished, so the Buy button would stay busy forever. Now refused at once when offline, and calls
   still waiting fail with "connection lost".
2. **Market list redraws** (found by running the simulation next to the lobby): every trade redrew the list,
   wiping the price being typed and the scroll position; with 1000+ listings it redrew up to 18 times a second.
   Now the typed text, focus and scroll are kept, at most 60 rows are drawn, at most 4 redraws a second
   (60 FPS with 1091 listings while 40 bots trade).
3. **Bad prices**: a negative or huge price failed with a raw technical error. Now checked before sending, with a
   clear message.
4. **Coin farming** (found in code review): a private free-for-all room with nobody else ended right after the
   5 s freeze and paid the win, about 200 coins a minute for doing nothing. Now a match pays only with at least
   2 players in the room at the end (bots count) and after at least 60 s.
5. **Rate limiter memory**: it remembered every identity forever. Idle entries are now pruned.

## Known risks (need the owner's decision, not fixed)
- **Free accounts**: every new browser tab or browser = a new identity with 200 coins and 4 items. Someone can
  open many tabs and move their coins and items to one account through the market (5% fee per move). Real fix:
  a login (later), or smaller starter gifts.
- **Balances are public**: anyone connected can read every wallet and item (needed now for the simple market
  view). Can be hidden later with row-level security, as the team pings are.
- **"Connection lost" during a purchase**: the purchase may still have gone through on the server. The panel
  shows the error; the item appears in "My items" if it did.
- Ownership does not change anything in the game yet (owner: all characters playable).

## How to look at it (morning)
1. Terminal 1: `spacetime start`. Terminal 2: `git switch market`, `npm run server:publish`, `npm run game:build`,
   `npm run game:preview`.
2. Open http://127.0.0.1:5191/ (Ctrl+F5), press **3** for MARKET. Bot listings from the simulation are there.
3. To fill the market with live traders while you watch: `node scripts/sim-market.mjs --bots 20 --seconds 60`.
