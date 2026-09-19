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
const targetDir = path.join(ROOT, 'targets', 'games');
const targets = fs.readdirSync(targetDir).map(id => path.join(targetDir, id, 'target.json')).filter(fs.existsSync).map(file => ({ file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }));
for (const { file, data: target } of targets) {
  const relative = path.posix.join('artwork', 'games', `${target.id}.svg`);
  const full = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, artworkSvg(target));
}
console.log(`Safe artwork fallback assets: ${targets.length} deterministic SVGs regenerated; canonical target artwork was not changed.`);
