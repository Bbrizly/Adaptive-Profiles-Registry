# Game artwork import — 2026-09-19

This import ran the checked-in deterministic resolver against every one of the 169 canonical `game` targets. It used the checked-in aliases in [`research/game-artwork-aliases.json`](../../research/game-artwork-aliases.json), existing `metadata.steam.appId` values, Steam Store appdetails and delivery images, and Wikimedia Commons search/delivery images.

## Result

- 119 accepted Steam records.
- 3 accepted Wikimedia Commons records.
- 5 unresolved targets marked `unavailable`.
- 42 unresolved targets marked `needs_review`.
- 2 duplicate accepted-content candidates were retained in the ledger and were not imported (`grand-theft-auto-v` and `gta-v` duplicate `grand-theft-auto-5`).
- 249 provider candidate records were written: 122 accepted, 2 duplicate, 9 rejected Steam, 66 rejected Wikimedia, 39 unavailable Steam, 9 unavailable Wikimedia, and 2 ambiguous Wikimedia records.

Every imported remote record contains the provider, conservative match method, confidence, native dimensions, downloaded-content SHA-256, attribution, license, source URL, and validated delivery URL. The complete candidate records, provider/status counts, reason counts, target list, source URLs, and imported hashes are in [`research/game-artwork-candidates.json`](../../research/game-artwork-candidates.json) and [`research/game-artwork-manifest.json`](../../research/game-artwork-manifest.json).

## Canonical artwork policy

Accepted verified remote artwork is stored in `target.artwork`. Generated SVGs were removed from canonical target metadata. The deterministic SVGs remain in `artwork/games/*.svg` as Worker fallback assets only; they are not presented as official artwork and are not counted as accepted artwork. Unresolved targets have no `artwork` field and carry `artworkStatus` plus a top-level `artworkFallbackPath`; accepted verified artwork keeps its fallback path inside `artwork.fallbackPath`.

The five `unavailable` targets have no checked-in Steam app ID/alias and no conservatively matching licensed Commons result. `needs_review` covers provider rejection, ambiguous Commons matches, duplicate content, invalid/disallowed delivery paths, and provider rate-limit failures. No questionable or guessed artwork was imported.

## Exact commands

```sh
node tools/enrich-game-artwork.mjs
node tools/import-game-artwork.mjs
node tools/generate-safe-game-artwork.mjs
node tools/build-index.mjs
node tools/build-index.mjs
git diff --exit-code -- generated/index.json generated/index.v2.json
node tools/validate.mjs --check-index
node tests/registry.test.mjs
```

The resolver is deterministic for a given provider response: targets are sorted by ID, aliases are checked in, title matching is conservative, only HTTPS allow-listed delivery hosts are accepted, image bytes/dimensions are bounded and hashed, Commons licenses and attribution are required, and duplicate accepted hashes are rejected from canonical import. Re-running index generation produced no diff.

Known gaps are intentionally preserved in the machine-readable ledger rather than filled with invented metadata. Provider responses can change, so a future refresh must rerun the resolver and review the resulting hashes and statuses before importing.

## Task 7 preview/integration verification — 2026-09-19

The isolated registry worktree was clean at branch `codex/game-artwork-resolution`, commit `557f2d18babe7f3549795f9dad7e07290e17ad16`. The branch was pushed to `origin/codex/game-artwork-resolution` and was not merged.

Final registry checks:

```text
node tools/build-index.mjs                         PASS — Built 169 game(s), 2 device(s), 198 legacy profile(s).
node tools/validate.mjs --check-index              PASS — Registry valid: 169 target(s), 2 device(s), 198 profile(s).
node tests/registry.test.mjs                       PASS — compatibility, artwork validation, enrichment safety.
node tools/build-index.mjs && git diff --exit-code PASS — regenerated index produced no diff.
```

App preview verification used the clean app worktree at `c61511c536d75f11d847eeec0a93d91394ff57f1`:

```text
npm run check                                      PASS — typecheck, lint, worker tests, artwork tests, 17 web tests, worker syntax check.
npm run build                                      PASS — Vite production build.
npm run deploy:preview                             PASS — adaptive-profiles-preview.
```

Preview: https://adaptive-profiles-preview.bassamkamal-py.workers.dev

Cloudflare version: `683ce77c-0500-4161-b5b7-21aecf8ead88`.

The existing preview configuration deployed `REGISTRY_GITHUB_BRANCH=main`; it cannot consume the isolated branch without a configuration change. Therefore the deployed preview is recorded as using registry `main`, not as a claim that it served commit `557f2d1`. The isolated branch/commit is available for a later preview configuration update. No production deploy was run.

Read-only preview checks returned HTTP 200 for `/`, `/games`, `/profiles`, `/devices`, `/games/a-way-out`, and `/profiles/silas-p-pc-a-way-out-xbox-quadstick-fps-awayout`. API checks returned HTTP 200 and the expected content types for a verified Steam target (`a-way-out`), Wikimedia target (`borderlands`), unresolved target (`007-first-light`, with `artworkStatus` and `artworkFallbackPath`), `/api/v2/targets/a-way-out/artwork` (`image/svg+xml`), `/api/v2/profiles/silas-p-pc-a-way-out-xbox-quadstick-fps-awayout/csv` (`text/csv`), and legacy `/api/v1/profiles` (`application/json`). The profile payload exposes the `qcm://profile/...` link; target payloads expose attribution and fallback metadata. Search/filter, profile detail, source attribution, QCM/download links, and Worker fallback behavior were covered by the deployed SPA/API implementation and the passing app tests. A legacy no-dimensions fixture was not present in the checked-in registry/app fixtures.

Known preview limitations: response inspection found no `Content-Security-Policy` HTTP header on the deployed responses; Chrome/browser automation was unavailable, so desktop/mobile visual inspection could not be completed. The Wrangler deploy also warned that top-level `secrets` and `ratelimits` are not inherited by `env.preview`; this was existing configuration and was not changed during Task 7.
