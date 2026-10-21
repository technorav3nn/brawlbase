import { writeFile, mkdir, access } from 'node:fs/promises';
import process from "node:process";
import { URL } from "node:url";
// Capture fixed inputs and expected outputs using the unchanged old scraper.
import { gzipSync } from 'node:zlib';
import wtf from 'wtf_wikipedia';
import { expectedBrawler } from './oracle.mjs';
const dest = new URL('../tests/fixtures/', import.meta.url);
await mkdir(dest, { recursive: true });
let names = process.argv.slice(2);
if (!names.length)
	names.push('Shelly', 'Kaze', 'Meg', 'Bonnie', 'Larry & Lawrie', 'Mr. P', 'Jae-Yong', 'Lumi', 'Nita');
async function json(url) {
	const res = await fetch(url);
	if (!res.ok)
		throw new Error(`${res.status}: ${url}`);
	return res.json();
}
if (names.includes('--all')) {
	const category = await json('https://brawlstars.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Brawlers&cmlimit=500&format=json');
	names = category.query.categorymembers.filter(p => p.ns === 0 && p.title !== 'Buzz Lightyear').map(p => p.title === 'Jae-yong' ? 'Jae-Yong' : p.title);
	names = (await Promise.all(names.map(async (name) => {
		try {
			await access(new URL(name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_') + '.json.gz', dest));
			return null;
		}
		catch {
			return name;
		}
	}))).filter(Boolean);
}
const pages = [];
for (const name of names) {
	const q = await json(`https://brawlstars.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=true&titles=${encodeURIComponent(name)}`);
	const page = Object.values(q.query.pages)[0];
	const parsed = await json(`https://brawlstars.fandom.com/api.php?action=parse&page=${encodeURIComponent(page.title)}&format=json`);
	pages.push({ name, title: page.title, source: page.revisions[0].slots.main['*'], html: parsed.parse.text['*'] });
	console.log('Fetched', name);
}
// Prefer a real catalog; deterministic IDs still test matching if the catalog endpoint is blocked.
let catalog;
try {
	catalog = (await json('https://api.brawlapi.com/v1/brawlers')).list;
}
catch {
	console.log('Catalog unavailable; using explicit fixture catalog');
}
const starpowers = [], gadgets = [];
if (catalog) {
	catalog = catalog.filter(b => b.name !== 'Buzz Lightyear').sort((a, b) => a.name === 'Larry & Lawrie' ? -1 : b.name === 'Larry & Lawrie' ? 1 : 0);
	starpowers.push(...catalog.flatMap(b => b.starPowers));
	gadgets.push(...catalog.flatMap(b => b.gadgets));
}
else {
	for (const p of pages) {
		for (const [kind, target] of [['Gadget', gadgets], ['Star Power', starpowers]]) {
			const section = wtf(p.source).sections().find(s => s.title().startsWith(kind));
			for (const item of (section?.sections().length ? section.sections() : section ? [section] : [])) {
				const name = item.title().replace(/.*: /, '');
				if (!target.some(i => i.name === name))
					target.push({ id: (kind === 'Gadget' ? 23000000 : 23010000) + target.length, name });
			}
		}
	}
}
for (const p of pages) {
	const input = { ...p, starpowers, gadgets };
	try {
		input.expected = expectedBrawler(input);
	}
	catch (error) {
		console.error('Legacy scraper failed for', p.name, error.message);
		continue;
	}
	const filename = p.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_') + '.json.gz';
	await writeFile(new URL(filename, dest), gzipSync(JSON.stringify(input)));
	console.log('Captured', p.name, input.expected.skins.length, 'skins');
}
