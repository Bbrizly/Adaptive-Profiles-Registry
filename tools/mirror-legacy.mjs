import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './registry.mjs';

const destination = process.argv[2]; if (!destination) throw new Error('Usage: node tools/mirror-legacy.mjs <legacy-repository-checkout>');
const copy = (relative) => { const source = path.join(ROOT, relative); const target = path.join(destination, relative); if (!fs.existsSync(source)) return; fs.mkdirSync(path.dirname(target), { recursive: true }); fs.cpSync(source, target, { recursive: true }); };
copy('generated/index.json'); copy('data/profiles');
console.log(`Mirrored generated/index.json and data/profiles into ${destination}`);
