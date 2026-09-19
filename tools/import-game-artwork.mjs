import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry } from './registry.mjs';

const candidatesFile = path.join(ROOT, 'research/game-artwork-candidates.json');
const candidateLedger = JSON.parse(fs.readFileSync(candidatesFile, 'utf8'));
const candidates = candidateLedger.records;
for (const record of candidates.filter(item => item.status === 'accepted')) {
  record.nativeWidth ??= record.imageWidth;
  record.nativeHeight ??= record.imageHeight;
  if (record.provider === 'steam') {
    record.attribution ??= 'Steam store artwork';
    record.license ??= 'third-party';
  }
}
fs.writeFileSync(candidatesFile, `${JSON.stringify(candidateLedger, null, 2)}\n`);
const byTarget = new Map();
for (const record of candidates) {
  if (!byTarget.has(record.targetId)) byTarget.set(record.targetId, []);
  byTarget.get(record.targetId).push(record);
}
const targetFiles = new Map(loadRegistry().targets.filter(({ data }) => data.kind === 'game').map(entry => [entry.data.id, entry.file]));
const accepted = candidates.filter(record => record.status === 'accepted');
const acceptedByTarget = new Map(accepted.map(record => [record.targetId, record]));
const counts = { targets: targetFiles.size, acceptedSteam: 0, acceptedWikimedia: 0, unavailable: 0, needsReview: 0, duplicate: candidates.filter(record => record.status === 'duplicate').length };
const targetManifest = [];

for (const [targetId, file] of [...targetFiles].sort(([a], [b]) => a.localeCompare(b))) {
  const target = JSON.parse(fs.readFileSync(file, 'utf8'));
  const record = acceptedByTarget.get(targetId);
  delete target.artwork;
  delete target.artworkStatus;
  delete target.artworkFallbackPath;
  if (record) {
    target.artwork = {
      kind: record.provider === 'steam' ? 'steam' : 'wikimedia',
      url: record.imageUrl,
      source: record.sourceUrl,
      provider: record.provider,
      matchMethod: record.matchMethod,
      confidence: record.confidence,
      nativeWidth: record.nativeWidth,
      nativeHeight: record.nativeHeight,
      contentSha256: record.contentSha256,
      attribution: record.attribution,
      license: record.license,
      ...(record.licenseUrl ? { licenseUrl: record.licenseUrl } : {}),
      fallbackPath: `artwork/games/${targetId}.svg`
    };
    counts[record.provider === 'steam' ? 'acceptedSteam' : 'acceptedWikimedia'] += 1;
  } else {
    const records = byTarget.get(targetId) || [];
    const steamNoAlias = records.some(item => item.provider === 'steam' && item.reason.includes('no existing Steam app ID or checked-in alias'));
    const commonsUnavailable = records.filter(item => item.provider === 'wikimedia').length > 0 && records.filter(item => item.provider === 'wikimedia').every(item => item.status === 'unavailable' && item.reason.includes('no conservatively matching licensed Commons artwork'));
    const status = steamNoAlias && commonsUnavailable ? 'unavailable' : 'needs_review';
    target.artworkStatus = status;
    target.artworkFallbackPath = `artwork/games/${targetId}.svg`;
    counts[status === 'unavailable' ? 'unavailable' : 'needsReview'] += 1;
  }
  fs.writeFileSync(file, `${JSON.stringify(target, null, 2)}\n`);
  targetManifest.push({ targetId, status: record ? 'accepted' : target.artworkStatus, candidateRecords: (byTarget.get(targetId) || []).length, ...(record ? { provider: record.provider, source: record.sourceUrl, contentSha256: record.contentSha256 } : {}) });
}

const statusCounts = {};
for (const record of candidates) statusCounts[`${record.provider}:${record.status}`] = (statusCounts[`${record.provider}:${record.status}`] || 0) + 1;
const reasonCounts = {};
for (const record of candidates) reasonCounts[record.reason] = (reasonCounts[record.reason] || 0) + 1;
const manifest = {
  generatedAt: '2026-09-19',
  searchScope: { targetKind: 'game', targetCount: targetFiles.size, aliases: 'research/game-artwork-aliases.json', providers: ['Steam Store appdetails + validated delivery image', 'Wikimedia Commons API + validated delivery image'], commands: ['node tools/enrich-game-artwork.mjs', 'node tools/import-game-artwork.mjs', 'node tools/generate-safe-game-artwork.mjs', 'node tools/build-index.mjs', 'node tools/build-index.mjs', 'node tools/validate.mjs --check-index', 'node tests/registry.test.mjs'] },
  policy: 'Canonical target artwork contains only accepted verified remote candidates. Deterministic local SVGs are Worker fallback assets and are never official artwork.',
  counts,
  providerStatusCounts: statusCounts,
  reasonCounts,
  targets: targetManifest
};
fs.writeFileSync(path.join(ROOT, 'research/game-artwork-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Imported artwork: ${counts.acceptedSteam} Steam, ${counts.acceptedWikimedia} Wikimedia, ${counts.unavailable} unavailable, ${counts.needsReview} needs_review, ${counts.duplicate} duplicate candidate record(s).`);
