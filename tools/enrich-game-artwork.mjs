import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry } from './registry.mjs';

const aliasMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/game-artwork-aliases.json'), 'utf8'));
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_PIXELS = 16_000_000;
const MAX_DECODE_BYTES = 64 * 1024 * 1024;
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 12_000;
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpeg'], ['image/png', 'png'], ['image/gif', 'gif'], ['image/webp', 'webp']
]);
const STEAM_API_HOSTS = new Set(['store.steampowered.com']);
const DISCOVERY_HOSTS = new Set(['store.steampowered.com', 'commons.wikimedia.org']);
const DELIVERY_HOSTS = new Set(['shared.akamai.steamstatic.com', 'upload.wikimedia.org']);
const COMMONS_LICENSES = new Set(['public domain', 'cc0', 'cc by', 'cc by sa']);
const headers = { 'User-Agent': 'Adaptive-Profiles-Registry/1.0 (artwork research; contact repository maintainer)' };

const normalize = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const sorted = value => [...value].sort((a, b) => a.targetId.localeCompare(b.targetId) || a.provider.localeCompare(b.provider) || a.status.localeCompare(b.status));
const result = (targetId, provider, status, matchMethod, confidence, reason, extra = {}) => ({ discoveryUrl: null, sourceUrl: null, targetId, provider, matchMethod, confidence, reason, imageUrl: null, imageWidth: null, imageHeight: null, contentSha256: null, author: null, license: null, licenseUrl: null, attribution: null, status, ...extra });

function allowedUrl(value, hosts) {
  let url;
  try { url = new URL(value); } catch { throw new Error('invalid URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.has(url.hostname)) throw new Error(`URL host/protocol not allowed: ${url.hostname}`);
  return url;
}

function validateDeliveryPath(url) {
  const location = allowedUrl(url, DELIVERY_HOSTS);
  if (location.hostname === 'shared.akamai.steamstatic.com' && !/^\/store_item_assets\/steam\/apps\/\d+\/(?:[a-f0-9]{40}\/)?(?:header|capsule_616x353|library_hero)\.(?:jpg|jpeg|png|webp)$/.test(location.pathname)) throw new Error('Steam image path not allowed');
  if (location.hostname === 'upload.wikimedia.org' && !/^\/wikipedia\/commons\//.test(location.pathname)) throw new Error('Wikimedia image path not allowed');
  return location;
}

async function request(url, fetchImpl, hosts, redirects = 0, validate = () => {}) {
  const current = allowedUrl(url, hosts);
  validate(current.toString());
  const response = await fetchImpl(current.toString(), { headers, redirect: 'manual' });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= MAX_REDIRECTS) throw new Error('redirect limit exceeded');
    const location = response.headers?.get?.('location');
    if (!location) throw new Error('redirect without location');
    return request(new URL(location, current).toString(), fetchImpl, hosts, redirects + 1, validate);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { response, url: current.toString() };
}

async function readBounded(response) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error('response byte limit exceeded');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error('response byte limit exceeded');
  return bytes;
}

function u16(bytes, offset) { return (bytes[offset] << 8) | bytes[offset + 1]; }
function u32(bytes, offset) { return (bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]; }
function dimensions(bytes, format) {
  if (format === 'png' && bytes.length >= 24 && u32(bytes, 0) === 0x89504e47 && u32(bytes, 4) === 0x0d0a1a0a && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR') return [u32(bytes, 16), u32(bytes, 20)];
  if (format === 'gif' && bytes.length >= 10 && String.fromCharCode(...bytes.slice(0, 3)) === 'GIF') return [u16(bytes, 6), u16(bytes, 8)];
  if (format === 'webp' && bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === 'VP8X' && bytes.length >= 30) return [1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)];
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) return [1 + bytes[21] + ((bytes[22] & 0x3f) << 8), 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0xf) << 10))];
  }
  if (format === 'jpeg' && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1]; offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = u16(bytes, offset);
      if (marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf) return [u16(bytes, offset + 5), u16(bytes, offset + 3)];
      if (length < 2) break;
      offset += length;
    }
  }
  return null;
}

function signature(bytes, format) {
  if (format === 'png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (format === 'jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (format === 'gif') return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.slice(0, 6)));
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

export async function fetchValidatedImage(imageUrl, fetchImpl = globalThis.fetch) {
  const { response, url } = await request(imageUrl, fetchImpl, DELIVERY_HOSTS, 0, validateDeliveryPath);
  const type = (response.headers?.get?.('content-type') || '').split(';', 1)[0].toLowerCase();
  const format = IMAGE_TYPES.get(type);
  if (!format) throw new Error('unsupported or invalid content type');
  const bytes = await readBounded(response);
  if (!signature(bytes, format)) throw new Error('malformed image signature');
  const size = dimensions(bytes, format);
  if (!size) throw new Error('image dimensions unavailable');
  const [width, height] = size;
  if (![width, height].every(Number.isInteger) || width < MIN_DIMENSION || height < MIN_DIMENSION || width > MAX_DIMENSION || height > MAX_DIMENSION) throw new Error('image dimensions invalid');
  if (width * height > MAX_PIXELS) throw new Error('pixel budget exceeded');
  if (width * height * 4 > MAX_DECODE_BYTES) throw new Error('decode allocation budget exceeded');
  return { url, format, width, height, bytes, contentSha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

export function titleMatch(target, providerTitle) {
  const names = [target.name, ...(target.aliases || []), target.metadata?.steam?.name].filter(Boolean).map(normalize);
  const candidate = normalize(providerTitle);
  if (!candidate || !names.length) return { matched: false, method: 'none', confidence: 0 };
  if (names.includes(candidate)) return { matched: true, method: 'exact-title', confidence: 1 };
  const candidateWords = candidate.split(' ');
  const close = names.filter(name => {
    const words = name.split(' ');
    return words.length >= 2 && (candidate.startsWith(`${name} `) || name.startsWith(`${candidate} `)) && Math.min(words.length, candidateWords.length) >= 2;
  });
  return close.length === 1 ? { matched: true, method: 'conservative-title-alias', confidence: 0.86 } : { matched: false, method: close.length > 1 ? 'conflicting-title' : 'none', confidence: 0 };
}

function steamAppId(target) { return target.metadata?.steam?.appId || aliasMap[target.id] || null; }
function steamImageUrl(data) { return data.header_image || data.headerImage || null; }
async function steamCandidate(target, fetchImpl) {
  const appId = steamAppId(target);
  if (!appId) return result(target.id, 'steam', 'unavailable', 'none', 0, 'no existing Steam app ID or checked-in alias');
  const api = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&l=english`;
  const { response } = await request(api, fetchImpl, STEAM_API_HOSTS);
  const data = (await response.json())[String(appId)]?.data;
  if (!data) return result(target.id, 'steam', 'unavailable', 'steam-app-id', 0, 'Steam app details unavailable');
  const match = titleMatch(target, data.name);
  if (!match.matched) return result(target.id, 'steam', 'ambiguous', match.method, 0, 'Steam metadata title does not conservatively agree');
  const imageUrl = steamImageUrl(data);
  if (!imageUrl) return result(target.id, 'steam', 'unavailable', match.method, match.confidence, 'Steam metadata has no image URL');
  try {
    const image = await fetchValidatedImage(imageUrl, fetchImpl);
    return result(target.id, 'steam', 'accepted', match.method, match.confidence, 'validated Steam artwork', { discoveryUrl: api, sourceUrl: data.steam_appid ? `https://store.steampowered.com/app/${data.steam_appid}/` : api, imageUrl: image.url, imageWidth: image.width, imageHeight: image.height, contentSha256: image.contentSha256 });
  } catch (error) { return result(target.id, 'steam', 'rejected', match.method, match.confidence, error.message, { discoveryUrl: api, imageUrl }); }
}

function extValue(meta, key) { return meta?.[key]?.value || meta?.[key]?.source || ''; }
function commonsLicense(value) {
  const normalized = normalize(value).replace(/\s+international$/, '').replace(/\s+(?:version\s+)?\d+(?:\s+\d+)*\s*$/, '').trim();
  return COMMONS_LICENSES.has(normalized) ? normalized : null;
}
async function commonsCandidates(target, fetchImpl) {
  const query = encodeURIComponent(target.name);
  const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*`;
  const { response } = await request(api, fetchImpl, DISCOVERY_HOSTS);
  const pages = Object.values((await response.json()).query?.pages || {}).sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  const candidates = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0]; const match = titleMatch(target, String(page.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/\s*\([^)]*\)$/, ''));
    if (!match.matched) continue;
    const sourceUrl = info?.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title).replace(/%20/g, '_')}`;
    if (!info) { candidates.push(result(target.id, 'wikimedia', 'rejected', match.method, match.confidence, 'Commons candidate has no image metadata', { discoveryUrl: api, sourceUrl })); continue; }
    const license = commonsLicense(extValue(info.extmetadata, 'LicenseShortName'));
    if (!license) { candidates.push(result(target.id, 'wikimedia', 'rejected', match.method, match.confidence, 'Commons candidate has a disallowed license', { discoveryUrl: api, sourceUrl, imageUrl: info.url || null })); continue; }
    if (!info.url) { candidates.push(result(target.id, 'wikimedia', 'rejected', match.method, match.confidence, 'Commons candidate has no delivery URL', { discoveryUrl: api, sourceUrl })); continue; }
    try {
      const delivery = allowedUrl(info.url, DELIVERY_HOSTS);
      if (delivery.hostname !== 'upload.wikimedia.org') throw new Error('Wikimedia image host not allowed');
      const image = await fetchValidatedImage(delivery.toString(), fetchImpl);
      const author = extValue(info.extmetadata, 'Artist') || null;
      const licenseUrl = extValue(info.extmetadata, 'LicenseUrl') || null;
      const attribution = author ? `${author} — ${license.toUpperCase()}` : null;
      candidates.push(result(target.id, 'wikimedia', 'accepted', match.method, match.confidence, 'validated Wikimedia Commons artwork', { discoveryUrl: api, sourceUrl, imageUrl: image.url, imageWidth: image.width, imageHeight: image.height, contentSha256: image.contentSha256, author, license: license.toUpperCase(), licenseUrl, attribution }));
    } catch (error) { candidates.push(result(target.id, 'wikimedia', 'rejected', match.method, match.confidence, error.message, { discoveryUrl: api, sourceUrl, imageUrl: info.url })); }
  }
  const accepted = candidates.filter(candidate => candidate.status === 'accepted');
  if (accepted.length > 1) for (const candidate of accepted) { candidate.status = 'ambiguous'; candidate.reason = 'multiple conservatively matching Commons files'; }
  return candidates;
}

export async function collectArtworkCandidates({ registry = loadRegistry(), fetchImpl = globalThis.fetch } = {}) {
  const targets = registry.targets.map(entry => entry.data).filter(target => target.kind === 'game').sort((a, b) => a.id.localeCompare(b.id));
  const records = [];
  for (const target of targets) {
    const steam = await steamCandidate(target, fetchImpl);
    records.push(steam);
    if (steam.status === 'accepted') continue;
    const commons = await commonsCandidates(target, fetchImpl).catch(error => [result(target.id, 'wikimedia', 'rejected', 'none', 0, error.message)]);
    records.push(...(commons.length ? commons : [result(target.id, 'wikimedia', 'unavailable', 'none', 0, 'no conservatively matching licensed Commons artwork')]));
  }
  const seen = new Map();
  for (const record of records) if (record.status === 'accepted' && record.contentSha256) {
    if (seen.has(record.contentSha256)) { record.status = 'duplicate'; record.reason = `duplicate validated content of ${seen.get(record.contentSha256)}`; } else seen.set(record.contentSha256, record.targetId);
  }
  return sorted(records);
}

export async function run({ fetchImpl = globalThis.fetch, output = path.join(ROOT, 'research/game-artwork-candidates.json') } = {}) {
  const records = await collectArtworkCandidates({ fetchImpl });
  fs.writeFileSync(output, `${JSON.stringify({ generatedAt: '2026-09-19', policy: 'ledger-only; no target artwork or indexes modified', records }, null, 2)}\n`);
  return records;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const records = await run();
  console.log(`Artwork research: ${records.filter(record => record.status === 'accepted').length} accepted, ${records.filter(record => record.status !== 'accepted').length} non-accepted record(s).`);
}
