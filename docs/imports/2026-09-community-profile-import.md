# Public community profile import — 2026-09-18

## Research coverage

The sweep covered the public QuadStick Google Group profile index and individual discussions, public Google Sheet links surfaced by those discussions, the official QuadStick downloads/documentation pages, GitHub search/topic results, and the public `avenom/quadstick-profiles` repository. Search phrases included QuadStick profiles, game profiles, configuration spreadsheet, Google Sheets, and game-specific variants for Minecraft, Fortnite, Valheim, Borderlands, Jedi, Hitman, NBA 2K18, and shooters.

The public QuadStick forum describes itself as a place for sharing user-generated profiles. The official QMP documentation confirms that public Sheets are converted to CSV and that the CSV is the installable configuration artifact. No private group, account, email address, or hidden Sheet metadata was accessed.

Search saturation is **NO** in the absolute sense: the forum is large and contains historical references whose current Sheet URLs are unavailable. It is reasonably saturated for this batch because additional searches repeatedly returned the same profile index, already-inspected Sheets, generic factory configurations, dead/restricted links, or discussions without an exposed configuration snapshot. The ledger preserves those gaps for a future pass.

## Results

| Classification | Count |
| --- | ---: |
| ACCEPTED_MAPPED | 0 |
| ACCEPTED_UNMAPPED | 6 |
| DUPLICATE | 0 |
| DEAD_LINK | 3 |
| REJECTED_PRIVATE | 2 |
| REJECTED_NOT_PROFILE | 3 |
| REJECTED_INVALID | 0 |
| REJECTED_UNCLEAR_PROVENANCE | 0 |
| NEEDS_MANUAL_REVIEW | 1 |

Six distinct, valid public CSV exports were frozen. All six are intentionally `unmapped`; no semantic mapping was inferred from raw labels. Device variant was not stated in each forum post, so the import uses the existing `quadstick-fps` registry device as the current standard QMP profile target and records this limitation here rather than fabricating contributor or hardware details. No new device was added.

## Imported profiles

| Profile ID | Target | Platform | Device | Semantic status | Snapshot SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `minecraft-pc-quadstick-fps-2-minecraft` | Minecraft | pc | QuadStick FPS | unmapped | `b9e63c9579e5a199d584e4e26394899488b88f57c0b20e287eeca6a0291092f4` |
| `valheim-pc-quadstick-fps-valheim` | Valheim | pc | QuadStick FPS | unmapped | `276b4c0f191a85cbd0ee92b9cb1c76588723c6fc7cee4c50757665644abe48d4` |
| `valheim-pc-quadstick-fps-dvalheim` | Valheim | pc | QuadStick FPS | unmapped | `ea9995d406b25299c3731cafd8fb400df2f6d0dc8f870646f0c6d82706a36334` |
| `star-wars-jedi-fallen-order-pc-quadstick-fps-fallen-order` | Star Wars Jedi: Fallen Order | pc | QuadStick FPS | unmapped | `9a6907615a7f0d42676ff430576068ab024bffccf886d8f6e8be14d294c482b7` |
| `fortnite-xbox-quadstick-fps-xboxfortnite` | Fortnite | xbox | QuadStick FPS | unmapped | `d212e60b6adec68b6291a45174235f92c57b1076ed78c21ffcbf54b6b5227764` |
| `borderlands-pc-quadstick-fps-bordls` | Borderlands | pc | QuadStick FPS | unmapped | `9f3c3467b45a52672885e8cd879c84b36ec517bd9a09f922639f793929c9bb6d` |

## Targets and devices

Added game targets: Valheim, Star Wars Jedi: Fallen Order, Fortnite, and Borderlands. Minecraft already existed. No devices were added; the registry remains limited to QuadStick FPS and QuadStick Original.

## Provenance and ledger

The complete machine-readable candidate ledger, including rejected, dead, private/unavailable, and manual-review sources, is [`research/community-import-candidates.json`](../../research/community-import-candidates.json). The reproducible integrity check is [`tools/import-community-profiles.mjs`](../../tools/import-community-profiles.mjs).

Primary source families inspected:

- [QuadStick public Google Group profile index](https://groups.google.com/g/quadstick?label=Profiles)
- [QuadStick official downloads](https://www.quadstick.com/downloads)
- [QuadStick QMP game-files documentation](https://quadstick.s3.amazonaws.com/documents/user_manual/um/game_files_tab_print.htm)
- [Public GitHub profile-collection candidate](https://github.com/avenom/quadstick-profiles)
- Individual forum discussions and Sheet URLs are recorded in the ledger.

## Known gaps

Historical Hitman, Call of Duty/Warzone, Red Dead Redemption 2, Alien: Isolation/Resident Evil 7, and other forum-referenced profiles need a second pass to recover the actual public configuration URL or a current public mirror. Restricted Sheets were not accessed. Borderlands' exact release and the imported Sheets' exact QuadStick hardware variant are not explicit; both limitations are visible in the profile metadata/report rather than guessed away.

## Security and privacy

Private sources imported: **NO**. Secrets committed: **NO**. Email addresses or other personal identifiers imported: **NO**. Fabricated contributor identities: **NO**. Semantic mappings guessed: **NO**. External content was treated as data only; no downloaded content was executed.
