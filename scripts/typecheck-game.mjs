// Type-checks the game code (tsconfig.game.json). Errors inside the asset folders
// (owned by the asset agent, not editable here) are reported but do not fail the check.
// See docs/PROGRESS.md "Requests to asset owner".
import { spawnSync } from 'node:child_process';

const ASSET_DIRS = ['src/characters/', 'src/weapons/', 'src/maps/'];
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.game.json', '--pretty', 'false'], { encoding: 'utf8' });
const lines = `${result.stdout}${result.stderr}`.split('\n').filter(Boolean);
const errorLines = lines.filter((l) => / error TS\d+:/.test(l));
const assetErrors = errorLines.filter((l) => ASSET_DIRS.some((d) => l.startsWith(d)));
const gameErrors = errorLines.filter((l) => !assetErrors.includes(l));
if (assetErrors.length) console.log(`note: ${assetErrors.length} type error(s) inside asset folders (ignored, owner request logged)`);
for (const l of gameErrors) console.error(l);
if (gameErrors.length || (result.status !== 0 && errorLines.length === 0)) {
  if (!errorLines.length) console.error(lines.join('\n'));
  console.error(`typecheck FAILED: ${gameErrors.length} error(s) in game code`);
  process.exit(1);
}
console.log('typecheck OK (game code)');
