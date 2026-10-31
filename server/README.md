# server/ — SpacetimeDB module (TypeScript)

Owned by the game agent. Imports shared code from `../src` (config, gameplay, maps data).
Dependencies come from the root `package.json` (`spacetimedb`, `typescript`).

```sh
spacetime start                                   # local server on 127.0.0.1:3000
npm run server:publish                            # build + publish as "voxel-arena" (local)
npm run server:bindings                           # regenerate src/network/bindings after schema changes
spacetime logs --server local voxel-arena -f      # module logs
```
