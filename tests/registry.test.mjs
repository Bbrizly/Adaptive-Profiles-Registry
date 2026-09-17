import assert from 'node:assert/strict';
import { buildIndexes, loadRegistry, validateRegistry } from '../tools/registry.mjs';

const registry = loadRegistry();
assert.deepEqual(validateRegistry(registry), []);
const { v1, v2 } = buildIndexes(registry);
assert.equal(v1.schemaVersion, 1);
assert.equal(v2.schemaVersion, 2);
assert.equal(v2.targets.filter(target => target.kind === 'game').length, v1.games.length);
assert.deepEqual(v2.profiles.filter(profile => profile.target.kind === 'software'), []);
console.log('Registry compatibility tests passed.');
