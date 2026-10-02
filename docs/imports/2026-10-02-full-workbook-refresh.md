# Full workbook refresh, 2026-10-02

## What was wrong

The September imports used Google's CSV export, which returns only the first
tab of a workbook. A QuadStick profile keeps one mode per tab, so 195 of 198
profiles held mode 1 only. Far Cry 6 had 1 of 4 modes, Minecraft 1 of 9.

The importer also guessed platform from words inside the CSV. "XBox Outputs"
is a mode label and "switch" is a jack name, so 115 profiles titled
"Silas P. (PC)" were filed as Xbox, League of Legends as Switch, and Breath
of the Wild as Xbox. Catalog authors were replaced with "Unknown contributor".

## What changed

- Every workbook was downloaded as xlsx and converted with QCM's own
  `Xlsx.Import`, the converter the desktop app uses. The bytes are stored
  as it produces them, never edited.
- Checked with QCM's parser: 198 modes became 995, 13,381 bindings became
  46,382. Every new file's first mode matches the old snapshot exactly. No
  profile lost a mode. The 7 profiles with parser errors are the same 7 as
  before (authors' own file names and row lengths).
- Platform now comes from the catalog title, or from the game when it only
  shipped on one platform. Otherwise it is `unspecified`, not a guess.
- Author comes from the catalog title prefix (Silas P., Dan NH, Heiko,
  Steamy Biscuit, Matt Victor, RockyNoHands).
- Profile and target ids are unchanged, so QCM deep links still resolve.
- 4 new catalog profiles: Peak, Cyberpunk 2077 (controller), Fortnite
  (RockyNoHands, PC), Portal 2 (Xbox). Flight Simulator 2020 and Dan NH's
  World of Warcraft were byte-identical to profiles already here.

## Left out on purpose

- UltraStik game profiles (Call of Duty, Destiny, Forza 5, Journey,
  Portal 2, Rocket League): built for a different joystick, so filing them
  under QuadStick FPS would claim hardware they do not match.
- Beloader Fortnite: fails QCM's parser.
- Factory defaults, device configs, testers and templates.
- `portal2-for` is a target named "Portal2 for" from a title the old
  importer cut short. Its id is in QCM links, so it was not renamed here.
