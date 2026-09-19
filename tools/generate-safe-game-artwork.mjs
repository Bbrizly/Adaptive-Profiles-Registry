import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './registry.mjs';

const RAW_ROOT = 'https://raw.githubusercontent.com/Bbrizly/Adaptive-Profiles-Registry/main';
const STEAM_ART_HOST = 'shared.akamai.steamstatic.com';
const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const artworkSvg = target => {
  let hash = 0;
  for (const char of target.id) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  const title = xml(target.name);
  const subtitle = xml((target.metadata?.genres || target.categories || ['GAME']).slice(0, 2).join(' · ').toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 38% 16%)"/><stop offset="1" stop-color="hsl(${(hue + 55) % 360} 42% 30%)"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><circle cx="1020" cy="100" r="220" fill="hsl(${(hue + 90) % 360} 70% 62% / .16)"/><path d="M0 560 Q340 450 690 590 T1200 510 V675 H0Z" fill="#0f120f" opacity=".72"/><text x="70" y="470" fill="#f2f4e8" font-family="Arial, sans-serif" font-size="64" font-weight="700">${title}</text><text x="74" y="535" fill="#d4ed67" font-family="Arial, sans-serif" font-size="22" letter-spacing="4">${subtitle}</text><text x="74" y="605" fill="#f59b55" font-family="Arial, sans-serif" font-size="18" letter-spacing="3">ADAPTIVE PROFILES</text></svg>`;
};
const isTrustedSteamArtwork = target => {
  if (target.artwork?.kind !== 'steam' || !target.artwork.url) return false;
  const url = new URL(target.artwork.url);
  return url.protocol === 'https:' && url.hostname === STEAM_ART_HOST && /^\/store_item_assets\/steam\/apps\/\d+\/header\.jpg$/.test(url.pathname);
};

const targetDir = path.join(ROOT, 'targets', 'games');
const targets = fs.readdirSync(targetDir).map(id => path.join(targetDir, id, 'target.json')).filter(fs.existsSync).map(file => ({ file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }));
let steam = 0;
let generated = 0;
for (const { file, data: target } of targets) {
  const relative = path.posix.join('artwork', 'games', `${target.id}.svg`);
  const full = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, artworkSvg(target));
  const fallbackPath = relative;
  if (isTrustedSteamArtwork(target)) {
    target.artwork = { ...target.artwork, fallbackPath, attribution: 'Steam store artwork', license: 'third-party' };
    steam += 1;
  } else {
    target.artwork = { kind: 'generated', path: relative, url: `${RAW_ROOT}/${relative}`, attribution: 'Adaptive Profiles', license: 'Adaptive Profiles terms' };
    generated += 1;
  }
  fs.writeFileSync(file, `${JSON.stringify(target, null, 2)}\n`);
}
fs.writeFileSync(path.join(ROOT, 'research', 'game-artwork-manifest.json'), `${JSON.stringify({ generatedAt: '2026-09-18', targetCount: targets.length, steamArtwork: steam, generatedFallbacks: generated, policy: 'Every target has a local deterministic SVG fallback. External artwork is retained only for exact HTTPS Steam asset URLs on shared.akamai.steamstatic.com.' }, null, 2)}\n`);
console.log(`Safe artwork: ${targets.length} targets, ${steam} trusted Steam images, ${generated} local fallbacks.`);
