import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './registry.mjs';

const sourceDir = process.argv.find(arg => arg.startsWith('--source-dir='))?.slice('--source-dir='.length) || '/private/tmp/quadstick-catalog-csv';
const catalogFile = path.join(ROOT, 'research', 'catalog', 'official-quadstick-catalog.tsv');
const rows = fs.readFileSync(catalogFile, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
  const [url, ...cells] = line.split('\t');
  // The catalog TSV stores the published row's pipe-delimited cells after the URL.
  // Only the first two cells are the human title and CSV filename; later cells are
  // source metadata and must not make a legitimate game look like a factory config.
  const [title, filename] = cells.join('\t').split(' | ');
  return { url, title: (title || filename || '').trim(), filename: (filename || 'profile.csv').trim() };
});
const skip = /\b(default|mouse|prefs?|blank|demo|test|example|configuration|controller|bluetooth|ultrastik|brook|xac|android|ipad|relay|screensaver|any_direction|multiplex|settings|firmware|beloader|ds4|xbox 360 for pc)\b/i;
const gameLike = row => !skip.test(`${row.title} ${row.filename}`) && !/\b(inputs?|port|remap|converter|stick|wheel|keyboard|gamepad)\b/i.test(row.title);
const slug = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'catalog-profile';
const platformFor = (title, csv) => {
  const value = `${title}\n${csv.slice(0, 2500)}`.toLowerCase();
  if (/ps5|ps4|playstation|ps3/.test(value)) return 'playstation';
  if (/xbox|xbox one|xbox outputs/.test(value)) return 'xbox';
  if (/switch|zelda|mario/.test(value)) return 'switch';
  return 'pc';
};
const targetName = title => {
  const withoutContributor = title.replace(/^(?:Silas P\. \(PC\)|Dan NH|Heiko|Steamy Biscuit)\/(.+)$/i, '$1').trim();
  const withoutPlatform = withoutContributor.replace(/\s+(pc|ps4|ps5|xbox|xbox one|playstation|switch)\b.*$/i, '').trim() || withoutContributor;
  const exact = new Map([
    ['Batman Arkham Knight v', 'Batman Arkham Knight'],
    ['Copy of LOL', 'League of Legends'],
    ['Copy of World of Warcraft', 'World of Warcraft'],
    ['Counterstrikev2', 'Counter-Strike 2'],
    ['LOL', 'League of Legends'],
    ['World of Warship', 'World of Warships']
  ]);
  return exact.get(withoutPlatform) || withoutPlatform;
};
const targetIdFor = name => slug(name);
const existingHashes = new Set();
for (const file of fs.existsSync(path.join(ROOT, 'profiles')) ? fs.readdirSync(path.join(ROOT, 'profiles'), { recursive: true }) : []) {
  if (file.endsWith('profile.csv')) existingHashes.add(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'profiles', file))).digest('hex'));
}
const imported = []; const rejected = [];
for (const row of rows) {
  const id = row.url.match(/\/d\/([^/]+)/)?.[1];
  const source = id && path.join(sourceDir, `${id}.csv`);
  if (!source || !fs.existsSync(source)) { rejected.push({ ...row, status: 'DEAD_LINK', reason: 'No readable CSV export.' }); continue; }
  const csv = fs.readFileSync(source);
  if (!csv.length || csv.includes(0)) { rejected.push({ ...row, status: 'REJECTED_INVALID', reason: 'Empty or binary export.' }); continue; }
  if (!gameLike(row)) { rejected.push({ ...row, status: 'REJECTED_NOT_PROFILE', reason: 'Factory, device, demo, or generic configuration.' }); continue; }
  const hash = crypto.createHash('sha256').update(csv).digest('hex');
  if (existingHashes.has(hash)) { rejected.push({ ...row, status: 'DUPLICATE', snapshotSha256: hash }); continue; }
  const title = row.title.split(' | ')[0].trim(); const targetNameValue = targetName(title); const targetId = targetIdFor(targetNameValue); const platform = platformFor(title, csv); const profileStem = slug(row.filename.replace(/\.csv$/i, '') || title); let profileId = `${targetId}-${platform}-quadstick-fps-${profileStem}`;
  let profileDir = path.join(ROOT, 'profiles', 'games', targetId, 'quadstick-fps', profileId);
  if (fs.existsSync(profileDir)) { const current = path.join(profileDir, 'profile.csv'); const currentHash = fs.existsSync(current) ? crypto.createHash('sha256').update(fs.readFileSync(current)).digest('hex') : ''; if (currentHash !== hash) { profileId = `${profileId}-${hash.slice(0, 8)}`; profileDir = path.join(ROOT, 'profiles', 'games', targetId, 'quadstick-fps', profileId); } }
  fs.mkdirSync(profileDir, { recursive: true }); fs.copyFileSync(source, path.join(profileDir, 'profile.csv'));
  const targetFile = path.join(ROOT, 'targets', 'games', targetId, 'target.json');
  if (!fs.existsSync(targetFile)) { fs.mkdirSync(path.dirname(targetFile), { recursive: true }); fs.writeFileSync(targetFile, `${JSON.stringify({ schemaVersion: 2, id: targetId, kind: 'game', name: targetNameValue, aliases: [], categories: ['gaming'], platforms: [platform], actions: [], source: { url: row.url, title: `QuadStick public configuration catalog — ${targetNameValue}` } }, null, 2)}\n`); } else { const target = JSON.parse(fs.readFileSync(targetFile, 'utf8')); let changed = target.source?.title !== `QuadStick public configuration catalog — ${targetNameValue}`; target.name = targetNameValue; target.source = { ...target.source, title: `QuadStick public configuration catalog — ${targetNameValue}` }; if (!target.platforms.includes(platform)) { target.platforms.push(platform); target.platforms.sort(); changed = true; } if (changed) fs.writeFileSync(targetFile, `${JSON.stringify(target, null, 2)}\n`); }
  const metadata = { schemaVersion: 2, id: profileId, title: title === row.filename ? title : `${targetNameValue} — ${row.filename.replace(/\.csv$/i, '')}`, description: `Publicly listed in the official QuadStick configuration catalog. The exact CSV snapshot is preserved; semantic actions remain unmapped pending target-specific review.`, target: { kind: 'game', id: targetId }, platform, deviceId: 'quadstick-fps', semanticStatus: 'unmapped', mappings: [], tags: ['community', 'quadstick-catalog', 'unmapped'], contributor: { displayName: 'Unknown contributor' }, source: { type: 'google-sheet', url: row.url }, snapshot: { file: 'profile.csv', sha256: hash }, revision: 1, createdAt: '2026-09-18', updatedAt: '2026-09-18' };
  fs.writeFileSync(path.join(profileDir, 'profile.json'), `${JSON.stringify(metadata, null, 2)}\n`); existingHashes.add(hash); imported.push({ ...row, status: 'ACCEPTED_UNMAPPED', profileId, target: targetId, platform, device: 'quadstick-fps', snapshotSha256: hash });
}
fs.writeFileSync(path.join(ROOT, 'research', 'catalog', 'import-results.json'), `${JSON.stringify({ imported, rejected }, null, 2)}\n`);
console.log(`Official catalog import: ${imported.length} accepted, ${rejected.length} ledgered, ${new Set(imported.map(item => item.target)).size} target(s).`);
