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
  const merged = { ...base, id: targetId, name: cleanName(base.name), aliases: Array.from(new Set(group.members.flatMap(item => item.aliases || []).filter(Boolean))), platforms: Array.from(new Set(group.members.flatMap(item => item.platforms || []))).sort() };
  fs.mkdirSync(path.dirname(path.join(ROOT, 'targets', 'games', targetId, 'target.json')), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'targets', 'games', targetId, 'target.json'), `${JSON.stringify(merged, null, 2)}\n`);
}

for (const { file, data } of registry.profiles) {
  const destination = targetMap.get(data.target.id);
  if (!destination || destination.id === data.target.id) continue;
  const oldTargetId = data.target.id;
  const oldDir = path.dirname(file);
  const newDir = path.join(ROOT, 'profiles', 'games', destination.id, data.deviceId, data.id);
  fs.mkdirSync(path.dirname(newDir), { recursive: true });
  data.target = { kind: 'game', id: destination.id };
  const rawTitle = data.title.replace(/\s+—\s+.*$/, '').replace(/\s+—\s+profile$/, '');
  const strippedTitle = cleanName(rawTitle);
  data.title = data.title.replace(rawTitle, strippedTitle);
  fs.writeFileSync(path.join(oldDir, 'profile.json'), `${JSON.stringify(data, null, 2)}\n`);
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
