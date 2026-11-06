# GAME.md — design, numbers, contracts, milestones

All numbers below are STARTING VALUES. They go into `src/config/*.ts` and are tuned
by feel and by tests. Units: meters, seconds, degrees. Status tags:
**DECIDED** = owner decided. **DEFAULT** = proposed default, owner may change.
**LATER** = do not build now.

## 1. Pillars
1. Instant play in a browser tab (link, nickname, play).
2. Good feel: hit feedback, recoil, movement, sound. Feel beats feature count.
3. Identity: ~33 collectible voxel NFT characters (more later), same look in the
   world, lobby, kill feed, killcam.
4. Fair: server authority, identical hit volumes for every character.

## 2. Modes (v1)
### 2.1 Elimination (main) — DECIDED
- Teams (default 4v4), no respawn inside a round. Rounds, first to N wins.
- Presets (`config/rounds.ts`): `test` = first to 3, round 45 s;
  `live` = first to 7, round 105 s (owner wants 90-120 s). Freeze/loadout phase 5 s,
  round end 4 s.
- Round timeout: team with larger total HP of living players wins; tie = draw.
- Loadout: chosen between rounds. Primary (rifle / shotgun / sniper) + pistol + knife
  always. No economy. DEFAULT: max 1 sniper per team.
- Dead player's weapon drops on the ground; walking over + `E` picks it up (swaps
  the slot).
- After death: killcam 3 s (view from the killer), then spectate living teammates.

### 2.2 Cornucopia (Hunger Games) — DECIDED; built 2026-11-01 on Toy Town's lootSpots (owner), own arena later
- Own arena layout (to be made by the asset owner). One life. Last player/team standing wins. Teams optional (`teams=0` =
  free-for-all).
- Everyone starts with knife + pistol with one magazine.
- Weapons and items lie on pedestals placed by the arena data (`pedestals`, `lootSpots`): outer ring =
  pistol ammo, shotgun, medkit; middle ring = rifle, medkit; center of the atrium =
  sniper, rocket boots, medkits. The center is the most contested.
- No shrinking zone in v1.

### 2.3 LATER
Gun Game, Team Deathmatch, Free-for-all with respawn, bomb mode. Keep the mode
interface open (`GameMode` with `onRoundStart/onKill/onTick/isOver`).

## 3. Player and movement — DECIDED/DEFAULT
- HP 100. No passive regeneration. No armor (armor LATER).
- Heal item (medkit): use time 2.5 s, +40 HP up to 100, interrupted by damage or
  weapon switch. Medkits exist only in Cornucopia by default (config flag per mode).
- Run 5.5 m/s. Silent walk (`Shift`) 2.6 m/s, no footstep sound. Crouch 2.2 m/s.
- Gravity 22 m/s², jump velocity 7.0 (about 1.1 m). Air control 30%.
- Rocket boots (double jump): one extra jump in the air, velocity 6.0, short flame
  effect from the feet. Available as a pickup in Cornucopia and as a mutator.
- Movement capsule: radius 0.45, height 1.8 (crouch 1.3). Moving uses Rapier KCC.
- **Hit volumes are separate from the movement capsule and IDENTICAL for every
  character**: head box (0.9 w, 0.9 h, 0.8 d, center y 1.35) and body box
  (0.9 w, 0.89 h, 0.6 d, center y 0.445: torso, arms and legs together). These
  are first guesses from character 01 (neck at y 0.89, total height 1.8); final
  sizes are tuned after the character extents table exists (section 14). Crouch
  scales both boxes. Boxes rotate with player yaw. Headshot = ray hits the head box
  first: damage x2.5.
- Nickname 3-16 chars with a word filter. Anonymous account from the server identity.

## 4. Weapons — DEFAULT, one file `config/weapons.ts`
Hitscan, server checks every shot. Damage falls off slightly with distance only for
the shotgun.

| Weapon | Dmg | Rate | Mag | Reload | Spread (deg) | Notes |
|---|---|---|---|---|---|---|
| Knife | 40 | 0.6 s | - | - | - | range 1.6 m, always available |
| Pistol | 30 | semi, 400 rpm | 12 | 1.6 s | 0.4 | 4 body hits, 2 head hits |
| Rifle | 27 | auto, 600 rpm | 30 | 2.2 s | 0.5 + bloom | ~4 body hits; recoil pattern + random |
| Sniper | 100 | 1.4 s bolt | 5 | 3.0 s | 0.0 scoped, 8 unscoped | scope zoom x3, move speed x0.7 while scoped |
| Shotgun | 8 pellets x 12 | 0.9 s | 6 | 0.5 s per shell | 6 | falloff beyond 8 m |

Spread grows with movement and sustained fire; resets over 0.3 s. Fire sound,
muzzle flash, tracer, hit marker, damage numbers (toggle) are part of the feel.

## 5. Camera and views — DECIDED
- First person is the main view. Viewmodel = weapon + the character's gloves/hands
  (`createViewmodel`). Own head/torso are not rendered in first person.
- **Aiming (ADS, right mouse button) is visible ONLY to the local player**, like in
  Counter-Strike. Other players and the front/second-person camera always see the
  firearm in the same HIP hold (weapon on the right side). Do NOT sync an "aiming"
  flag for visuals and do NOT pass `ads` to `poseCharacter`. (The server may still
  need it later for spread; not now.)
- ADS in first person: viewmodel blends to the centred sight (`ads` 0..1), FOV zooms
  with `fovForAds(weaponId, ads)`, mouse sensitivity scales with
  `adsSensitivityScale(weaponId, ads)`. Sniper uses the 2D scope overlay
  (`scopeOverlay`) and hides the viewmodel when scoped. Shooting without ADS is
  always allowed; the crosshair is drawn by the game.
- ADS input — DECIDED (owner 2026-10-31, build in M3): right mouse button is a TOGGLE
  by default (click once to aim, click again to stop). Setting "ADS mode: toggle / hold"
  switches to hold-to-aim. Weapon switch, reload start and death leave ADS (approved
  2026-10-31).
- "Second person" (`V`): camera in front of the player looking back at the character
  (like Minecraft F5 front view). Own character is rendered in the HIP hold. Distance
  2.5 m, shortened by a ray against walls. **Shooting disabled, reloading allowed.**
  Setting: toggle (default) or hold.
- No behind-the-back third person for now (LATER).
- The character is also shown in lobby (turntable), killcam, spectate, win screen
  (team lined up).

## 6. Networking
### 6.1 Rules
Clients send intents; server owns state. Exception (owner decision 2026-10-30,
revisit after the cloud phase): the client runs its own movement (Rapier KCC) and
sends the result; the server validates it (6.6) and snaps back on violation.
Interpolation for remote players; the local player is corrected only on a snap-back
(by input sequence number). Keep the real values in `config/net.ts`.

### 6.2 Intents (client -> server), initial contract
`move{seq, ack, x, y, z, vx, vy, vz, yaw, pitch, crouch, grounded, walk}` (client KCC result,
sent at the net send rate; `ack` = last server correction the client has applied, older moves are
ignored), room reducers `join_quick{name, character}`, `create_private_room{name, character, bots, difficulty, mode, teams}` (mode `elimination` | `cornucopia`, teams=false = free-for-all),
`join_by_code{code, name, character}`, `leave_room` (M2a), `fire{seq, yaw, pitch, viewTimeMs, scoped}` (server time of the world the client was showing, used for the
rewind; scoped = sniper accuracy only), `reload`, `switch_weapon{slot}` (M2b), `set_primary_weapon{weapon}` (M3), `pick_up{itemId}` (drops: weapon swaps the primary, old one drops; live phase, range
`ITEMS.pickupRadius` + server slack), `reload`, `switchWeapon{slot}`,
`pickup{itemId}`, `useHeal`, `emote{id}`, `ping{x,y,z,kind}` (built 2026-11-01 as `ping{x, y, z}`: event table
`ping_event{recipient, roomId, playerId, team, x, y, z}`, one row per human teammate (free-for-all: only the pinger),
row-level security `recipient = :sender`, one ping per `PINGS.cooldown` per player, alive players only),
`chat{text}` (private rooms only), `joinRoom{code|quick, nickname, characterId}`,
`loadout{primary}`, `pingMeasure` (RTT every 1 s).

### 6.3 State (server -> clients)
Snapshots of players (position, yaw, pitch, hp, weapon, pose flags: speed,
moveDir, shooting, crouching, grounded, dead, emote, reloading), items on the
ground, round state, scores. Events: `hit`, `kill{killer, victim, weapon, head}`,
(M2b implemented: event tables `shot_event{roomId, shooterId, origin, end, hitKind, victimId, part, damage,
killed, rewindMs, hitWithoutRewind}` and `kill_event{roomId, killerId, victimId, headshot, weapon}`; round state
in the `room` row: phase, round, scoreA/B, timeLeft, lastWinner, matchWinner),
`roundStart/End`, `matchEnd`, `emote`, `ping`.
Items on the ground: table `item{id, roomId, kind, weapon, mag, reserve, x, y, z, pedestal}` (kind `weapon` = a gun
with its ammo, `ammo` = pistol rounds in `reserve`, `medkit`, `boots`; pedestal = Cornucopia loot; drops are cleared
when a round starts; at most `ITEMS.maxDropsPerRoom` drops per room). Room: `mode`, `teams`. Player: `healLeft`
(medkit seconds left), `boots`; `primary` = '' while a Cornucopia player has no primary. Free-for-all: every player
has its own team id `F1`, `F2`, ...; `matchWinner` is the winner's team id ('' = draw).
Document the final field list in `docs/CONTRACTS.md` and generate client bindings
before UI work (schema first, rendering after).

### 6.4 Lag compensation (hit validation) — DECIDED
- Server keeps a ring buffer of recent hit-volume positions per player.
- On `fire`, rewind to (shooter's latency + interpolation delay), capped by
  `maxRewindMs`: **300 public rooms, 350 private rooms** (config; owner 2026-10-31, was 250 / 300:
  at 200 ms ping the needed rewind is ~305 ms).
- `interpolationDelayMs` is a separate config value (start 100; owner 2026-10-31: keep 100, test 75 later
  on a real network).
- Raycast against rewound head/body boxes and the map boxes; apply damage now.
- Show ping (RTT) and FPS in the HUD (setting, default on).
- Test with artificial latency 100 and 200 ms (a tester far from the server had
  170-220 ms to Singapore).

### 6.5 Rooms and matchmaking — DECIDED
Room config: `{mode, teamSize, maxPlayers, fillBots, mutator, isPrivate, region,
code, preset}`. Default 4v4, up to 16 after a load test (`100-bot` script).
Entry: Quick Play (nearest region, bots fill), private room by code or link,
bots-only room (practice). Region is part of the room code. One region at first;
rooms are independent so more regions can be added later.

### 6.6 Movement validation — DECIDED (owner 2026-10-30, phase 1)
- Server accepts a `move` only if: seq is newer; horizontal distance since the last
  accepted position <= (max speed for the state + tolerance) x elapsed time; vertical
  change fits jump velocity / gravity / max fall speed (+ tolerance); the capsule does not
  overlap any `mapColliders` box (small epsilon); no single step longer than the teleport
  cap. Values in `config/net.ts`.
- On violation: keep the last valid position and send a correction; the client snaps to
  it and continues from there. Count violations per player (logged, kick threshold later).
- Server bots move along the nav grid and pass the same checks.
- One `MovementAuthority` interface on the server: `ClientValidated` now, a fully
  server-simulated version can replace it later without changing the contract for hits.

### 6.7 Marketplace — DECIDED (owner 2026-11-05: in-game coins only, no real money; accounts by wallet login, 6.8)
Player-to-player market for everything in the game (now: the 33 characters and the 5 lobby emotes; new item kinds
are added to the catalog in `config/market.ts`). Owning an item is a collection only: every character stays
playable for everyone (owner). Numbers in `config/market.ts` (`MARKET`).
- Account = wallet address (6.8). Guests (not logged in) play normally but have no coins, items or market access.
- First login of an address: wallet with `startCoins` and a starter set (random characters + an emote, distinct,
  from the catalog).
- Coins come only from matches (logged-in humans only, at `matchEnd`): win / loss base + per kill + per headshot, capped per
  match; the first win of a UTC day adds a bonus on top of the cap. A match pays only with at least
  `reward.minPlayers` players in the room at the end (bots count) and after `reward.minMatchSeconds` (no farming of
  empty or instant matches). A sale burns a fee (`feeRate`, at least 1 coin).
- Tables (public; owner / seller / buyer are lowercase addresses): `wallet{owner pk, coins, createdAt, lastWinDay}`, `owned_item{id pk, owner, ref,
  acquiredAt}` (ref = catalog id, e.g. `character:vibe-vibers-viber-142`, `emote:wave`; every row is one copy with
  exactly one owner), `listing{id pk, itemId unique, seller, ref, price, createdAt}`, `trade{id pk, itemId, ref, seller,
  buyer, price, fee, at}` (last `tradeHistory` kept), `economy{id pk = 0, minted, burned}` (coins created / destroyed,
  so `sum(wallet.coins) == minted - burned` always holds). Private: `match_stat{playerId pk, headshots}`,
  `match_clock{roomId pk, startedAt}`.
- Reducers: `list_item{itemId, price}` (own, unlisted item; integer price in [`price.min`, `price.max`]; at most
  `maxListingsPerSeller` open listings), `cancel_listing{listingId}` (seller only), `buy_listing{listingId,
  expectedPrice}` (listing exists, not own, price unchanged, enough coins; moves the item, pays seller price - fee,
  burns the fee, logs the trade). Every market reducer needs a login ("log in with a wallet first") and is rate-limited per account (`rateLimit`) and throws a
  `SenderError` with a readable message on refusal. Reducers are transactions: two buyers of one listing -> one
  wins, the other gets "listing is gone".
- Lobby: tab MARKET (3): Browse (search by name, rarity and type filters, sort, at most 60 rows drawn, buy = two
  clicks), My items (sell with a price, cancel), History (last 20 trades); guests see Browse and a login prompt; testnet
  warning in the footer. Rows show the item's lowest listing and latest sale; a price field suggests the lowest listing,
  else the latest sale, else the tier's base price (`marketPrices`, `suggestedPrice`). All read from the public tables.
- Character names shown to players: `config/characterNames.ts` by character id (owner 2026-11-06). Ids stay the keys in
  the tables, so renaming changes nothing for owners.
- Rarity (`MARKET.rarity`, `itemRarity`, owner 2026-11-06): a coloured label only, no gameplay effect. Five tiers, no
  uncommon (owner); common NFTs use the generator's uncommon art (`NFT.skinArt`). Tiers common to legendary for catalog items, mythic kept for season NFTs. Fixed for season rewards and starter emotes, otherwise stable
  from the item id. New players' starter set has nothing above `starterMax`; items they already own stay.
- "Item sold" notice in the lobby (`ui/saleNotice.ts`): count and coins after the fee. Sales during a match or while
  away wait for the lobby; the last one seen is kept per account in the browser, so a new browser starts from now.
- Invariants (checked by `scripts/sim-market.mjs`): coins conserved (`sum == minted - burned`), no negative or
  non-integer balance, every item exactly one owner, every listing points at an item its seller owns, at most one
  listing per item, every trade moved the item to its buyer.

### 6.8 Wallet login and leaderboard — DECIDED (owner 2026-11-05/06)
Testnet only: Robinhood Chain testnet (Ethereum L2). The game never uses mainnet, never sends a transaction and
never calls a chain; a login is a free text signature. Numbers in `config/auth.ts` (`AUTH`).
- Text (`gameplay/walletMessage.ts loginMessage`): app name + "testnet only" + "not a transaction, costs nothing" +
  "never uses mainnet", then `Address`, `Session` (the connection's identity hex) and `Issued` (ISO time).
  Naming the session stops another connection from reusing the signature.
- Client (`network/walletLogin.ts`): injected EIP-1193 wallet (MetaMask): `eth_requestAccounts`, `personal_sign`.
- Reducer `login{address, issuedAtMs, signature}`: EIP-191 signer recovery in the module (`gameplay/walletAuth.ts`,
  @noble/curves + @noble/hashes), signer must equal the address, issue time within `maxAgeMs` (and at most
  `maxClockSkewMs` ahead), low-S only, rate-limited per identity. Then `session{identity pk, address, at}` row
  (row-level security: a client sees only its own) and the account's wallet (starter gift on first login).
  `logout{}` deletes the session. Several connections (devices) may share one address; the session survives a
  reconnect with the same token.
- Leaderboard: public `player_stat{owner pk, name, matches, wins, kills, deaths, headshots}` per account. Every
  online match counts (owner: testnet), bots and guests have none: kills / deaths / headshots at each kill,
  matches / wins at `matchEnd` for logged-in humans in the room. Name = the player name in the last match.
- Lobby: player card shows "Log in with wallet" (testnet note) or the short address, coins and Log out.
  Tab LEADERS (4; Settings is now 6): all time, sort by wins / kills / coins, top 50 plus my own place.
- Not done (later, owner decides): NFT ownership checks on the chain, smart-contract wallets (EIP-1271), hiding
  balances, one-account-per-person rules (a new wallet is free, so the starter gift can still be farmed on testnet).

### 6.9 Weekly STRIKE rewards — DECIDED (owner 2026-11-06)
Testnet only. Token STRIKE (`REWARDS.token`, the owner's ERC-20 on Robinhood Chain testnet). Numbers in
`config/rewards.ts`, math in `gameplay/rewards.ts`, steps for the owner in docs/REWARDS.md.
- Weeks start Monday 00:00 UTC (`weekOf`). Points per week: win 10, match 2, kill 1, headshot +1; logged-in
  humans, finished real matches only (`matchPays`: at least 2 players at the end, at least 60 s, same as coins and
  XP). Kills in a match the player leaves, or in a match that does not pay, give no points (owner 2026-11-06). The
  all-time stats (6.8) still count every online match.
- Server: public `week_stat{id "week:owner" pk, week btree, owner, name, matches, wins, kills, headshots}`, added at
  match end (`payWeek`). Clients subscribe to the current week only.
- Payout plan (`payoutPlan`): wallets with at least `minPoints` share the week's pool by points, each capped at
  `maxShareBps` (10%); the rest stays in the contract.
- Contract `contracts/WeeklyDistributor.sol`: holds the pool (funded by the owner), owner-only
  `distribute(week, players[], amounts[])` in batches of `batchSize`; each (week, player) pays at most once, so
  re-sending a batch is safe; `withdraw`, `setOwner`. Players never call it and never sign a transaction.
- Admin page `client/admin.html` (own site https://vibe-strikers-admin.pages.dev via `npm run admin:build`; not in the game build): connect MetaMask (switches to the
  testnet), deploy, fund, load a week from the server's SQL endpoint, pay, withdraw. No private keys anywhere.
- LEADERS tab: "This week" (default: points, wins, kills, matches, estimated STRIKE if the week ended now) and
  "All time" (6.8). A WEEKLY POOL card shows `weekPoolTokens` (or less if the contract holds less) and the
  distributor's live balance with an explorer link: one read-only `eth_call` to the public testnet RPC
  (`network/rewardsPool.ts`, cached `poolRefreshMs`), no wallet needed.

### 6.10 Levels and seasons — DECIDED (owner 2026-11-06)
Free for everyone, separate from the weekly STRIKE points (6.9). Numbers in `config/season.ts`, math in
`gameplay/progression.ts`. Fixed rewards, visible in advance, no random boxes; characters stay playable for everyone,
reward items only add to the tradable collection. Season-only NFTs: later (owner).
- XP only from real matches of logged-in players (same guard as coins, `matchPays`): match 50, win 50, kill 10,
  headshot 5, capped at `matchCap`, first win of the day +100.
- Player level: permanent, starts at 1, each level costs a bit more (`levelOf`), shown on the player card and in LEADERS.
- Season 1: 2026-11-06 to 2026-12-04 UTC, 30 levels of 1800 XP. Levels give coins; every fifth gives an item (emote or
  character); level 30 gives a character and 500 coins. Season XP stops at the end, earned rewards stay claimable.
- Missions (`QUESTS`): daily, weekly and season lines with 3 tiers each: a next tier asks for more and pays more XP
  (daily: play 2 / 5 / 10 games for 50 / 100 / 200 XP). Paid once when a tier is done. The UI says "game" for a match,
  because the HUD counts rounds and a match is first to 3 round wins. Counts come from real matches only.
- Tables (public): `player_progress{owner pk, xp}`, `season_progress{id "season:owner" pk, season btree, owner, xp,
  claimedLevel}`, `quest_progress{id "scope:owner" pk, scope btree (d20398, w2965, s1), owner, matches, wins, kills,
  headshots, done}`. `mission_progress` is unused (removing a table would need a data reset).
- Reducer `claimSeasonRewards` (login + market rate limit): pays levels after `claimedLevel` up to the level reached;
  coins are minted like other coins (economy invariant holds), items are new `owned_item` rows.
- Lobby: tab SEASON (5; Settings moved to 6): level bar, one claim button, the track, the missions.
- End of an online match: reward card (`ui/matchSummary.ts`) with the MVP, XP, coins, STRIKE points, streak, mission tiers
  done, level ups and rewards ready; it compares the account's rows with the match start. Nothing is sent or changed by it.
- Day streak (`DAY_STREAK`, table `day_streak{owner pk, lastDay, streak, best, skipDay}`): the first real match of a day
  pays 20 / 30 / 40 / 50 / 60 / 80 / 150 coins by streak day, then the cycle repeats. One missed day is forgiven at most
  once in 7 days. No paid restore.
- Lobby: the player card shows the nearest goal, and the SEASON tab has a badge while rewards wait.
- In a match (`config/feedback.ts`): DOUBLE / TRIPLE / QUAD / MULTI KILL banners for kills within 4 s, ACE for the whole
  enemy side alone in a round. The controls are shown for 12 s in the first match of a browser.

### 6.11 Season skin NFTs — DECIDED (owner 2026-11-06)
Testnet only (Robinhood Chain testnet). Numbers in `config/nft.ts`, rules in `gameplay/nft.ts`. Skins only change the
look. Getting an NFT costs players nothing and takes no signature; the owner signs in MetaMask on the admin site. In a sale from a
wallet the seller signs for free and the buyer sends the transaction (below): the only player transaction in the game.
- Season levels 5 / 10 / 15 / 20 / 25 / 30 also give a fixed NFT: common pistol, common shotgun, rare rifle, epic sniper,
  legendary knife, mythic rifle. No random boxes: rarity and weapon are known in advance, and the look comes from the seed
  `nftSeed(ref)`, so it is fixed by the wallet and the level.
- The NFT starts in the game. `claimSeasonRewards` adds an `owned_item` row with `ref = nft:<season>:<level>:<earner>` and a
  public `nft{ref pk, tokenId, season, level, earner, weapon, rarity, seed, status btree, recipient, tx}` row (status `game`).
  It can be sold for coins on the market like any item. Levels claimed before NFTs existed are added on the next claim.
- `requestNftSend{itemId}` (the holder, not listed): status `queued`, `recipient` = the holder. One way: a queued or sent NFT
  cannot be listed (`nftListError`), because the game cannot move a token out of a player's wallet.
- Selling from a wallet (owner 2026-11-06, like OpenSea): the holder of a `sent` NFT sets a price in testnet ETH and signs it for
  free (`eth_signTypedData_v4`, `gameplay/nftSale.ts`, no transaction, no approval). The order goes to the public table
  `nft_order{ref pk, seller, priceWei, expiry, signature}` through `listNftOrder`; it shows in Browse. The buyer calls the contract's
  `buy(tokenId, price, expiry, signature)` and pays the price and the gas; the whole price goes to the seller, no fee. Then the buyer's client
  calls `reportNftSale{ref, tx}`, which moves the game's rows. The server cannot read the chain, so that report is trusted: the chain
  is the truth for who holds a token. "Cancel" (`cancelNftOrder`) only removes the listing from the game; the signature stays valid
  until a transfer, `cancelSale` or its expiry (`NFT.sale.expiryDays`). A `sent` NFT cannot be listed for coins (`nftListError`).
- Admin site: loads the queue, the owner signs `mintBatch` (`batchSize` tokens), then the site calls `markNftsSent{refs, tx}`:
  status `sent`. Accepted only from a session of `NFT.admin` or an address in the private table `nft_admin` (local tests).
- Minted directly to the recipient: one transaction, no step through the owner's wallet (owner chose this over minting to
  the owner and sending on).
- Contract `contracts/SeasonSkins.sol`: OpenZeppelin 5.0.2 ERC-721 (5.0.x, because later versions need Cancun opcodes and
  contracts here build for `paris`). `tokenId = earner << 32 | season << 16 | level` is stable, so a batch can be sent again:
  existing tokens are skipped. `skinOf[tokenId] = season << 64 | level << 48 | rarity << 40 | weapon << 32 | seed`.
  `setBaseUri`, `setOwner` owner only; the contract owner cannot move a player's token.
- Live contract: `0x23e30403814d584a3a2b462b6cf3622d246cd589` (deployed by the owner 2026-11-07). The UI opens sending when `NFT.contract` is set. The look comes from Codex's generator: mint for real players
  only after the generator is final, because a minted skin must not change.
- Pictures (`client/game/nftArt.ts`): Codex's generator draws each NFT in the browser from `nftSeed` and `NFT.skinArt`, for the
  market rows and the player's own season track. Nothing is stored.
- Market closed for now (owner 2026-11-06): the MARKET tab shows SOON and does not open. `ui/marketPanel.ts`, its reducers and the wallet sale stay
  in the code. The live contract (`NFT.contract`) is the first one and has no `buy`; `contracts/SeasonSkins.sol` in the repo has it and
  needs a new deploy when the market opens. Do not press "Deploy NFT contract" until then.
- Lobby panel on the left (`ui/armoryPanel.ts`): Weapons (try a standard weapon on the character) and My NFTs (try on, Claim NFT). Claim opens a
  warning first: it creates a blockchain transaction, Robinhood Chain testnet only; the owner sends the mint, so it is not instant.
- Try on: the left panel, or a click on an NFT level of the season track, puts the skin in the lobby character's hand
  (`menuScene.previewSkin`). Only a preview; it clears when the tab changes. Dragging on the lobby scene turns the character around
  its vertical axis (`MENU.dragYawPerPixel`).
- Metadata: `tokenURI` = `NFT.metadataBase` + token id. `npm run nft:metadata` draws every minted NFT in a browser and writes
  `client/public/nft/<id>` (JSON) and `client/public/nft-img/<id>.png`, deployed with the site. Static files, so run it after each mint.
- Not yet: an NFT tab, wearing a skin in a match. The game does not follow transfers made outside it.

## 7. Bots — DECIDED
Server-side fake players using the same intent path. Waypoint graph generated from
`mapData`. Simple behavior: walk between waypoints, turn to visible enemies, shoot
with aim error and 300-500 ms reaction. Difficulty fields exist now
(`accuracy, reaction, aggression`) but only `normal` is implemented. Bots also run in
the load test (100 bots).

## 8. Mutators — DECIDED (built 2026-11-01: lowGravity, bigHeads, oneShot, fastRun, rocketBoots; room field `mutator`,
`create_private_room{..., mutator}`; Quick Play = mutator of the day by UTC date)
`lowGravity` (gravity x0.4), `bigHeads` (head model AND head hit box x2, server
applies it), `oneShot` (any hit kills), `fastRun` (speed x1.5), `rocketBoots`
(everyone has the double jump). Rotation: mutator of the day is chosen by the
server from the UTC date (`index = hash(date) % list`), with an option to force one
in private rooms. A normal round has no mutator.

## 9. Social
Emote wheel (hold `G`, 6 emotes, procedural pose on the character), team pings
(marker for 5 s, rate-limited), text chat in PRIVATE rooms only (rate limit +
word filter). Voice chat LATER.

## 10. HUD and settings
HUD: crosshair, HP, ammo/weapon, round timer and score, kill feed, hit marker,
damage direction, TAB scoreboard, killcam banner, spectate overlay, ping + FPS.
Settings: mouse sensitivity, FOV (default 90, 70-110), volume (master),
crosshair (color, size, style), second-view mode (toggle/hold), ADS mode (toggle
default / hold, owner 2026-10-31, M3), ping+FPS on/off, screen shake when hit
(on / off, default on; camera roll + small offset only, the aim point does not move; 2026-11-01).
Ambient occlusion: on / off, default off until the target laptop sustains 60 FPS; applies live to the world only, never the weapon viewmodel.
Auto resolution: on / off, default on (2026-11-03): lowers the render pixel ratio (1.5 -> 0.75) when FPS drops
because the GPU is too slow, raises it back with headroom (AUTO_RESOLUTION). The panel also shows the graphics card
name and, for built-in graphics, the hint to set the browser to "High performance" in Windows graphics settings.
Key rebinding LATER.

## 11. Visual style — DECIDED
Flat colors with thick black outlines, like the NFT renders, plus soft shadows and
cheap improvements that make it look better (one directional light with soft
shadow map, hemisphere light, simple fog, color grading allowed). Outlines by
inverted hull on boxes or a cheap post-process edge pass: pick the cheaper one after
a profile. Characters come from `src/characters/` already outlined; do not add a
second outline to them.

## 12. Audio
SFX are procedural (ZzFX style), no files: shots per weapon, hit, headshot,
reload, footsteps (positional, silent while sneaking), UI. Since 2026-11-06 the owner's picks from the sound A/B
rounds (cartoon direction) replace the synth for: shots (knife, pistol, rifle, shotgun, sniper), hit, headshot,
footsteps (4 renders, random per step), button hover (lobby, once per button entered) and loot (item picked up;
online after the server accepts). Map in `src/ui/sounds/picks.ts`, volumes in `config/audio.ts` PICKED_SOUNDS.
Footsteps of others are heard only nearby (owner 2026-11-06): full volume to 3 m, silence at 10 m (`AUDIO.hearing`,
`gameplay/hearing.ts`); other sounds keep the 1/d falloff up to 70 m. Walls do not block sound.
Kill, hurt, reload, ping and click keep the synth. No music: the owner removed the generative music and its win /
lose stings on 2026-11-06; effects only.

## 13. Map: "Toy Town" — DECIDED (built and approved by the asset owner)
- Map 1 is `src/maps/data/*.json`, loaded with `loadMapData`. Pastel voxel town,
  about 70 x 70 m (bounds about 35 m half-size), mirror-symmetric team halves, spawns
  about 57 m apart, 6+6 team spawns, 16 FFA spawns, 20 loot spots, zones with names for
  callouts and pings. Three routes: MID (central square with fountain, stairs, big
  striped building), LEFT and RIGHT lanes (see the map README for the chosen option).
  Warm colours = team A half, cool colours = team B half.
- Rendering `buildMap`, physics `mapColliders`, server hit tests `mapShotBlockers`,
  bots derive their waypoint graph from the same data. The map files are NOT edited
  by the game agent.
- Characters are bright (pink, lilac, lime, black); the map is calm on purpose.
- Game needs from the map data: use `spawns`, `lootSpots` (Cornucopia later),
  `zones`, `killY`, light/fog settings. Reserve `surface?: 'normal' | 'ice'` for a
  later ice map (not in the data yet: ask the asset owner via PROGRESS.md).
- Cornucopia (Hunger Games) needs its own arena layout: LATER, not in the first week.

## 14. Characters and weapons (assets, finished)
- Public APIs and measured facts are in `docs/ASSETS.md`; the READMEs in
  `src/characters/`, `src/weapons/`, `src/maps/` are the source of truth if they differ.
- Characters: 33 NFT characters (`characters` list), `createCharacter(config)`,
  `poseCharacter(group, state, dt)`, all 1.80 m tall (body), at most 8 meshes. Game owns
  position/yaw of the outer group; the character code owns the `rig`.
- Weapons (visual only): knife, pistol, rifle, sniper, shotgun. Firearms are two-handed
  in third person (long-arm variant, handled inside `poseCharacter` via the optional
  `weapon` state field); knife is one-handed. First person uses `createViewmodel` /
  `poseViewmodel` with the character's own glove colours.
- NOT BUILT (use placeholders, request later in PROGRESS.md): emotes, rocket-boot
  flames, reload/fire arm animation beyond what the weapon API gives.
- Hit volumes are IDENTICAL for every character (fairness): head box 0.9 x 0.9 x 0.8
  (centre y 1.35), body box 0.9 x 0.89 x 0.6 (centre y 0.445), separate from the
  movement capsule. Head/body extents of the 33 characters were not all measured; if a
  character looks much wider than its hit box, log it in PROGRESS.md, do not change boxes.
- Until characters are integrated, every player is a capsule.
- Lobby shows a turntable of the selected character. Character list has `unlock`
  reserved; everything unlocked now.

## 15. Anti-cheat and safety (basic)
Server authority, input rate limits, plausibility checks on movement speed and fire
rate, chat/nickname filter and rate limit.

## 16. Milestones (stop and report after each)
Time box: the cloud credits expire 2026-11-05 and the work starts 2026-10-30, so the
plan below fits about 6 days. Credit guide, ESTIMATE only (owner checks the real
meter): M0 ~8%, M1 ~25%, M2 ~30%, M3 ~25%, rest ~12%. If credits run low, stop at the
end of the current milestone and write the state in PROGRESS.md. Order of priority:
a working fair multiplayer shooter > nice features.

**M0 Environment + starter.** Section "Milestone 0" in CLAUDE.md. Done when: the
starter or the fallback runs, two browser tabs see each other, SpacetimeDB vs Colyseus
decision is recorded, `PROGRESS.md` is updated, the asset folders load (characters,
weapons, map render in a test page).

**M1 Playable single player on Toy Town.** Map from `buildMap`, Rapier KCC movement
on `mapColliders`, first-person camera with viewmodel, pistol + rifle hitscan from
`config/weapons.ts`, capsule or character bots, basic HUD, 60 fps. Done when: you can
play a round vs bots, screenshot saved, no console errors.

**M2 Authoritative multiplayer.** Intents, snapshots, prediction, interpolation, lag
compensation with `maxRewindMs`, rooms by code, bots-only room, artificial latency
test. Real characters (HIP hold, `poseCharacter`) for remote players. Done when: two
real tabs fight fairly at 100 and 200 ms simulated latency.

**M3 Elimination mode.** Round state machine, scoreboard, kill feed, hit markers,
killcam + spectate, ping/FPS HUD, settings (sensitivity, FOV, volume, crosshair),
procedural SFX, character select + nickname, all five weapons (sniper with scope
overlay and ADS zoom), ADS for local player. Done when: a full match works with bots
and a human; owner can open a link and play with a friend by code.

**Later (only if credits remain; otherwise leave for the laptop phase):** drops and
pickup, mutators, second-person view, emote wheel and pings, Cornucopia mode and arena,
generative music, ice map, 12-16 player load test, hosting and regions.

## 17. Open decisions (do not decide silently)
- Hosting provider and region(s) after the cloud phase.
- Final hit-volume sizes (extents of all 33 characters were not fully measured).
- Whether `interpolationDelayMs` can drop below 100 without visible jitter.
- Max room size above 8 (needs the load test).
- Whether sniper limit and medkit-in-Elimination stay as defaults.
