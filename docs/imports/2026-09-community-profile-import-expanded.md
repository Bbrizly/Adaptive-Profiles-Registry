# Public community profile import — expanded catalog batch (2026-09-18)

## Research coverage

The import covered the public QuadStick Google Group profile index and discussions, public Google Sheets, the official QuadStick downloads/documentation pages, GitHub profile collections, and game-specific searches. The official downloads page links a public configuration catalog containing 314 Sheet rows; 290 produced readable CSV exports. No private group, account, email address, hidden Sheet metadata, or access-control bypass was used. Remote content was treated as untrusted data and never executed.

Search saturation is **NO** in the absolute sense: historical references remain whose current Sheet URLs are dead, restricted, or no longer expose a configuration. It is reasonably saturated for this batch because repeated searches converged on the same public catalog, already-seen Sheets, generic factory configurations, dead links, and discussions without an exposed snapshot.

## Candidate results

The historical discussion ledger contains 15 candidates. The official catalog ledger is [`research/catalog/import-results.json`](../../research/catalog/import-results.json), generated from [`research/catalog/official-quadstick-catalog.tsv`](../../research/catalog/official-quadstick-catalog.tsv).

| Classification | Count |
| --- | ---: |
| ACCEPTED_MAPPED | 0 |
| ACCEPTED_UNMAPPED | 202 final profiles |
| DUPLICATE catalog rows | 147 |
| DEAD_LINK | 3 |
| REJECTED_PRIVATE | 2 |
| REJECTED_NOT_PROFILE | 101 |
| REJECTED_INVALID | 0 |
| REJECTED_UNCLEAR_PROVENANCE | 0 |
| NEEDS_MANUAL_REVIEW | 1 |

The 198 accepted profiles are real public CSV snapshots, deduplicated by SHA-256 and represented by exact immutable `profile.csv` files. Twenty catalog rows were removed after review because they were device/controller/TV/test configurations rather than game profiles. All remaining profiles are intentionally `unmapped`; no semantic action was inferred from ambiguous raw labels. Only the existing `quadstick-fps` and `quadstick-original` device records are used. Canonical target normalization also collapses contributor-prefixed and export-suffixed labels into the actual game name.

## Imported registry contents

| Measure | Count |
| --- | ---: |
| Game profiles | 198 |
| Game targets | 175 |
| Devices | 2 |
| Semantic mapped profiles | 0 |
| Semantic unmapped profiles | 198 |

## Game metadata and artwork

The target catalog has 175 canonical game entries. 90 have exact-title Steam store metadata and artwork, 78 have Wikidata metadata, and the remaining 85 have deterministic locally generated SVG artwork so the website never presents a broken image. Steam artwork and metadata remain third-party material; generated artwork is original Adaptive Profiles output. Metadata is descriptive enrichment only and does not create semantic control mappings.

The profile-by-profile table is generated in [`generated/index.v2.json`](../../generated/index.v2.json). Each profile metadata record contains source URL, target, platform, device, semantic status, and SHA-256 snapshot hash. The reproducible importer is [`tools/import-official-catalog.mjs`](../../tools/import-official-catalog.mjs).

## Validation

- `npm run build:index` — PASS; built 175 games, 2 devices, 198 legacy profiles.
- `node tools/validate.mjs --check-index --check-v2` — PASS.
- `node tests/registry.test.mjs` — PASS.
- Snapshot hashes — PASS; every imported profile has an exact local CSV and SHA-256.
- V1 projection — PASS; `generated/index.json` and `data/profiles/**` were rebuilt.

## Known gaps

Generic factory/device/test configurations were intentionally excluded. Some historical profiles remain unavailable because their source is dead, restricted, or only described in prose. The importer permits targets with `actions: []` so legitimate public profiles can be represented honestly as unmapped without inventing semantic actions; this is a deliberate schema accommodation, not a mapping shortcut.

## Security and privacy

Private sources imported: **NO**. Secrets committed: **NO**. Email addresses or hidden metadata imported: **NO**. Fabricated contributors: **NO**. Semantic mappings guessed: **NO**. Original public sources were not modified.
