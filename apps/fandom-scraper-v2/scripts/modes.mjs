import { mkdir, writeFile } from 'node:fs/promises';
import { URL } from "node:url";
import { expectedMode } from './oracle.mjs';
const directory = new URL('../tests/fixtures/modes/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const name of ['Brawl Ball', 'Gem Grab', 'Knockout']) {
	const response = await fetch(`https://brawlstars.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=true&titles=${encodeURIComponent(name)}`);
	if (!response.ok)
		throw new Error(response.status);
	const page = Object.values((await response.json()).query.pages)[0];
	const fixture = { name, title: page.title, source: page.revisions[0].slots.main['*'] };
	fixture.expected = await expectedMode(fixture);
	await writeFile(new URL(`${name.replaceAll(' ', '_').toLowerCase()}.json`, directory), JSON.stringify(fixture));
	console.log('Captured', name);
}
