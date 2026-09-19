import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './registry.mjs';

const appDetails = 'https://store.steampowered.com/api/appdetails';
const steamHost = 'shared.akamai.steamstatic.com';
const headers = { 'User-Agent': 'Adaptive-Profiles-Registry/1.0 (artwork URL verification)' };
const files = fs.readdirSync(path.join(ROOT, 'targets', 'games')).map(id => path.join(ROOT, 'targets', 'games', id, 'target.json'));
const results = [];

for (const file of files) {
  const target = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (target.artwork?.kind !== 'steam') continue;
  const appId = target.metadata?.steam?.appId || target.artwork.url?.match(/\/apps\/(\d+)\//)?.[1];
  if (!appId) { results.push({ id: target.id, status: 'missing_app_id' }); continue; }
  try {
    const response = await fetch(`${appDetails}?appids=${appId}&l=english&cc=us`, { headers });
    const wrapper = await response.json();
    const data = wrapper[String(appId)]?.data;
    const image = data?.header_image ? new URL(data.header_image) : null;
    if (!data || !image || image.protocol !== 'https:' || image.hostname !== steamHost || !/^\/store_item_assets\/steam\/apps\/\d+\/(?:[a-f0-9]+\/)?header(?:_alt_assets_\d+)?\.jpg$/i.test(image.pathname)) {
      results.push({ id: target.id, appId, status: 'invalid_header_image' });
      continue;
    }
    target.artwork.url = image.toString();
    if (target.metadata?.steam) target.metadata.steam.headerImage = image.toString();
    fs.writeFileSync(file, `${JSON.stringify(target, null, 2)}\n`);
    results.push({ id: target.id, appId, status: 'verified', url: image.toString() });
  } catch (error) {
    results.push({ id: target.id, appId, status: 'error', reason: error.message });
  }
}

fs.writeFileSync(path.join(ROOT, 'research', 'steam-artwork-url-audit.json'), `${JSON.stringify({ provider: 'Steam Store public appdetails endpoint', auditedAt: '2026-09-19', results }, null, 2)}\n`);
console.log(`Verified ${results.filter(item => item.status === 'verified').length} Steam artwork URLs; ${results.filter(item => item.status !== 'verified').length} require review.`);
