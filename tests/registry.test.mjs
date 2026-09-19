import assert from 'node:assert/strict';
import { buildIndexes, loadRegistry, validateRegistry } from '../tools/registry.mjs';

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
