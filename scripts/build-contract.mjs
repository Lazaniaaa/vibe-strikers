// Compile the weekly-rewards contracts with solc-js (exact version in package.json) and write ABI + bytecode to
// contracts/build/ (committed: the admin page deploys from it, no compiler in the browser).
// Usage: node scripts/build-contract.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['contracts/WeeklyDistributor.sol', 'contracts/SeasonSkins.sol', 'contracts/test/TestToken.sol'];
/** Oldest EVM target that compiles it: runs on any chain (Robinhood Chain is an Arbitrum Orbit L2). */
const EVM_VERSION = 'paris';

const input = {
  language: 'Solidity',
  sources: Object.fromEntries(SOURCES.map((p) => [p, { content: readFileSync(resolve(root, p), 'utf8') }])),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: EVM_VERSION,
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
/** Imports such as @openzeppelin/... come from node_modules (exact version in package.json). */
const findImports = (path) => {
  try { return { contents: readFileSync(resolve(root, 'node_modules', path), 'utf8') }; } catch { return { error: `not found: ${path}` }; }
};
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors ?? []).filter((e) => e.severity === 'error');
for (const e of out.errors ?? []) console.log(e.formattedMessage);
if (errors.length) process.exit(1);

for (const [file, contracts] of Object.entries(out.contracts)) {
  if (!SOURCES.includes(file)) continue; // library files
  for (const [name, c] of Object.entries(contracts)) {
    if (!c.evm.bytecode.object) continue; // interfaces
    const dir = resolve(root, 'contracts/build', file.includes('/test/') ? 'test' : '');
    mkdirSync(dir, { recursive: true });
    const json = { contract: name, source: file, compiler: solc.version(), evmVersion: EVM_VERSION, optimizerRuns: 200,
      abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` };
    writeFileSync(resolve(dir, `${name}.json`), `${JSON.stringify(json, null, 2)}\n`);
    console.log(`${name}: ${(c.evm.bytecode.object.length / 2) | 0} bytes`);
  }
}
