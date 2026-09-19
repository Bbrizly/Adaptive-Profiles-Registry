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
const unresolvedArtwork = v2.targets.filter(target => target.kind === 'game' && target.artworkStatus);
assert.equal(unresolvedArtwork.length, 47);
assert.ok(unresolvedArtwork.every(target => !target.artwork && target.artworkFallbackPath === `artwork/games/${target.id}.svg`));
assert.ok(v2.targets.filter(target => target.artwork?.kind === 'steam' || target.artwork?.kind === 'wikimedia').every(target => target.artwork.fallbackPath === `artwork/games/${target.id}.svg`));
const knight = v2.targets.find(target => target.name === 'Batman Arkham Knight');
assert.equal(knight?.id, 'batman-arkham-knight');
assert.equal(v2.targets.some(target => /^(?:Dan NH|Silas P\. \(PC\)|Heiko|Steamy Biscuit)\//i.test(target.name)), false);
assert.equal(v2.targets.some(target => /Batman Arkham Knight v$/i.test(target.name)), false);
assert.equal(v2.profiles.some(profile => /Dan NH\/|Batman Arkham Knight v/i.test(profile.title)), false);
assert.equal(v2.targets.some(target => /^(?:Matt Victor|RockyNoHands|Steamy Biscuit)\b/i.test(target.name)), false);
assert.equal(v2.targets.some(target => /(?: - Steam|-$|^LOL$|^Portal2$|^StarCitizen$)/i.test(target.name)), false);
assert.equal(v2.targets.some(target => ['League of Legends', 'Fortnite', 'PUBG', 'Call of Duty: Modern Warfare'].includes(target.name) && /^(?:Matt Victor|RockyNoHands)\b/i.test(target.name)), false);
console.log('Registry compatibility tests passed.');

function artworkTarget(artwork, artworkStatus, artworkFallbackPath) {
  return {
    schemaVersion: 2, id: 'fixture-target', kind: 'game', name: 'Fixture', aliases: [],
    categories: [], platforms: ['pc'], actions: [], source: { url: 'https://example.com', title: 'Fixture' },
    ...(artwork ? { artwork } : {}), ...(artworkStatus ? { artworkStatus } : {}), ...(artworkFallbackPath ? { artworkFallbackPath } : {}),
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
assert.deepEqual(errorsFor(artworkTarget(undefined, 'unavailable', 'artwork/games/fixture-target.svg')), []);
assert.match(errorsFor(artworkTarget(undefined, 'unavailable', 'artwork/games/other.svg'))[0], /artworkFallbackPath invalid/);
assert.match(errorsFor(artworkTarget(undefined, undefined, 'artwork/games/fixture-target.svg'))[0], /requires artworkStatus/);
assert.match(errorsFor(artworkTarget(verified, 'unavailable', 'artwork/games/fixture-target.svg'))[0], /mutually exclusive|cannot coexist/);
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
const response = (body, type = 'image/png', status = 200, extra = {}) => { const raw = body instanceof Uint8Array ? body : new TextEncoder().encode(JSON.stringify(body)); return { ok: status >= 200 && status < 300, status, headers: { get: key => ({ 'content-type': type, 'content-length': raw.byteLength, ...extra })[key.toLowerCase()] ?? null }, arrayBuffer: async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), json: async () => body }; };
const streamResponse = (chunks, type = 'image/png', status = 200, extra = {}) => { let index = 0; let cancelled = false; return { ok: status >= 200 && status < 300, status, headers: { get: key => ({ 'content-type': type, ...extra })[key.toLowerCase()] ?? null }, body: { getReader: () => ({ read: async () => index < chunks.length ? { done: false, value: chunks[index++] } : { done: true }, cancel: async () => { cancelled = true; }, releaseLock: () => {} }) }, get cancelled() { return cancelled; } }; };
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

const commonsImage = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Commons_Game.png';
const commonsApi = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=Commons%20Game&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*';
const commonsPage = (license, imageUrl = commonsImage, extra = {}) => ({ title: 'File:Commons Game.png', imageinfo: [{ url: imageUrl, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Commons_Game.png', extmetadata: { LicenseShortName: { value: license }, Artist: { value: 'Test Artist' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' }, ...extra } }] });
const commonsTarget = targetFixture('commons-game', 'Commons Game', [], null);
const commonsRoutes = { [commonsApi]: response({ query: { pages: { 1: commonsPage('CC BY-SA 4.0') } } }, 'application/json'), [commonsImage]: response(png()) };
const commonsLedger = await collectArtworkCandidates({ registry: { targets: [{ data: commonsTarget }], devices: [], profiles: [] }, fetchImpl: fetchMap(commonsRoutes) });
const commonsAccepted = commonsLedger.find(item => item.provider === 'wikimedia' && item.status === 'accepted');
assert.equal(commonsAccepted.license, 'CC BY SA');
assert.equal(commonsAccepted.author, 'Test Artist');
assert.equal(commonsAccepted.attribution, 'Test Artist — CC BY SA');
assert.equal(commonsAccepted.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
assert.equal(commonsAccepted.imageWidth, 120);
const badCommonsImage = 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Bad_Commons_Game.png';
const rejectPages = { 1: commonsPage('All rights reserved'), 2: commonsPage('CC BY 4.0', null), 3: commonsPage('CC0', 'https://example.com/not-upload.png'), 4: { title: 'File:Commons Game (missing).png' } };
const rejectedCommons = await collectArtworkCandidates({ registry: { targets: [{ data: commonsTarget }], devices: [], profiles: [] }, fetchImpl: fetchMap({ [commonsApi]: response({ query: { pages: rejectPages } }, 'application/json') }) });
const commonsRejects = rejectedCommons.filter(item => item.provider === 'wikimedia' && item.status === 'rejected');
assert.equal(commonsRejects.length, 4, 'unsupported, missing, and disallowed Commons candidates are ledgered');
assert.ok(commonsRejects.some(item => /disallowed license/.test(item.reason)));
assert.ok(commonsRejects.some(item => /no delivery URL/.test(item.reason)));
assert.ok(commonsRejects.some(item => /host\/protocol not allowed/.test(item.reason)));
assert.ok(commonsRejects.some(item => /no image metadata/.test(item.reason)));
const redirectCommons = 'https://upload.wikimedia.org/wikipedia/commons/d/de/Redirect_Commons_Game.png';
const redirectCommonsBad = 'https://upload.wikimedia.org/wikipedia/commons-not-allowed/d/de/Redirect_Commons_Game.png';
await assert.rejects(() => fetchValidatedImage(redirectCommons, fetchMap({ [redirectCommons]: response(new Uint8Array(), '', 302, { location: redirectCommonsBad }) })), /path not allowed/);
await assert.rejects(() => fetchValidatedImage(commonsImage, fetchMap({ [commonsImage]: response(png(), 'image/png', 200, { 'content-length': String(10 * 1024 * 1024 + 1) }) })), /byte limit/);
const streamedOversize = streamResponse([new Uint8Array(6 * 1024 * 1024), new Uint8Array(4 * 1024 * 1024 + 1)]);
await assert.rejects(() => fetchValidatedImage(commonsImage, fetchMap({ [commonsImage]: streamedOversize })), /byte limit/);
assert.equal(streamedOversize.cancelled, true, 'streaming byte limit cancels before unbounded accumulation');
const declaredOversize = streamResponse([png()], 'image/png', 200, { 'content-length': String(10 * 1024 * 1024 + 1) });
await assert.rejects(() => fetchValidatedImage(commonsImage, fetchMap({ [commonsImage]: declaredOversize })), /byte limit/);
assert.equal(declaredOversize.cancelled, true, 'declared oversized image body is canceled before reading');
const discoveryOversize = streamResponse([new Uint8Array(2 * 1024 * 1024 + 1)], 'application/json');
const discoveryFailureLedger = await collectArtworkCandidates({ registry: { targets: [{ data: duplicateTarget }, { data: targetFixture('after-failure-game', 'After Failure Game', [], null) }], devices: [], profiles: [] }, fetchImpl: fetchMap({ [artworkApi]: discoveryOversize }) });
assert.equal(discoveryOversize.cancelled, true, 'oversized discovery JSON is canceled');
assert.equal(discoveryFailureLedger.find(item => item.targetId === 'duplicate-game' && item.provider === 'steam').status, 'unavailable');
assert.ok(discoveryFailureLedger.some(item => item.targetId === 'after-failure-game'), 'later targets continue after Steam failure');
const noAuthorCommonsApi = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=No%20Author%20Game&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*';
const noAuthorTarget = targetFixture('no-author-game', 'No Author Game', [], null);
const noAuthorPage = commonsPage('CC BY 4.0', commonsImage, { Artist: { value: '   ' }, Credit: { value: '' } });
const noAuthorLedger = await collectArtworkCandidates({ registry: { targets: [{ data: noAuthorTarget }], devices: [], profiles: [] }, fetchImpl: fetchMap({ [noAuthorCommonsApi]: response({ query: { pages: { 1: { ...noAuthorPage, title: 'File:No Author Game.png' } } } }, 'application/json') }) });
const noAuthorRecord = noAuthorLedger.find(item => item.provider === 'wikimedia');
assert.equal(noAuthorRecord.status, 'rejected');
assert.match(noAuthorRecord.reason, /no usable author/);
assert.equal(noAuthorRecord.author, null);
const creditApi = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=Credit%20Game&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*';
const creditPage = commonsPage('CC BY 4.0', commonsImage, { Artist: { value: '<span> </span>' }, Credit: { value: ' <a>Credit Artist</a> ' } });
const creditLedger = await collectArtworkCandidates({ registry: { targets: [{ data: targetFixture('credit-game', 'Credit Game', [], null) }], devices: [], profiles: [] }, fetchImpl: fetchMap({ [creditApi]: response({ query: { pages: { 1: { ...creditPage, title: 'File:Credit Game.png' } } } }, 'application/json'), [commonsImage]: response(png()) }) });
const creditRecord = creditLedger.find(item => item.provider === 'wikimedia' && item.status === 'accepted');
assert.equal(creditRecord.author, 'Credit Artist', 'normalized Artist falls back to normalized Credit');
console.log('Artwork enrichment safety tests passed.');
