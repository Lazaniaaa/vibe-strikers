# Candy & Toys NFT skins — rarity readability, generator v3

Implemented in the own copy: C:/Users/User/Documents/Codex/2026-11-06/vibe-strikers-nft-skins/. No original game files, gameplay values, holds, grips, muzzle positions, animation timing, packages or contracts changed. No commits.

## What changed from v2

v2 gave almost every tier the same small side panels and top kit. v3 keeps the eight colour sets, six patterns and five per-weapon detail families, but adds a fixed silhouette/finish grammar independent of the random kit. Common and Uncommon are deliberately quieter. New recipes are version 3; regenerate previous recipes from weapon/rarity/seed rather than silently modifying serialized v2 metadata.

| Tier | Silhouette | Reserved colours / material treatment |
| --- | --- | --- |
| Common | Flush sleeve; no raised crown | Strawberry / Peach, flat candy; no procedural noise |
| Uncommon | One shallow cap | Raspberry / Mint, cream strap; flat candy |
| Rare | One T-shaped wafer fin | Lemon Sherbet / orange, restrained inlay |
| Epic | Two taller wings with bright caps | Grape / cyan, larger relief kit and emissive panels |
| Legendary | Wide three-prong candy crown | Cocoa / reserved gold foil; gold side faces and pale top highlights |
| Mythic | Two layered floating halo frames | Reserved ivory / purple / cyan finish; pulsing emissive rails |

The eight palette pools are disjoint across tiers; lower tiers cannot roll gold-foil or prismatic trim. Gold is a stylised vertex-colour treatment, not an extra PBR material. Five modular families (wafer, gumball, licorice, toy blocks, ribbon) still vary the casing. Crown parts are counted inside the existing detail allowance, not added on top of an unbounded budget. Stable chassis binding prevents heat/coil mechanics from stretching the ornament.

Near and far both retain the tier silhouette. Far removes buried faces of the five thin colour plates per outlined box, then spends some of those saved triangles on the ornament. It remains one rigid-skinned draw. Near glowing parts share one extra draw. Mythic uses the same deterministic gain, 0.32–1, from existing time/fire/heat/charge in near, viewmodel and far; each draw uploads its own gain. No per-frame vertex edits or new allocations were added to pose functions. Functional heat/charge indicators of the base toy weapons remain functional at every rarity.

First person keeps the profile as recessed inlays within the original paint plates: the opaque silhouette cannot grow. The reserved palettes, gold treatment, layering and glow remain visible there. The larger raised world ornament is not put in front of the player's camera.

## Checks

- node src/weapons/verifySkins.mjs: PASS; 11,000 seeded recipes across 11 IDs, near and far builds; 990 near poses, 990 far poses, 1980 viewmodel poses.
- Independent Node processes, with Three imports forbidden, produce byte-identical traits JSON. Library counts, six distinct profiles, disjoint tier palette pools and reserved finishes are asserted.
- Immutable no-skin fixtures: all 11 world hashes and 33 viewmodel animation hashes unchanged. Named part/socket transforms, hands and original animations unchanged.
- Geometry/material sharing, cache disposal/recreation, instance glow isolation and pose-path allocation syntax checks pass.
- Largest near triangle multiple: 2.8993x (limit 3x). Largest measured size increase: 12.918% (limit 15%, including tested animated near/far poses). Near <= base +1 draw; far <= base triangles, one draw.
- Size oracle now measures exact transformed vertices, updating skin bind matrices first, for both the base and skin. Rotating a merged barrel+crown AABB creates fictitious empty extreme corners; the old loose AABB is not a physical model-size measurement. The 15% threshold was not raised.
- GPU viewmodel masks: 396 cases, FOV70, 384x216, maximum 0 additional opaque pixels. Near instance-colour isolation: true; far isolation: true; far glow visibly animates: true.
- 64x64 monochrome silhouette masks: all 15 tier pairs differ for all 11 weapons in both near/far (330 pair comparisons). Smallest difference: 4 pixels. This establishes distinct projected silhouettes, not a human blind-classification score. Colour finishes are an additional cue. The contact sheet/64px strip are provided for owner judgement.
- Scoped strict TypeScript and standalone lab production build pass. No added file or build chunk over 2 MB; no new package.
- Whole-game typecheck is still blocked by existing six-toy WeaponId integration errors in client/game/visuals.ts and src/config/weapons.ts, plus a generated contracts/build/WeeklyDistributor.json absent from the isolated copy. Those files were not changed.

## Maximum ceilings per rarity, across all 11 weapons / 1,000 seeds each

| Tier | Near triangles | Near potential draws | Far triangles | Far draws |
| --- | --- | --- | --- | --- |
| common | 4816 | 5 | 1680 | 1 |
| uncommon | 5114 | 5 | 1702 | 1 |
| rare | 5558 | 5 | 1746 | 1 |
| epic | 5902 | 6 | 1790 | 1 |
| legendary | 6328 | 6 | 1834 | 1 |
| mythic | 6614 | 6 | 1878 | 1 |

## Full weapon / rarity table

| Weapon | Tier | Base triangles | Base draws | Near triangles | Near draws | Far triangles | Far draws | Max size ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| knife | common | 576 | 2 | 972 | 2 | 226 | 1 | 1.00000 |
| knife | uncommon | 576 | 2 | 1050 | 2 | 248 | 1 | 1.02106 |
| knife | rare | 576 | 2 | 1230 | 2 | 292 | 1 | 1.06906 |
| knife | epic | 576 | 2 | 1354 | 3 | 336 | 1 | 1.09306 |
| knife | legendary | 576 | 2 | 1516 | 3 | 380 | 1 | 1.11706 |
| knife | mythic | 576 | 2 | 1670 | 3 | 424 | 1 | 1.11046 |
| pistol | common | 1332 | 4 | 2256 | 4 | 396 | 1 | 1.00000 |
| pistol | uncommon | 1332 | 4 | 2422 | 4 | 418 | 1 | 1.03437 |
| pistol | rare | 1332 | 4 | 2646 | 4 | 462 | 1 | 1.08191 |
| pistol | epic | 1332 | 4 | 2858 | 5 | 506 | 1 | 1.10734 |
| pistol | legendary | 1332 | 4 | 3108 | 5 | 550 | 1 | 1.12918 |
| pistol | mythic | 1332 | 4 | 3306 | 5 | 594 | 1 | 1.12379 |
| rifle | common | 1620 | 4 | 2720 | 4 | 534 | 1 | 1.00000 |
| rifle | uncommon | 1620 | 4 | 2930 | 4 | 556 | 1 | 1.02552 |
| rifle | rare | 1620 | 4 | 3198 | 4 | 600 | 1 | 1.07268 |
| rifle | epic | 1620 | 4 | 3410 | 5 | 644 | 1 | 1.09848 |
| rifle | legendary | 1620 | 4 | 3704 | 5 | 688 | 1 | 1.11948 |
| rifle | mythic | 1620 | 4 | 3902 | 5 | 732 | 1 | 1.11458 |
| sniper | common | 2160 | 5 | 3612 | 5 | 638 | 1 | 1.00000 |
| sniper | uncommon | 2160 | 5 | 3866 | 5 | 660 | 1 | 1.02482 |
| sniper | rare | 2160 | 5 | 4222 | 5 | 704 | 1 | 1.07161 |
| sniper | epic | 2160 | 5 | 4478 | 6 | 748 | 1 | 1.09813 |
| sniper | legendary | 2160 | 5 | 4816 | 6 | 792 | 1 | 1.11951 |
| sniper | mythic | 2160 | 5 | 5058 | 6 | 836 | 1 | 1.11380 |
| shotgun | common | 1512 | 2 | 2568 | 2 | 462 | 1 | 1.00000 |
| shotgun | uncommon | 1512 | 2 | 2734 | 2 | 484 | 1 | 1.02883 |
| shotgun | rare | 1512 | 2 | 3002 | 2 | 528 | 1 | 1.07644 |
| shotgun | epic | 1512 | 2 | 3214 | 3 | 572 | 1 | 1.10288 |
| shotgun | legendary | 1512 | 2 | 3464 | 3 | 616 | 1 | 1.12336 |
| shotgun | mythic | 1512 | 2 | 3662 | 3 | 660 | 1 | 1.11900 |
| beam | common | 1080 | 4 | 1828 | 4 | 530 | 1 | 1.00000 |
| beam | uncommon | 1080 | 4 | 1950 | 4 | 552 | 1 | 1.02312 |
| beam | rare | 1080 | 4 | 2174 | 4 | 596 | 1 | 1.07112 |
| beam | epic | 1080 | 4 | 2342 | 5 | 640 | 1 | 1.09512 |
| beam | legendary | 1080 | 4 | 2548 | 5 | 684 | 1 | 1.11912 |
| beam | mythic | 1080 | 4 | 2746 | 5 | 728 | 1 | 1.11252 |
| bouncer | common | 936 | 1 | 1596 | 1 | 286 | 1 | 1.00000 |
| bouncer | uncommon | 936 | 1 | 1718 | 1 | 308 | 1 | 1.02472 |
| bouncer | rare | 936 | 1 | 1898 | 1 | 352 | 1 | 1.07140 |
| bouncer | epic | 936 | 1 | 2066 | 2 | 396 | 1 | 1.09602 |
| bouncer | legendary | 936 | 1 | 2272 | 2 | 440 | 1 | 1.11940 |
| bouncer | mythic | 936 | 1 | 2426 | 2 | 484 | 1 | 1.11280 |
| slingshot | common | 936 | 4 | 1596 | 4 | 286 | 1 | 1.00000 |
| slingshot | uncommon | 936 | 4 | 1718 | 4 | 308 | 1 | 1.02317 |
| slingshot | rare | 936 | 4 | 1898 | 4 | 352 | 1 | 1.07117 |
| slingshot | epic | 936 | 4 | 2066 | 5 | 396 | 1 | 1.09517 |
| slingshot | legendary | 936 | 4 | 2272 | 5 | 440 | 1 | 1.11917 |
| slingshot | mythic | 936 | 4 | 2426 | 5 | 484 | 1 | 1.11257 |
| rail | common | 2880 | 5 | 4816 | 5 | 1680 | 1 | 1.00000 |
| rail | uncommon | 2880 | 5 | 5114 | 5 | 1702 | 1 | 1.02311 |
| rail | rare | 2880 | 5 | 5558 | 5 | 1746 | 1 | 1.07111 |
| rail | epic | 2880 | 5 | 5902 | 6 | 1790 | 1 | 1.09511 |
| rail | legendary | 2880 | 5 | 6328 | 6 | 1834 | 1 | 1.11911 |
| rail | mythic | 2880 | 5 | 6614 | 6 | 1878 | 1 | 1.11251 |
| splat | common | 864 | 2 | 1480 | 2 | 264 | 1 | 1.00000 |
| splat | uncommon | 864 | 2 | 1558 | 2 | 286 | 1 | 1.02652 |
| splat | rare | 864 | 2 | 1782 | 2 | 330 | 1 | 1.07205 |
| splat | epic | 864 | 2 | 1950 | 3 | 374 | 1 | 1.09778 |
| splat | legendary | 864 | 2 | 2112 | 3 | 418 | 1 | 1.11931 |
| splat | mythic | 864 | 2 | 2266 | 3 | 462 | 1 | 1.11305 |
| paintGrenade | common | 576 | 1 | 972 | 1 | 176 | 1 | 1.00000 |
| paintGrenade | uncommon | 576 | 1 | 1050 | 1 | 198 | 1 | 1.02626 |
| paintGrenade | rare | 576 | 1 | 1230 | 1 | 242 | 1 | 1.07291 |
| paintGrenade | epic | 576 | 1 | 1354 | 2 | 286 | 1 | 1.09913 |
| paintGrenade | legendary | 576 | 1 | 1516 | 2 | 330 | 1 | 1.11913 |
| paintGrenade | mythic | 576 | 1 | 1670 | 2 | 374 | 1 | 1.11482 |

## Thumbnail silhouette differences

| Weapon | LOD | Common-Uncommon | Uncommon-Rare | Rare-Epic | Epic-Legendary | Legendary-Mythic | Min any pair |
| --- | --- | --- | --- | --- | --- | --- | --- |
| knife | near | 7 | 22 | 15 | 12 | 19 | 7 |
| knife | far | 6 | 23 | 15 | 12 | 20 | 6 |
| pistol | near | 10 | 25 | 26 | 17 | 21 | 10 |
| pistol | far | 10 | 25 | 26 | 17 | 21 | 10 |
| rifle | near | 13 | 24 | 26 | 22 | 29 | 13 |
| rifle | far | 13 | 24 | 26 | 22 | 29 | 13 |
| sniper | near | 4 | 22 | 23 | 24 | 22 | 4 |
| sniper | far | 4 | 22 | 23 | 24 | 22 | 4 |
| shotgun | near | 16 | 31 | 30 | 26 | 31 | 16 |
| shotgun | far | 16 | 31 | 30 | 26 | 31 | 16 |
| beam | near | 48 | 54 | 51 | 40 | 52 | 39 |
| beam | far | 48 | 54 | 51 | 37 | 49 | 37 |
| bouncer | near | 13 | 34 | 30 | 28 | 31 | 13 |
| bouncer | far | 13 | 34 | 29 | 29 | 31 | 13 |
| slingshot | near | 53 | 53 | 60 | 41 | 46 | 41 |
| slingshot | far | 53 | 53 | 60 | 41 | 45 | 41 |
| rail | near | 11 | 27 | 26 | 21 | 24 | 11 |
| rail | far | 11 | 27 | 26 | 21 | 24 | 11 |
| splat | near | 21 | 39 | 47 | 32 | 37 | 21 |
| splat | far | 21 | 39 | 47 | 32 | 37 | 21 |
| paintGrenade | near | 14 | 44 | 45 | 34 | 35 | 14 |
| paintGrenade | far | 14 | 44 | 45 | 34 | 35 | 14 |

## Existing full-frame draw-call limitation

Actual public-API Toy Town l1/r1 overview, eight vibe-vibers-viber-extra-11 glow characters with Mythic rail far, no postfx/viewmodel:

| World pass | Triangles | Calls |
| --- | --- | --- |
| No weapons / no shadows | 70008 | 70 |
| 8 Mythic far / no shadows | 85032 | 78 |
| No weapons / shadows | 128352 | 122 |
| 8 Mythic far / shadows | 143376 | 130 |

The pre-existing 120-call whole-frame problem remains: 130 calls versus 122 before weapon draws. The browser check continues to flag this budget FAIL, separately from asset checks PASS. The triangle budget is below 200k in this view. This is not a universal full-game FPS certification. Character batching / shadow-caster culling or shared remote-weapon instancing require changes outside the weapon kit; no threshold or out-of-scope rendering was changed.

## Preview and outputs

http://127.0.0.1:5175/skins.html — 11 base weapons + 66 skin cards, seed, near/far, metadata, 512px export. All tiers and base use the same camera/scale derived from the base. The contact sheet has an explicit base row, followed by base / six rarities side by side at 112px for rifle, beam, paintGrenade and seeds 1234/1235/1236. The separate 64px strip shows all eleven weapons. A two-frame preview demonstrates the actual Mythic glow endpoints. Browser console errors in final review: zero.

![Base and six rarity tiers, 112px](skin-review/contact-sheet.png)

![All weapons at 64px](skin-review/rarity-thumbnails.png)

## Finite low-tier appearances

Common and Uncommon have ten simple layouts per weapon each: two reserved palette sets x five kits, with 4,913 flat dye-batch tints per layout (at most +/-8 RGB steps per channel). These are flat colours, not surface noise, and cannot cross the tier palette identity. Inactive random pattern words are excluded from skinVisualKey; actual dye colours are included and equal appearances reuse geometry across seeds. Thus the seeded test reports 6 repeated appearance keys; these are reported, not mint-ready unique NFTs. Higher tiers retain procedural face-pattern variation. Seed uniqueness never guaranteed infinite visible uniqueness. Minting must deduplicate/cap the relevant pools; that policy remains outside this visual generator.

Full copy list and this-round delta: [SKIN_FILES.md](SKIN_FILES.md). Raw records: skin-review/results.json and skin-review/gpu-results.json. Previous contact sheet retained as skin-review/rarity-before.png.
