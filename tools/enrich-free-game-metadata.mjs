import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './registry.mjs';

const steamSearch = 'https://store.steampowered.com/api/storesearch/';
const steamDetails = 'https://store.steampowered.com/api/appdetails';
const steamReviews = 'https://store.steampowered.com/appreviews';
const fetchedAt = '2026-09-18';
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const headers = { 'User-Agent': 'Adaptive-Profiles-Registry/1.0 (public metadata enrichment)' };
const text = html => String(html || '').replace(/<br\s*\/?>(?=\S)/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
const xml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function artworkSvg(target) {
  let hash = 0; for (const char of target.id) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360; const title = xml(target.name); const subtitle = xml((target.metadata?.genres || target.categories || ['GAME']).slice(0, 2).join(' · ').toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 38% 16%)"/><stop offset="1" stop-color="hsl(${(hue + 55) % 360} 42% 30%)"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="1020" cy="100" r="220" fill="hsl(${(hue + 90) % 360} 70% 62% / .16)"/><path d="M0 560 Q340 450 690 590 T1200 510 V675 H0Z" fill="#0f120f" opacity=".72"/><text x="70" y="470" fill="#f2f4e8" font-family="Arial, sans-serif" font-size="64" font-weight="700">${title}</text><text x="74" y="535" fill="#d4ed67" font-family="Arial, sans-serif" font-size="22" letter-spacing="4">${subtitle}</text><text x="74" y="605" fill="#f59b55" font-family="Arial, sans-serif" font-size="18" letter-spacing="3">ADAPTIVE PROFILES</text></svg>`;
}
async function json(url) { const response = await fetch(url, { headers }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }
async function steamMatch(target) {
  const result = await json(`${steamSearch}?${new URLSearchParams({ term: target.name, l: 'english', cc: 'us' })}`);
  const aliases = [target.name, ...(target.aliases || [])].map(normalize);
  return (result.items || []).find(item => item.type === 'app' && aliases.includes(normalize(item.name))) || null;
}
async function enrichSteam(item) {
  const wrapper = await json(`${steamDetails}?${new URLSearchParams({ appids: String(item.id), l: 'english', cc: 'us' })}`);
  const data = wrapper[String(item.id)]?.data;
  if (!data) return null;
  let reviews = null;
  try { reviews = (await json(`${steamReviews}/${item.id}?json=1&language=all&purchase_type=all`)).query_summary || null; } catch { /* optional */ }
  return { provider: 'steam', appId: item.id, name: data.name, url: `https://store.steampowered.com/app/${item.id}/`, description: text(data.short_description || data.about_the_game), releaseDate: data.release_date?.date || null, genres: (data.genres || []).map(value => value.description), platforms: Object.entries(data.platforms || {}).filter(([, value]) => value).map(([key]) => key), rating: reviews ? { score: reviews.total_reviews ? Math.round((reviews.total_positive / reviews.total_reviews) * 10000) / 100 : null, positive: reviews.total_positive || 0, negative: reviews.total_negative || 0, total: reviews.total_reviews || 0 } : null, metacritic: data.metacritic?.score || null, fetchedAt };
}

const files = fs.readdirSync(path.join(ROOT, 'targets', 'games')).map(id => path.join(ROOT, 'targets', 'games', id, 'target.json'));
let matched = 0; let unresolved = 0;
for (const file of files) {
  const target = JSON.parse(fs.readFileSync(file, 'utf8'));
  try {
    const match = await steamMatch(target);
    if (match) { const metadata = await enrichSteam(match); if (metadata) { target.metadata = { ...(target.metadata || {}), steam: metadata }; target.artwork = { kind: 'steam', url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${match.id}/header.jpg`, source: metadata.url, attribution: 'Steam store artwork', license: 'third-party' }; matched += 1; } }
    else unresolved += 1;
  } catch (error) { console.error(`${target.name}: ${error.message}`); unresolved += 1; }
  if (!target.artwork) { const relative = path.join('artwork', 'games', `${target.id}.svg`); const full = path.join(ROOT, relative); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, artworkSvg(target)); target.artwork = { kind: 'generated', path: relative, url: `https://raw.githubusercontent.com/Bbrizly/Adaptive-Profiles-Registry/main/${relative}`, attribution: 'Adaptive Profiles', license: 'MIT' }; }
  fs.writeFileSync(file, `${JSON.stringify(target, null, 2)}\n`);
  await sleep(250);
}
fs.writeFileSync(path.join(ROOT, 'research', 'game-metadata-steam.json'), `${JSON.stringify({ provider: 'Steam Store public endpoints', fetchedAt, requested: files.length, matched, unresolved, notes: 'Steam artwork remains an external third-party URL; unresolved games receive deterministic generated SVG artwork.' }, null, 2)}\n`);
console.log(`Free enrichment: ${matched} Steam matches, ${unresolved} generated-art fallbacks.`);
