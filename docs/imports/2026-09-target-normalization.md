# Canonical game target normalization — 2026-09-18

## What changed

Public catalog labels sometimes put the contributor or collection name before the game, for example `Silas P. (PC)/CoD Black Ops 6 - MP/Zombies`. Those labels are useful provenance, but they are not game names. The registry now strips known contributor prefixes, normalizes well-established game aliases, and groups profiles under canonical game targets.

This applies across the contributor naming patterns, not only one person: `Dan NH/`, `Silas P. (PC)/`, `Heiko/`, `Steamy Biscuit/`, `Matt Victor `, and `RockyNoHands ` are treated as source attribution and never become part of a canonical game name. Export labels such as `Copy of`, `- Steam`, `x360`, `QMP4`, and keyboard/mouse suffixes are also normalized where the underlying game is unambiguous.

Examples:

- `Silas P. (PC)/CoD Black Ops 6 - MP/Zombies`, `...Single Player`, and `...WZ 2.0` → `Call of Duty: Black Ops 6`.
- `Silas P. (PC)/Apex` and `.../Apex x360` → `Apex Legends`.
- `Silas P. (PC)/Star Wars - Jedi Fallen Order` → `Star Wars Jedi: Fallen Order`.
- `Silas P. (PC)/Minecraft` → the existing `Minecraft` target.
- `Dan NH/Batman Arkham Knight v` → `Batman Arkham Knight`.
- `Matt Victor COD Black Ops 3` → `Call of Duty: Black Ops III`.
- `Matt Victor CODMW` → `Call of Duty: Modern Warfare`.
- `RockyNoHands Fortnite` and `RockyNoHands PUBG` → `Fortnite` and `PUBG`.
- `Ori and the Blind Forest - Steam` and `LOL` → `Ori and the Blind Forest` and `League of Legends`.

Profile IDs and CSV snapshots were preserved. Profile metadata still retains the original public Sheet URL and source-facing title where it is useful. Target paths and profile target references were rebuilt, then both V1 and V2 indexes were regenerated.

## Metadata enrichment

The reproducible [`tools/enrich-game-metadata-batch.mjs`](../../tools/enrich-game-metadata-batch.mjs) tool queries the public Wikidata Query Service in one batched request. It writes only exact English-label matches and records the Wikidata entity URL, CC0 attribution, description, first release date, genres, platforms, and fetch date in target `metadata`. The result ledger is [`research/game-metadata-wikidata.json`](../../research/game-metadata-wikidata.json).

This first conservative pass matched 79 of 180 canonical targets. Unresolved titles remain untouched for manual review; no fuzzy metadata was attached to the wrong game.

## Validation

- 202 profiles retained.
- 180 canonical game targets.
- 2 devices retained; no new device inferred.
- `npm run build:index` — PASS.
- `node tools/validate.mjs --check-index --check-v2` — PASS.
- `node tests/registry.test.mjs` — PASS.
