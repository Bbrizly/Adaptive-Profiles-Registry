import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry } from './registry.mjs';

const slug = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'game';
const decode = value => value.replace(/&#39;|&#x27;/gi, "'").replace(/&amp;/gi, '&');
const contributorPrefix = /^(?:Silas P\. \(PC\)|Dan NH|Heiko|Steamy Biscuit)\/(.+)$/i;
const cleanName = raw => {
  let name = decode(raw).trim();
  const prefixed = name.match(contributorPrefix);
  if (prefixed) name = prefixed[1].trim();
  const exact = new Map([
    ['Minecraft', 'Minecraft'],
    ['Star Wars - Jedi Fallen Order', 'Star Wars Jedi: Fallen Order'],
    ['CoD Black Ops 6 - MP/Zombies x360 (QMP4)', 'Call of Duty: Black Ops 6'],
    ['CoD Black Ops 6 - Single Player x360 (QMP4)', 'Call of Duty: Black Ops 6'],
    ['CoD Black Ops 6 - WZ 2.0 x360 (QMP4)', 'Call of Duty: Black Ops 6'],
    ['CoD BOCW x360 MP', 'Call of Duty: Black Ops Cold War'],
    ['CoD Modern Warfare II Story x360 (QMP4)', 'Call of Duty: Modern Warfare II'],
    ['CoD Modern Warfare II - WZ 2.0 x360 (QMP4)', 'Call of Duty: Modern Warfare II'],
    ['CoD Modern Warfare III - WZ 2.0 x360 (QMP4)', 'Call of Duty: Modern Warfare III'],
    ['CoD Modern Warfare 4 - MP x360 (QMP4)', 'Call of Duty: Modern Warfare'],
    ['Apex', 'Apex Legends'],
    ['Apex x360', 'Apex Legends'],
    ['Baldurs Gate 3', "Baldur's Gate 3"],
    ['Witcher III', 'The Witcher 3: Wild Hunt'],
    ['Red Dead Redemption II', 'Red Dead Redemption 2'],
    ['The Finals', 'THE FINALS'],
    ['the Finals', 'THE FINALS'],
    ['theHunter CotW', 'theHunter: Call of the Wild'],
    ['Tiny Tinas Wonderlands', "Tiny Tina's Wonderlands"],
    ['Warhammer 40k - Space Marine 2', 'Warhammer 40,000: Space Marine 2'],
    ['Warhammer 40k - Darktide', 'Warhammer 40,000: Darktide'],
    ['Zelda Breath of the Wild', 'The Legend of Zelda: Breath of the Wild'],
    ['Lego Fortnite', 'LEGO Fortnite'],
    ['skate.', 'Skate'],
    ['007 - First Light x360', '007 First Light'],
    ['ARC Raiders x360', 'ARC Raiders'],
    ['Battlefield 2042 QMP4', 'Battlefield 2042'],
    ['Battlefield 6 x360', 'Battlefield 6'],
    ['BioShock1', 'BioShock'],
    ['Copy of Flight Simulator 20', 'Microsoft Flight Simulator'],
    ['Copy of LOL', 'League of Legends'],
    ['Copy of World of Warcraft', 'World of Warcraft'],
    ['Counterstrikev2', 'Counter-Strike 2'],
    ['Dead Space Rem', 'Dead Space'],
    ['Dead Space Rem x360 (QMP4)', 'Dead Space'],
    ['Deathloop KBM', 'Deathloop'],
    ['Batman Arkham Knight v', 'Batman Arkham Knight'],
    ['GTA V Cheat codes', 'Grand Theft Auto V'],
    ['Gardians of the Galaxy BETA', 'Marvel\'s Guardians of the Galaxy'],
    ['MLB13', 'MLB 13: The Show'],
    ['NBA2k15', 'NBA 2K15'],
    ['Path of Exile II x360', 'Path of Exile 2'],
    ['PS2 Need for Speed Carbon (QMP4)', 'Need for Speed: Carbon'],
    ['Rocket League X360CE', 'Rocket League'],
    ['Splitgate (betatest) x360', 'Splitgate'],
    ['Super Mario Odyssey Nintendo', 'Super Mario Odyssey'],
    ['World of Warship', 'World of Warships'],
    ['XDefiant x360 (QMP4)', 'XDefiant'],
    ['MX vs ATV Supercross Encore - Steam', 'MX vs ATV Supercross Encore'],
    ['MX vs ATV Unleashed - Steam', 'MX vs ATV Unleashed'],
  ]);
  return exact.get(name) || name;
};
const key = value => cleanName(value).toLowerCase().replace(/[^a-z0-9]+/g, '');

const registry = loadRegistry();
const targetRecords = registry.targets.map(({ file, data }) => ({ file, data }));
const targetMap = new Map();
for (const record of targetRecords) {
  const canonical = cleanName(record.data.name);
  const k = key(canonical);
  const exactId = targetRecords.find(candidate => candidate.data.id === slug(canonical) && key(cleanName(candidate.data.name)) === k);
  targetMap.set(record.data.id, { id: exactId?.data.id || slug(canonical), name: canonical });
}

const targetGroups = new Map();
for (const record of targetRecords) {
  const destination = targetMap.get(record.data.id);
  if (!targetGroups.has(destination.id)) targetGroups.set(destination.id, { source: record.data, members: [] });
  targetGroups.get(destination.id).members.push(record.data);
}

for (const [targetId, group] of targetGroups) {
  const base = group.members.find(item => item.id === targetId) || group.members[0];
  const canonicalName = cleanName(base.name);
  const artwork = base.artwork?.kind === 'generated' ? { ...base.artwork, path: `artwork/games/${targetId}.svg`, url: `https://raw.githubusercontent.com/Bbrizly/Adaptive-Profiles-Registry/main/artwork/games/${targetId}.svg` } : base.artwork;
  if (base.artwork?.kind === 'generated' && base.artwork.path !== artwork.path) {
    const oldArtwork = path.join(ROOT, base.artwork.path);
    const newArtwork = path.join(ROOT, artwork.path);
    if (fs.existsSync(oldArtwork) && !fs.existsSync(newArtwork)) { fs.mkdirSync(path.dirname(newArtwork), { recursive: true }); fs.renameSync(oldArtwork, newArtwork); }
  }
  const merged = { ...base, id: targetId, name: canonicalName, aliases: Array.from(new Set(group.members.flatMap(item => item.aliases || []).filter(Boolean))), platforms: Array.from(new Set(group.members.flatMap(item => item.platforms || []))).sort(), source: { ...base.source, title: `QuadStick public configuration catalog — ${canonicalName}` }, ...(artwork ? { artwork } : {}) };
  fs.mkdirSync(path.dirname(path.join(ROOT, 'targets', 'games', targetId, 'target.json')), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'targets', 'games', targetId, 'target.json'), `${JSON.stringify(merged, null, 2)}\n`);
}

for (const { file, data } of registry.profiles) {
  const destination = targetMap.get(data.target.id);
  if (!destination) continue;
  const oldTargetId = data.target.id;
  const oldDir = path.dirname(file);
  data.target = { kind: 'game', id: destination.id };
  const rawTitle = data.title.replace(/\s+—\s+.*$/, '').replace(/\s+—\s+profile$/, '');
  const strippedTitle = cleanName(rawTitle);
  data.title = data.title.replace(rawTitle, strippedTitle);
  fs.writeFileSync(path.join(oldDir, 'profile.json'), `${JSON.stringify(data, null, 2)}\n`);
  if (destination.id === oldTargetId) continue;
  const newDir = path.join(ROOT, 'profiles', 'games', destination.id, data.deviceId, data.id);
  fs.mkdirSync(path.dirname(newDir), { recursive: true });
  if (oldDir !== newDir) {
    if (fs.existsSync(newDir)) throw new Error(`Profile destination already exists: ${newDir}`);
    fs.renameSync(oldDir, newDir);
  }
  const oldLegacy = path.join(ROOT, 'data', 'profiles', oldTargetId, data.deviceId, data.id);
  const newLegacy = path.join(ROOT, 'data', 'profiles', destination.id, data.deviceId, data.id);
  if (fs.existsSync(oldLegacy)) {
    fs.mkdirSync(path.dirname(newLegacy), { recursive: true });
    if (fs.existsSync(newLegacy)) throw new Error(`Legacy destination already exists: ${newLegacy}`);
    fs.renameSync(oldLegacy, newLegacy);
  }
}

for (const record of targetRecords) {
  const destination = targetMap.get(record.data.id);
  if (destination.id !== record.data.id) {
    fs.rmSync(path.dirname(record.file), { recursive: true, force: true });
  }
}

console.log(`Normalized ${targetRecords.length} targets into ${targetGroups.size} canonical game targets.`);
