import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry, validateRegistry } from './registry.mjs';

const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'community-import-candidates.json'), 'utf8'));
const accepted = ledger.filter(item => item.status === 'ACCEPTED_MAPPED' || item.status === 'ACCEPTED_UNMAPPED');
const registry = loadRegistry();
const errors = validateRegistry(registry);
for (const item of accepted) {
  const profile = registry.profiles.find(({ data }) => data.snapshot.sha256 === item.snapshotSha256);
  if (!profile) errors.push(`accepted candidate missing registry profile: ${item.title}`);
  if (!/^https:\/\/docs\.google\.com\/(?:spreadsheets|spreadsheet)\//.test(item.sourceUrl)) errors.push(`unexpected Sheet host: ${item.sourceUrl}`);
  if (profile) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(path.dirname(profile.file), 'profile.csv'))).digest('hex');
    if (actual !== item.snapshotSha256) errors.push(`ledger hash mismatch: ${item.title}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Community import verified: ${accepted.length} accepted candidate(s), ${ledger.length} ledger item(s).`);
