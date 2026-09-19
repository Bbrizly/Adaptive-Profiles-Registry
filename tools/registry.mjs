import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
const slug = /^[a-z0-9]+(?:-+[a-z0-9]+)*$/;
const inputKinds = new Set(['digital', 'axis-1d', 'axis-2d', 'pointer']);
const behaviors = new Set(['normal', 'tap', 'hold', 'toggle', 'repeat']);
const artworkStatuses = new Set(['unavailable', 'needs_review']);
const artworkHosts = new Set(read(path.join(ROOT, 'research/artwork-provider-hosts.json')).hosts);

function files(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...files(full)); else result.push(full);
  }
  return result.sort();
}
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function requireSlug(value, label) { if (typeof value !== 'string' || !slug.test(value)) throw new Error(`${label} must be a slug`); }
function unique(values, label) { if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`); }
function isLegacySteamArtwork(data, artwork) {
  return artwork.kind === 'steam' && artwork.provider === undefined
    && typeof artwork.source === 'string' && artwork.source.startsWith('https://store.steampowered.com/')
    && artwork.fallbackPath === `artwork/games/${data.id}.svg`;
}
function validateArtwork(data, label) {
  if (data.artworkStatus !== undefined && !artworkStatuses.has(data.artworkStatus)) throw new Error(`${label}.artworkStatus invalid`);
  if (data.artwork && data.artworkStatus !== undefined) throw new Error(`${label}: artwork and artworkStatus are mutually exclusive`);
  if (!data.artwork) return;
  const artwork = data.artwork;
  if (!['steam', 'wikimedia', 'generated'].includes(artwork.kind)) throw new Error(`${label}.artwork.kind invalid`);
  if (!artwork.url || !artwork.attribution || !artwork.license) throw new Error(`${label}: artwork url/attribution/license required`);
  if (artwork.kind === 'generated') return;
  let url;
  try { url = new URL(artwork.url); } catch { throw new Error(`${label}: artwork URL invalid`); }
  if (url.protocol !== 'https:' || url.port || !artworkHosts.has(url.hostname)) throw new Error(`${label}: artwork URL must use HTTPS and an allowed provider host`);
  const hasDimensions = artwork.nativeWidth !== undefined || artwork.nativeHeight !== undefined;
  if (hasDimensions && (!Number.isInteger(artwork.nativeWidth) || artwork.nativeWidth <= 0 || !Number.isInteger(artwork.nativeHeight) || artwork.nativeHeight <= 0)) throw new Error(`${label}: artwork dimensions invalid`);
  if (artwork.contentSha256 !== undefined && !/^[a-f0-9]{64}$/.test(artwork.contentSha256)) throw new Error(`${label}: artwork contentSha256 invalid`);
  if (artwork.provider !== undefined && (typeof artwork.provider !== 'string' || !artwork.provider.trim())) throw new Error(`${label}: artwork provider invalid`);
  // Existing Steam records predate the provenance fields. Their exact legacy
  // shape is the only remote exception; all new remote records are auditable.
  const legacySteam = isLegacySteamArtwork(data, artwork);
  if (!legacySteam && artwork.provider === undefined) throw new Error(`${label}: remote artwork requires provider`);
  if (!legacySteam && (!hasDimensions || artwork.contentSha256 === undefined)) throw new Error(`${label}: remote artwork requires native dimensions and contentSha256`);
}

export function loadRegistry() {
  const targets = files(path.join(ROOT, 'targets')).filter(file => path.basename(file) === 'target.json').map(file => ({ file, data: read(file) }));
  const devices = files(path.join(ROOT, 'devices')).filter(file => path.basename(file) === 'device.json').map(file => ({ file, data: read(file) }));
  const profiles = files(path.join(ROOT, 'profiles')).filter(file => path.basename(file) === 'profile.json').map(file => ({ file, data: read(file) }));
  return { targets, devices, profiles };
}

export function validateRegistry(registry = loadRegistry()) {
  const targetById = new Map(); const deviceById = new Map(); const errors = [];
  const check = (fn) => { try { fn(); } catch (error) { errors.push(error.message); } };
  for (const { file, data } of registry.targets) check(() => {
    const label = path.relative(ROOT, file); if (data.schemaVersion !== 2) throw new Error(`${label}: schemaVersion must be 2`); requireSlug(data.id, `${label}.id`); if (!['game', 'software'].includes(data.kind)) throw new Error(`${label}: invalid kind`); if (!data.name || !Array.isArray(data.platforms) || !data.platforms.length) throw new Error(`${label}: name/platforms required`); unique(data.platforms, `${label} platforms`); if (!Array.isArray(data.actions)) throw new Error(`${label}: actions required`); unique(data.actions.map(action => action.id), `${label} actions`); for (const action of data.actions) requireSlug(action.id, `${label}.action.id`); if (!data.source?.url || !data.source?.title) throw new Error(`${label}: source required`); new URL(data.source.url); validateArtwork(data, label); if (targetById.has(data.id)) throw new Error(`${label}: duplicate target id`); targetById.set(data.id, data);
  });
  for (const { file, data } of registry.devices) check(() => {
    const label = path.relative(ROOT, file); if (data.schemaVersion !== 2) throw new Error(`${label}: schemaVersion must be 2`); requireSlug(data.id, `${label}.id`); if (!data.name || !data.manufacturer || !Array.isArray(data.inputs) || !data.inputs.length) throw new Error(`${label}: invalid device`); unique(data.inputs.map(input => input.id), `${label} inputs`); for (const input of data.inputs) { requireSlug(input.id, `${label}.input.id`); if (!input.name || !inputKinds.has(input.kind)) throw new Error(`${label}: invalid input`); } if (deviceById.has(data.id)) throw new Error(`${label}: duplicate device id`); deviceById.set(data.id, data);
  });
  const profileIds = [];
  for (const { file, data } of registry.profiles) check(() => {
    const label = path.relative(ROOT, file); if (data.schemaVersion !== 2) throw new Error(`${label}: schemaVersion must be 2`); requireSlug(data.id, `${label}.id`); const target = targetById.get(data.target?.id); const device = deviceById.get(data.deviceId); if (!target || !device) throw new Error(`${label}: target/device missing`); if (!target.platforms.includes(data.platform)) throw new Error(`${label}: platform unsupported`); if (!['mapped', 'unmapped'].includes(data.semanticStatus)) throw new Error(`${label}: semanticStatus invalid`); const actionIds = new Set(target.actions.map(action => action.id)); const inputIds = new Set(device.inputs.map(input => input.id)); for (const mapping of data.mappings || []) { if (!inputIds.has(mapping.input) || !actionIds.has(mapping.action) || !behaviors.has(mapping.behavior)) throw new Error(`${label}: invalid mapping`); } if (!data.snapshot || data.snapshot.file !== 'profile.csv' || !/^[a-f0-9]{64}$/.test(data.snapshot.sha256)) throw new Error(`${label}: invalid snapshot`); const csv = path.join(path.dirname(file), 'profile.csv'); if (!fs.existsSync(csv)) throw new Error(`${label}: missing profile.csv`); const bytes = fs.readFileSync(csv); if (!bytes.length || bytes.length > 131072) throw new Error(`${label}: CSV size invalid`); if (crypto.createHash('sha256').update(bytes).digest('hex') !== data.snapshot.sha256) throw new Error(`${label}: snapshot hash mismatch`); profileIds.push(data.id);
  });
  unique(profileIds, 'profile ids'); return errors;
}

export function buildIndexes(registry = loadRegistry()) {
  const targets = registry.targets.map(({ data }) => data).sort((a, b) => a.name.localeCompare(b.name));
  const devices = registry.devices.map(({ data }) => ({ id: data.id, name: data.name, manufacturer: data.manufacturer, inputs: data.inputs })).sort((a, b) => a.name.localeCompare(b.name));
  const devicesV2 = registry.devices.map(({ data }) => data).sort((a, b) => a.name.localeCompare(b.name));
  const profiles = registry.profiles.map(({ data }) => data).sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const v2 = { schemaVersion: 2, targets, devices: devicesV2, profiles };
  const games = targets.filter(target => target.kind === 'game').map(target => ({ id: target.id, name: target.name, aliases: target.aliases || [], platforms: target.platforms, actions: target.actions, source: target.source, controls: target.controls || [] }));
  const v1Profiles = profiles.filter(profile => profile.target.kind === 'game').map(profile => ({ schemaVersion: 1, id: profile.id, title: profile.title, description: profile.description, gameId: profile.target.id, platform: profile.platform, deviceId: profile.deviceId, semanticStatus: profile.semanticStatus, mappings: profile.mappings, tags: profile.tags, contributor: profile.contributor, source: profile.source, snapshot: profile.snapshot, createdAt: profile.createdAt, ...(profile.updatedAt ? { updatedAt: profile.updatedAt } : {}) }));
  return { v1: { schemaVersion: 1, games, devices, profiles: v1Profiles }, v2 };
}

export function stable(value) { return `${JSON.stringify(value, null, 2)}\n`; }
