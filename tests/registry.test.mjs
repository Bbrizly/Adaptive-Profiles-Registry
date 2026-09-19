import assert from 'node:assert/strict';
import { buildIndexes, loadRegistry, validateRegistry } from '../tools/registry.mjs';
import { collectArtworkCandidates, fetchValidatedImage, titleMatch } from '../tools/enrich-game-artwork.mjs';

const registry = loadRegistry();
assert.deepEqual(validateRegistry(registry), []);
const { v1, v2 } = buildIndexes(registry);
assert.equal(v1.schemaVersion, 1);
assert.equal(v2.schemaVersion, 2);
assert.equal(v2.targets.filter(target => target.kind === 'game').length, v1.games.length);
assert.deepEqual(v2.profiles.filter(profile => profile.target.kind === 'software'), []);
const knight = v2.targets.find(target => target.name === 'Batman Arkham Knight');
assert.equal(knight?.id, 'batman-arkham-knight');
assert.equal(v2.targets.some(target => /^(?:Dan NH|Silas P\. \(PC\)|Heiko|Steamy Biscuit)\//i.test(target.name)), false);
assert.equal(v2.targets.some(target => /Batman Arkham Knight v$/i.test(target.name)), false);
assert.equal(v2.profiles.some(profile => /Dan NH\/|Batman Arkham Knight v/i.test(profile.title)), false);
assert.equal(v2.targets.some(target => /^(?:Matt Victor|RockyNoHands|Steamy Biscuit)\b/i.test(target.name)), false);
assert.equal(v2.targets.some(target => /(?: - Steam|-$|^LOL$|^Portal2$|^StarCitizen$)/i.test(target.name)), false);
assert.equal(v2.targets.some(target => ['League of Legends', 'Fortnite', 'PUBG', 'Call of Duty: Modern Warfare'].includes(target.name) && /^(?:Matt Victor|RockyNoHands)\b/i.test(target.name)), false);
console.log('Registry compatibility tests passed.');

function artworkTarget(artwork, artworkStatus) {
  return {
    schemaVersion: 2, id: 'fixture-target', kind: 'game', name: 'Fixture', aliases: [],
    categories: [], platforms: ['pc'], actions: [], source: { url: 'https://example.com', title: 'Fixture' },
    ...(artwork ? { artwork } : {}), ...(artworkStatus ? { artworkStatus } : {}),
  };
}
function errorsFor(target) { return validateRegistry({ targets: [{ file: '/tmp/target.json', data: target }], devices: [], profiles: [] }); }
const verified = { kind: 'wikimedia', url: 'https://upload.wikimedia.org/wikipedia/commons/example.jpg', provider: 'wikimedia', nativeWidth: 1200, nativeHeight: 675, contentSha256: 'a'.repeat(64), attribution: 'Artist', license: 'CC BY-SA' };
assert.deepEqual(errorsFor(artworkTarget(verified)), []);
assert.match(errorsFor(artworkTarget({ ...verified, url: 'http://upload.wikimedia.org/example.jpg' }))[0], /HTTPS/);
assert.match(errorsFor(artworkTarget({ ...verified, url: 'https://commons.wikimedia.org/example.jpg' }))[0], /allowed provider host/);
assert.match(errorsFor(artworkTarget({ ...verified, nativeHeight: undefined }))[0], /dimensions/);
assert.match(errorsFor(artworkTarget({ ...verified, contentSha256: undefined }))[0], /contentSha256/);
assert.match(errorsFor(artworkTarget({ ...verified, attribution: '' }))[0], /attribution/);
assert.match(errorsFor(artworkTarget({ ...verified }, 'unavailable'))[0], /mutually exclusive/);
assert.match(errorsFor(artworkTarget(undefined, 'pending'))[0], /artworkStatus invalid/);
assert.match(errorsFor(artworkTarget({ ...verified, provider: undefined }))[0], /provider/);
assert.match(errorsFor(artworkTarget({ ...verified, provider: '' }))[0], /provider/);
assert.match(errorsFor(artworkTarget({ ...verified, provider: null }))[0], /provider/);
assert.deepEqual(errorsFor(artworkTarget({ kind: 'steam', url: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/header.jpg', source: 'https://store.steampowered.com/app/1/', fallbackPath: 'artwork/games/fixture-target.svg', attribution: 'Steam store artwork', license: 'third-party' })), []);
assert.deepEqual(errorsFor(artworkTarget({ kind: 'generated', url: 'https://raw.githubusercontent.com/example.svg', attribution: 'Adaptive Profiles', license: 'Adaptive Profiles terms' })), []);
console.log('Artwork validation tests passed.');

// Artwork enrichment safety/fixture tests. Every fetch is mocked; this test file
// must remain network-free and should exercise the same public seams as the CLI.
const png = (width = 120, height = 80) => Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  width >>> 24, width >>> 16 & 255, width >>> 8 & 255, width & 255, height >>> 24, height >>> 16 & 255, height >>> 8 & 255, height & 255,
]);
const response = (body, type = 'image/png', status = 200, extra = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: key => ({ 'content-type': type, 'content-length': body?.byteLength ?? body?.length, ...extra })[key.toLowerCase()] ?? null }, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength), json: async () => body });
const fetchMap = routes => async url => routes[url] || response(new Uint8Array(), 'text/plain', 404);
const steamImage = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/0123456789abcdef0123456789abcdef01234567/header.jpg';
const targetFixture = (id, name, aliases = [], appId = 123) => ({ schemaVersion: 2, id, kind: 'game', name, aliases, platforms: ['pc'], actions: [], source: { url: 'https://example.com', title: name }, metadata: { steam: { appId, name } } });

assert.equal(titleMatch(targetFixture('alias-game', 'Star Game', ['SG']), 'SG').matched, true, 'aliases match conservatively');
assert.equal(titleMatch(targetFixture('ambiguous-game', 'Star Game', ['Star']), 'Star Game Deluxe').matched, false, 'weak/conflicting title match is rejected');
await assert.rejects(() => fetchValidatedImage('https://shared.akamai.steamstatic.com.evil.test/store_item_assets/steam/apps/1/header.jpg', fetchMap({})), /host\/protocol/);
await assert.rejects(() => fetchValidatedImage('http://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/header.jpg', fetchMap({})), /host\/protocol/);
await assert.rejects(() => fetchValidatedImage('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/not-artwork.jpg', fetchMap({})), /path not allowed/);
await fetchValidatedImage(steamImage, fetchMap({ [steamImage]: response(png()) }));
await assert.rejects(() => fetchValidatedImage(steamImage, fetchMap({ [steamImage]: response(png(), 'application/octet-stream') })), /content type/);
await assert.rejects(() => fetchValidatedImage(steamImage, fetchMap({ [steamImage]: response(new Uint8Array(), 'image/png', 503) })), /HTTP 503/);
await assert.rejects(() => fetchValidatedImage(steamImage, fetchMap({ [steamImage]: response(new Uint8Array(10 * 1024 * 1024 + 1)) })), /byte limit/);
const redirect = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/header.jpg';
await assert.rejects(() => fetchValidatedImage(redirect, fetchMap({ [redirect]: response(new Uint8Array(), '', 302, { location: redirect }) })), /redirect limit/);
await assert.rejects(() => fetchValidatedImage(steamImage, fetchMap({ [steamImage]: response(Uint8Array.from([1, 2, 3])) })), /signature/);
await assert.rejects(() => fetchValidatedImage(steamImage.replace('.jpg', '.bmp'), fetchMap({})), /path not allowed/);
await assert.rejects(() => fetchValidatedImage(steamImage, fetchMap({ [steamImage]: response(png(1, 80)) })), /dimensions/);
await assert.rejects(() => fetchValidatedImage(steamImage, fetchMap({ [steamImage]: response(png(5000, 5000)) })), /pixel budget/);
await assert.rejects(() => fetchValidatedImage(steamImage, fetchMap({ [steamImage]: response(png(12000, 12000)) })), /pixel budget|decode allocation/);

const artworkApi = 'https://store.steampowered.com/api/appdetails?appids=123&l=english';
const duplicateTarget = targetFixture('duplicate-game', 'Star Game', [], 123);
const acceptedRoutes = {
  [artworkApi]: response({ '123': { data: { name: 'Star Game', steam_appid: 123, header_image: steamImage } } }, 'application/json'),
  [steamImage]: response(png()),
};
const ledger = await collectArtworkCandidates({ registry: { targets: [{ data: duplicateTarget }, { data: targetFixture('missing-game', 'Missing Game', [], null) }], devices: [], profiles: [] }, fetchImpl: fetchMap(acceptedRoutes) });
assert.equal(ledger.find(item => item.targetId === 'duplicate-game' && item.provider === 'steam').status, 'accepted');
assert.equal(ledger.some(item => item.status === 'duplicate'), false, 'one target does not self-duplicate');
const duplicateLedger = await collectArtworkCandidates({ registry: { targets: [{ data: duplicateTarget }, { data: targetFixture('duplicate-game-two', 'Star Game', [], 123) }], devices: [], profiles: [] }, fetchImpl: fetchMap(acceptedRoutes) });
assert.equal(duplicateLedger.filter(item => item.status === 'duplicate').length, 1, 'duplicate hashes are ledgered');
console.log('Artwork enrichment safety tests passed.');
