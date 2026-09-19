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

Accepted verified remote artwork is stored in `target.artwork`. Generated SVGs were removed from canonical target metadata. The deterministic SVGs remain in `artwork/games/*.svg` as Worker fallback assets only; they are not presented as official artwork and are not counted as accepted artwork. Unresolved targets have no `artwork` field and carry only `artworkStatus`.

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
