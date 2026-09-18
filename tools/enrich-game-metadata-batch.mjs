import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './registry.mjs';

const endpoint = 'https://query.wikidata.org/sparql';
const fetchedAt = '2026-09-18';
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
const lookupName = value => value.replace(/\s+(?:x360|qmp4|pc|beta(?:test)?|rem|redone|optimized)\b.*$/i, '').replace(/\s+-\s+(?:mp|wz.*|story|single player).*$/i, '').trim();
const files = fs.readdirSync(path.join(ROOT, 'targets', 'games')).map(id => path.join(ROOT, 'targets', 'games', id, 'target.json'));
const targets = files.map(file => ({ file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }));
const names = Array.from(new Set(targets.map(item => lookupName(item.data.name))));
const values = names.map(name => `("${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@en)`).join(' ');
const query = `SELECT ?wanted ?item ?itemLabel ?description (MIN(?releaseDate) AS ?firstRelease) (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres) (GROUP_CONCAT(DISTINCT ?platformLabel; separator="|") AS ?platforms) WHERE { VALUES (?wanted) { ${values} } ?item rdfs:label ?wanted . OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") } OPTIONAL { ?item wdt:P577 ?releaseDate . } OPTIONAL { ?item wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(LANG(?genreLabel) = "en") } OPTIONAL { ?item wdt:P400 ?platform . ?platform rdfs:label ?platformLabel . FILTER(LANG(?platformLabel) = "en") } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?wanted ?item ?itemLabel ?description`;
const response = await fetch(`${endpoint}?${new URLSearchParams({ query, format: 'json' })}`, { headers: { 'User-Agent': 'Adaptive-Profiles-Registry/1.0 (batched public metadata enrichment)' } });
if (!response.ok) throw new Error(`Wikidata SPARQL HTTP ${response.status}`);
const payload = await response.json();
const byName = new Map();
for (const binding of payload.results.bindings || []) {
  const wanted = binding.wanted?.value;
  const item = binding.item?.value?.replace('http://www.wikidata.org/entity/', '');
  if (!wanted || !item) continue;
  byName.set(normalize(wanted), {
    provider: 'wikidata', license: 'CC0', id: item, url: `https://www.wikidata.org/entity/${item}`,
    name: binding.itemLabel?.value || wanted, description: binding.description?.value || null,
    releaseDate: binding.firstRelease?.value?.slice(0, 10) || null,
    genres: binding.genres?.value ? binding.genres.value.split('|').filter(Boolean).slice(0, 8) : [],
    platforms: binding.platforms?.value ? binding.platforms.value.split('|').filter(Boolean).slice(0, 8) : [], fetchedAt,
  });
}
let matched = 0;
for (const target of targets) {
  const metadata = byName.get(normalize(lookupName(target.data.name)));
  if (!metadata) continue;
  target.data.metadata = metadata;
  fs.writeFileSync(target.file, `${JSON.stringify(target.data, null, 2)}\n`);
  matched += 1;
}
fs.writeFileSync(path.join(ROOT, 'research', 'game-metadata-wikidata.json'), `${JSON.stringify({ provider: 'Wikidata', endpoint, fetchedAt, requested: names.length, matched, unresolved: names.filter(name => !byName.has(normalize(name))) }, null, 2)}\n`);
console.log(`Batched Wikidata enrichment: ${matched} matched, ${targets.length - matched} unresolved.`);
