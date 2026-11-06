# Task for Codex: generator of NFT weapon skins (Vibe Strikers)

You own `src/weapons/`. Deliver a **visual generator**, not hand-made skins. Claude owns the contract, minting, server,
market and all gameplay numbers: do not touch those.

## Goal
One system that builds any number of unique weapon skins from data, so no skin is ever made by hand:

```ts
const traits = generateSkinTraits({ weapon: 'rifle', rarity: 'epic', seed: 1234 }); // pure, no Three, same input = same output
const gun = createWeapon('rifle', { skin: traits });                                 // world model
const view = createViewmodel('rifle', characterConfig, { holdSide: 'right', skin: traits }); // first-person model
const png = await renderSkinImage(traits, 512);                                      // image for NFT metadata
```

## Rules for the design
1. **Deterministic:** the seed and the rarity fully decide the look, with a seeded random generator (no `Math.random`,
   no time, no platform-dependent maths). A test proves it: the same input gives byte-identical traits JSON.
2. **Skins only change the look.** Hit boxes, grip coordinates, silhouette limits, animation timing and every gameplay
   number stay as they are, so no skin gives an advantage or changes how the weapon is held.
3. **Traits are parts on top of the existing box-data models and `WeaponPalette`:** body colour set, accent colour set,
   surface pattern (for example stripes, camo blocks, checks, pixel noise, painted), optional add-on boxes that do not
   change the silhouette much, and an optional glow. Every trait has a readable name.
4. **Rarity is visible at a glance:** six tiers, `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic`. Common =
   one colour change. Each higher tier unlocks more traits. Mythic may have an animated glow driven only by the existing
   `poseWeapon` / `poseViewmodel` visual inputs.
5. **Style:** cartoon voxel, same outline and vertex-colour treatment as the rest of the kit. No realism, no real brands,
   no characters or art from existing games or NFT collections.
6. **Weapons:** all IDs in `weaponIds`, including the six toy weapons.
7. **Output for metadata:** `skinMetadata(traits, tokenId)` returns the standard NFT JSON fields: `name`, `description`,
   and `attributes` as `[{ trait_type, value }]`. `image` is filled in later by Claude. No chain code.

## Performance
- At most 15% more triangles than the base weapon; mythic at most 30%. Report the numbers per rarity.
- Share geometry and materials between equal skins. No allocations in `poseWeapon` / `poseViewmodel`.
- No image or other asset files in the game build. No single asset over 2 MB.

## Not part of this task
Contract, minting, drop rates, prices, season rewards, server code, UI panels, `src/config/`, `src/characters/`,
`src/maps/`. If the public API is not enough, write what you need in your report instead of changing other folders.

## Deliver
- Generator and API above, exported from `src/weapons/index.ts`, plus a README section.
- A review page in the Voxel Lab: a grid of every weapon by every rarity, with a seed control.
- A contact sheet image: 6 rarities x 3 weapons, 3 seeds each.
- `verify` script that checks: determinism, 1000 random seeds per weapon without errors, triangle limits, no shared
  state between skins, and that base weapons without `skin` look byte-identical to before.
- A short report: the list of traits, the numbers and anything not finished.

Work in your own copy. Your finished toy weapons are still uncommitted in the game repo, so build on that version, and
list exactly which files changed so that only those are copied over.
