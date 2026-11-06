# HOSTING.md — put the game online (Windows)

Two parts:
- **Server** = the SpacetimeDB module in `server/` → published to **Maincloud** (SpacetimeDB's hosting).
- **Client** = the built game folder `work\game-dist` → uploaded to **Cloudflare Pages** (free static hosting).

You log in to both accounts yourself. Nothing here needs a credit card for a first test.
Use **PowerShell** for all commands (Start menu → "PowerShell").

---

## 0. One-time setup on the PC

1. Install **Node.js 22 LTS**: https://nodejs.org → "LTS" → run the installer (defaults are fine).
2. Install **Git for Windows**: https://git-scm.com/download/win (defaults are fine).
3. Install the **SpacetimeDB CLI** (PowerShell):
   ```powershell
   iwr https://windows.spacetimedb.com -useb | iex
   ```
   Close and reopen PowerShell, then check: `spacetime --version`
4. Make a free **Cloudflare** account: https://dash.cloudflare.com/sign-up
5. Get the project (once):
   ```powershell
   git clone https://github.com/Lazaniaaa/name.git voxel-arena
   cd voxel-arena
   git checkout claude/game-smoke-test-m0-0pnjf5
   npm ci
   ```

## 1. Choose a database name

Pick a name only you will use, lowercase letters, numbers and dashes, for example `voxel-arena-ostap`.
Below it is written as `YOUR-DB-NAME` — replace it everywhere.

## 2. Publish the server to Maincloud

```powershell
spacetime login
```
A browser window opens: log in (GitHub is easiest). Back in PowerShell, check: `spacetime login show`.

Then, in the project folder:
```powershell
spacetime publish --server maincloud --module-path server YOUR-DB-NAME
```
Answer `y` if it asks. At the end it says `Created new database with name: YOUR-DB-NAME`.
Check that it runs (should show no errors):
```powershell
spacetime logs --server maincloud YOUR-DB-NAME
```

## 3. Build the client for Maincloud

1. In the project folder, copy `.env.production.example` to a new file **`.env.production.local`**
   (File Explorer: copy + paste + rename, or in PowerShell:
   `Copy-Item .env.production.example .env.production.local`).
2. Open `.env.production.local` in Notepad and set your database name:
   ```
   VITE_STDB_URI=https://maincloud.spacetimedb.com
   VITE_STDB_DB=YOUR-DB-NAME
   ```
   Save. (This file is private and is not committed to git.)
3. Build:
   ```powershell
   npm run game:build
   ```
   The game is now in the folder **`work\game-dist`** (it contains `index.html` and an `assets` folder).
4. Optional local check: `npm run game:preview`, open http://127.0.0.1:5191/ and press **Quick Play**.
   It now plays on Maincloud (the scoreboard ping shows the real network delay).

## 4. Upload the client to Cloudflare Pages (direct upload)

1. Open https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** tab →
   **Upload assets** (direct upload, no git needed).
2. Project name: e.g. `voxel-arena` → **Create project**.
3. Drag the **contents** of `work\game-dist` (or the folder itself) into the upload box → **Deploy site**.
4. After a minute you get a link like `https://voxel-arena.pages.dev`. Open it, play, send it to a friend.
   For a private match: **Create private room**, send the 5-letter code; your friend opens the same link
   and joins with the code.

Command-line alternative (instead of steps 1-3):
```powershell
npx wrangler login
npx wrangler pages deploy work/game-dist --project-name voxel-arena
```

## 5. Updating later

Always update the **server first**, then the client.

**Server** (after `git pull`, when `server/` or `src/` changed):
```powershell
spacetime publish --server maincloud --module-path server YOUR-DB-NAME
```
If it refuses because the database tables changed, publish again with `--delete-data`
(this clears rooms and players; there is no saved progress yet, so nothing important is lost):
```powershell
spacetime publish --server maincloud --module-path server YOUR-DB-NAME --delete-data
```

**Client** (after `git pull`):
```powershell
npm ci
npm run game:build
```
Then upload again: Cloudflare dashboard → your Pages project → **Create deployment** (or
**Deployments** → upload) → drag `work\game-dist` again. Or: `npx wrangler pages deploy work/game-dist --project-name voxel-arena`.

**Live now: two links, ALWAYS update both (owner's decision).** Same build, same Maincloud database `vibe-strikers`:
- Main: https://vibe-strikers.pages.dev (Cloudflare Pages project `vibe-strikers`)
- Mirror: https://vibe-strikers.voxel-character-review.workers.dev (Worker `vibe-strikers`; some networks, such as
  the owner's, block every `*.pages.dev`)

Build from a clean checkout (not a working copy with someone's uncommitted files), with `.env.production.local` as in
step 3. Deploy from a folder OUTSIDE the repo that holds only the built files, because wrangler 4.158 runs an
"autoconfig" inside a project folder that rewrites package.json and vite.config.js. `D:\vs-upload` holds `site\` (a
copy of `work\game-dist`) and this `wrangler.jsonc`:
```json
{
  "name": "vibe-strikers",
  "compatibility_date": "2026-11-04",
  "assets": { "directory": "./site", "not_found_handling": "single-page-application" }
}
```
Then, in `D:\vs-upload`:
```powershell
npx wrangler@4.158.0 pages deploy site --project-name vibe-strikers --branch main --commit-dirty=true
npx wrangler@4.158.0 deploy
```
Check that both links serve the same `assets/index-*.js` name in their HTML.

## Notes

- The game connects to the server written in `.env.production.local` at **build time**. Without that file
  the build uses the local server (`ws://127.0.0.1:3000`, database `voxel-arena`), as in development.
  For testing you can also add `?server=https://maincloud.spacetimedb.com&db=YOUR-DB-NAME` to the game URL.
- The built folder works from any static host and from a sub-folder (relative paths), not only Cloudflare.
- The server's 30 Hz tick only runs while at least one room exists, so an empty server does no work.
- Maincloud has a free allowance; check usage in the SpacetimeDB dashboard after a few matches.
- Logs while playing: `spacetime logs --server maincloud YOUR-DB-NAME -f` (Ctrl+C to stop).
- Development stays local: `spacetime start` + `npm run server:publish` + `npm run game:dev` (see PROGRESS.md).
