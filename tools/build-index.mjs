import fs from 'node:fs';
import path from 'node:path';
import { ROOT, buildIndexes, loadRegistry, stable, validateRegistry } from './registry.mjs';

const registry = loadRegistry(); const errors = validateRegistry(registry); if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const { v1, v2 } = buildIndexes(registry); fs.mkdirSync(path.join(ROOT, 'generated'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'generated', 'index.json'), stable(v1)); fs.writeFileSync(path.join(ROOT, 'generated', 'index.v2.json'), stable(v2));
const legacyProfiles = path.join(ROOT, 'data', 'profiles'); fs.rmSync(legacyProfiles, { recursive: true, force: true }); fs.mkdirSync(legacyProfiles, { recursive: true }); fs.writeFileSync(path.join(legacyProfiles, '.gitkeep'), '');
for (const { file, data } of registry.profiles) if (data.target?.kind === 'game') { const source = path.join(path.dirname(file), 'profile.csv'); const target = path.join(legacyProfiles, data.target.id, data.deviceId, data.id, 'profile.csv'); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target); }
console.log(`Built ${v1.games.length} game(s), ${v1.devices.length} device(s), ${v1.profiles.length} legacy profile(s).`);
