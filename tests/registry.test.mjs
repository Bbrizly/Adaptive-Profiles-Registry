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
console.log('Registry compatibility tests passed.');
