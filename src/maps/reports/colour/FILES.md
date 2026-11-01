# Exact transfer list

Only src/maps was changed. The seven runtime files are sufficient to integrate the art/render/fix changes. Existing game lighting reads the JSON sun/ambient; buildMap automatically supplies the optional hemisphere fill.

## Runtime (copy these)

- [buildMap.ts](D:/voxel-arena/src/maps/buildMap.ts)
- [types.ts](D:/voxel-arena/src/maps/types.ts)
- [data/toy-town.json](D:/voxel-arena/src/maps/data/toy-town.json)
- [data/toy-town-l1-r1.json](D:/voxel-arena/src/maps/data/toy-town-l1-r1.json)
- [data/toy-town-l1-r2.json](D:/voxel-arena/src/maps/data/toy-town-l1-r2.json)
- [data/toy-town-l2-r1.json](D:/voxel-arena/src/maps/data/toy-town-l2-r1.json)
- [data/toy-town-l2-r2.json](D:/voxel-arena/src/maps/data/toy-town-l2-r2.json)

## Every changed or new file

Preview, verification, baselines and reports are optional for game runtime; copy the full list to reproduce verification and evidence. No original files were deleted.

| File | Status | Purpose |
|---|---|---|
| [src/maps/README.md](D:/voxel-arena/src/maps/README.md) | changed | preview / verification / documentation |
| [src/maps/baselines/colour-before.json.gz](D:/voxel-arena/src/maps/baselines/colour-before.json.gz) | new | evidence / verification data |
| [src/maps/baselines/colour-source-guard.json](D:/voxel-arena/src/maps/baselines/colour-source-guard.json) | new | evidence / verification data |
| [src/maps/baselines/toy-town-l1-r1.sha256.json](D:/voxel-arena/src/maps/baselines/toy-town-l1-r1.sha256.json) | changed | evidence / verification data |
| [src/maps/baselines/toy-town-l1-r2.sha256.json](D:/voxel-arena/src/maps/baselines/toy-town-l1-r2.sha256.json) | changed | evidence / verification data |
| [src/maps/baselines/toy-town-l2-r1.sha256.json](D:/voxel-arena/src/maps/baselines/toy-town-l2-r1.sha256.json) | changed | evidence / verification data |
| [src/maps/baselines/toy-town-l2-r2.sha256.json](D:/voxel-arena/src/maps/baselines/toy-town-l2-r2.sha256.json) | changed | evidence / verification data |
| [src/maps/baselines/toy-town.sha256.json](D:/voxel-arena/src/maps/baselines/toy-town.sha256.json) | changed | evidence / verification data |
| [src/maps/buildMap.ts](D:/voxel-arena/src/maps/buildMap.ts) | changed | runtime |
| [src/maps/color-guard.mjs](D:/voxel-arena/src/maps/color-guard.mjs) | changed | preview / verification / documentation |
| [src/maps/data/toy-town-l1-r1.json](D:/voxel-arena/src/maps/data/toy-town-l1-r1.json) | changed | runtime |
| [src/maps/data/toy-town-l1-r2.json](D:/voxel-arena/src/maps/data/toy-town-l1-r2.json) | changed | runtime |
| [src/maps/data/toy-town-l2-r1.json](D:/voxel-arena/src/maps/data/toy-town-l2-r1.json) | changed | runtime |
| [src/maps/data/toy-town-l2-r2.json](D:/voxel-arena/src/maps/data/toy-town-l2-r2.json) | changed | runtime |
| [src/maps/data/toy-town.json](D:/voxel-arena/src/maps/data/toy-town.json) | changed | runtime |
| [src/maps/palettes/endesga32.json](D:/voxel-arena/src/maps/palettes/endesga32.json) | new | preview / verification / documentation |
| [src/maps/preview/colour.html](D:/voxel-arena/src/maps/preview/colour.html) | new | preview / verification / documentation |
| [src/maps/preview/colour.ts](D:/voxel-arena/src/maps/preview/colour.ts) | new | preview / verification / documentation |
| [src/maps/preview/comparison.html](D:/voxel-arena/src/maps/preview/comparison.html) | new | preview / verification / documentation |
| [src/maps/preview/main.ts](D:/voxel-arena/src/maps/preview/main.ts) | changed | preview / verification / documentation |
| [src/maps/reports/colour/FILES.md](D:/voxel-arena/src/maps/reports/colour/FILES.md) | new | evidence / verification data |
| [src/maps/reports/colour/REPORT.md](D:/voxel-arena/src/maps/reports/colour/REPORT.md) | new | evidence / verification data |
| [src/maps/reports/colour/after-contact.png](D:/voxel-arena/src/maps/reports/colour/after-contact.png) | new | evidence / verification data |
| [src/maps/reports/colour/after-fountain.png](D:/voxel-arena/src/maps/reports/colour/after-fountain.png) | new | evidence / verification data |
| [src/maps/reports/colour/after-market.png](D:/voxel-arena/src/maps/reports/colour/after-market.png) | new | evidence / verification data |
| [src/maps/reports/colour/after-spawn-a.png](D:/voxel-arena/src/maps/reports/colour/after-spawn-a.png) | new | evidence / verification data |
| [src/maps/reports/colour/after-spawn-b.png](D:/voxel-arena/src/maps/reports/colour/after-spawn-b.png) | new | evidence / verification data |
| [src/maps/reports/colour/after-views.json](D:/voxel-arena/src/maps/reports/colour/after-views.json) | new | evidence / verification data |
| [src/maps/reports/colour/before-after.png](D:/voxel-arena/src/maps/reports/colour/before-after.png) | new | evidence / verification data |
| [src/maps/reports/colour/before-contact.png](D:/voxel-arena/src/maps/reports/colour/before-contact.png) | new | evidence / verification data |
| [src/maps/reports/colour/before-files.json](D:/voxel-arena/src/maps/reports/colour/before-files.json) | new | evidence / verification data |
| [src/maps/reports/colour/before-fountain.png](D:/voxel-arena/src/maps/reports/colour/before-fountain.png) | new | evidence / verification data |
| [src/maps/reports/colour/before-market.png](D:/voxel-arena/src/maps/reports/colour/before-market.png) | new | evidence / verification data |
| [src/maps/reports/colour/before-spawn-a.png](D:/voxel-arena/src/maps/reports/colour/before-spawn-a.png) | new | evidence / verification data |
| [src/maps/reports/colour/before-spawn-b.png](D:/voxel-arena/src/maps/reports/colour/before-spawn-b.png) | new | evidence / verification data |
| [src/maps/reports/colour/before-stats.json](D:/voxel-arena/src/maps/reports/colour/before-stats.json) | new | evidence / verification data |
| [src/maps/reports/colour/before-views.json](D:/voxel-arena/src/maps/reports/colour/before-views.json) | new | evidence / verification data |
| [src/maps/reports/colour/contrast.csv](D:/voxel-arena/src/maps/reports/colour/contrast.csv) | new | evidence / verification data |
| [src/maps/reports/colour/design.json](D:/voxel-arena/src/maps/reports/colour/design.json) | new | evidence / verification data |
| [src/maps/reports/colour/geometry-guard.json](D:/voxel-arena/src/maps/reports/colour/geometry-guard.json) | new | evidence / verification data |
| [src/maps/reports/colour/manifest.json](D:/voxel-arena/src/maps/reports/colour/manifest.json) | new | evidence / verification data |
| [src/maps/reports/colour/maps-typecheck.log](D:/voxel-arena/src/maps/reports/colour/maps-typecheck.log) | new | evidence / verification data |
| [src/maps/reports/colour/summary.json](D:/voxel-arena/src/maps/reports/colour/summary.json) | new | evidence / verification data |
| [src/maps/reports/colour/toy-town-contrast.json](D:/voxel-arena/src/maps/reports/colour/toy-town-contrast.json) | new | evidence / verification data |
| [src/maps/reports/colour/toy-town-l1-r1-contrast.json](D:/voxel-arena/src/maps/reports/colour/toy-town-l1-r1-contrast.json) | new | evidence / verification data |
| [src/maps/reports/colour/toy-town-l1-r2-contrast.json](D:/voxel-arena/src/maps/reports/colour/toy-town-l1-r2-contrast.json) | new | evidence / verification data |
| [src/maps/reports/colour/toy-town-l2-r1-contrast.json](D:/voxel-arena/src/maps/reports/colour/toy-town-l2-r1-contrast.json) | new | evidence / verification data |
| [src/maps/reports/colour/toy-town-l2-r2-contrast.json](D:/voxel-arena/src/maps/reports/colour/toy-town-l2-r2-contrast.json) | new | evidence / verification data |
| [src/maps/reports/colour/typecheck.log](D:/voxel-arena/src/maps/reports/colour/typecheck.log) | new | evidence / verification data |
| [src/maps/reports/colour/verify.log](D:/voxel-arena/src/maps/reports/colour/verify.log) | new | evidence / verification data |
| [src/maps/reports/m2/after.json](D:/voxel-arena/src/maps/reports/m2/after.json) | new | evidence / verification data |
| [src/maps/reports/m2/color-geometry-guard.json](D:/voxel-arena/src/maps/reports/m2/color-geometry-guard.json) | new | evidence / verification data |
| [src/maps/reports/m2/contrast.json](D:/voxel-arena/src/maps/reports/m2/contrast.json) | new | evidence / verification data |
| [src/maps/reports/m2/preview.json](D:/voxel-arena/src/maps/reports/m2/preview.json) | changed | evidence / verification data |
| [src/maps/reports/m3/preview.json](D:/voxel-arena/src/maps/reports/m3/preview.json) | changed | evidence / verification data |
| [src/maps/reports/m3/source-guard.json](D:/voxel-arena/src/maps/reports/m3/source-guard.json) | new | evidence / verification data |
| [src/maps/reports/m3/summary.json](D:/voxel-arena/src/maps/reports/m3/summary.json) | new | evidence / verification data |
| [src/maps/reports/m3/toy-town-l1-r1-contrast.json](D:/voxel-arena/src/maps/reports/m3/toy-town-l1-r1-contrast.json) | new | evidence / verification data |
| [src/maps/reports/m3/toy-town-l1-r1.json](D:/voxel-arena/src/maps/reports/m3/toy-town-l1-r1.json) | new | evidence / verification data |
| [src/maps/reports/m3/toy-town-l1-r2-contrast.json](D:/voxel-arena/src/maps/reports/m3/toy-town-l1-r2-contrast.json) | new | evidence / verification data |
| [src/maps/reports/m3/toy-town-l1-r2.json](D:/voxel-arena/src/maps/reports/m3/toy-town-l1-r2.json) | new | evidence / verification data |
| [src/maps/reports/m3/toy-town-l2-r1-contrast.json](D:/voxel-arena/src/maps/reports/m3/toy-town-l2-r1-contrast.json) | new | evidence / verification data |
| [src/maps/reports/m3/toy-town-l2-r1.json](D:/voxel-arena/src/maps/reports/m3/toy-town-l2-r1.json) | new | evidence / verification data |
| [src/maps/reports/m3/toy-town-l2-r2-contrast.json](D:/voxel-arena/src/maps/reports/m3/toy-town-l2-r2-contrast.json) | new | evidence / verification data |
| [src/maps/reports/m3/toy-town-l2-r2.json](D:/voxel-arena/src/maps/reports/m3/toy-town-l2-r2.json) | new | evidence / verification data |
| [src/maps/reports/toy-town.json](D:/voxel-arena/src/maps/reports/toy-town.json) | changed | evidence / verification data |
| [src/maps/tools/colour-bugs.mjs](D:/voxel-arena/src/maps/tools/colour-bugs.mjs) | new | preview / verification / documentation |
| [src/maps/tools/colour-preview-server.mjs](D:/voxel-arena/src/maps/tools/colour-preview-server.mjs) | new | preview / verification / documentation |
| [src/maps/tools/refresh-colour.mjs](D:/voxel-arena/src/maps/tools/refresh-colour.mjs) | new | preview / verification / documentation |
| [src/maps/tools/report-colour.mjs](D:/voxel-arena/src/maps/tools/report-colour.mjs) | new | preview / verification / documentation |
| [src/maps/tools/source-guard-colour.mjs](D:/voxel-arena/src/maps/tools/source-guard-colour.mjs) | new | preview / verification / documentation |
| [src/maps/types.ts](D:/voxel-arena/src/maps/types.ts) | changed | runtime |
| [src/maps/verify-colour.mjs](D:/voxel-arena/src/maps/verify-colour.mjs) | new | preview / verification / documentation |
| [src/maps/verify-m3.mjs](D:/voxel-arena/src/maps/verify-m3.mjs) | changed | preview / verification / documentation |
| [src/maps/verify.mjs](D:/voxel-arena/src/maps/verify.mjs) | changed | preview / verification / documentation |

Exact sizes and SHA-256: [manifest.json](manifest.json). Immutable original data: baselines/colour-before.json.gz; protected-source signatures: baselines/colour-source-guard.json.
