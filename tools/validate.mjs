import fs from 'node:fs';
import path from 'node:path';
import { ROOT, buildIndexes, loadRegistry, stable, validateRegistry } from './registry.mjs';

const registry = loadRegistry(); const errors = validateRegistry(registry); if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (process.argv.includes('--check-index')) { const expected = buildIndexes(registry); for (const [file, value] of [['generated/index.json', expected.v1], ['generated/index.v2.json', expected.v2]]) { const actual = fs.readFileSync(path.join(ROOT, file), 'utf8'); if (actual !== stable(value)) throw new Error(`${file} is stale`); } }
console.log(`Registry valid: ${registry.targets.length} target(s), ${registry.devices.length} device(s), ${registry.profiles.length} profile(s).`);
