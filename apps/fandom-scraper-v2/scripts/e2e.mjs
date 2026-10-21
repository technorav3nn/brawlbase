import { Buffer } from "node:buffer";
// Run both complete pipelines against a deterministic local server, then compare their output trees.
// Removes only the legacy gear module's accidental import-time second invocation.
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import ts from 'typescript';
import wtf from 'wtf_wikipedia';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = `${root}target/e2e/`;
const binary = process.env.FANDOM_BINARY ?? `${root}target/release/fandom-scraper-v2`;
await rm(directory, { recursive: true, force: true });
await mkdir(`${directory}oracle`, { recursive: true });
await mkdir(`${directory}legacy`, { recursive: true });
for (const name of ['fuzzy-dict', 'scraper', 'downloader', 'scrape-gears', 'index']) {
	let source = await readFile(new URL(`../../fandom-scraper/src/${name}.ts`, import.meta.url), 'utf8');
	source = source.replace('void main();', 'export { main };').replace('void scrapeGears();', '');
	source = source.replace(/from "\.\/(downloader|fuzzy-dict|scrape-gears|scraper)"/g, 'from "./$1.js"');
	await writeFile(`${directory}oracle/${name}.js`, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText);
}
const fixtures = await Promise.all(['shelly', 'lumi', 'larry_lawrie'].map(async (name) => JSON.parse(gunzipSync(await readFile(`${root}tests/fixtures/${name}.json.gz`)))));
const pixels = Buffer.alloc(192 * 160 * 4);
for (let y = 14; y < 140; y++)
	for (let x = 20; x < 165; x++) {
		const i = (y * 192 + x) * 4;
		pixels[i] = y < 60 ? 255 : 115;
		pixels[i + 1] = y < 60 ? 35 : 115;
		pixels[i + 2] = y < 60 ? 76 : 115;
		pixels[i + 3] = 255;
	}
const image = await sharp(pixels, { raw: { width: 192, height: 160, channels: 4 } }).png().toBuffer();
const brawlers = fixtures.map((f, i) => ({ id: 16000000 + i, name: f.name, starPowers: f.expected.starpowers.map(p => ({ id: Number(p.id), name: p.name })), gadgets: f.expected.gadgets.map(p => ({ id: Number(p.id), name: p.name })) }));
brawlers.splice(1, 0, { id: 16999999, name: 'Buzz Lightyear', starPowers: [], gadgets: [] });
brawlers.push({ id: 16999998, name: 'Missing', starPowers: [], gadgets: [] });
const gearRows = {
	health: { TID: 'health', InfoTID: 'healInfo', ModifierType: 'ticks', ModifierValue: 40, Rarity: 'RareGear' },
	damage: { TID: 'damage', InfoTID: 'damageInfo', ModifierType: 'percent', ModifierValue: 15, Rarity: 'SuperRareGear', ExtraHerosAvailableTo: ['Shelly', 'Lumi'] },
	exclusive: { TID: 'exclusive', InfoTID: 'exclusiveInfo', ModifierType: 'percent', ModifierValue: 20, Rarity: 'EpicGear', ExtraHerosAvailableTo: 'Shelly' },
	shared: { TID: 'shared', InfoTID: 'sharedInfo', ModifierType: 'percent', ModifierValue: 10, Rarity: 'EpicGear', ExtraHerosAvailableTo: ['Larry', 'Lumi'] },
};
const texts = {
	health: { EN: 'HEALTH' }, healInfo: { EN: 'Heal <NUM> seconds <c00cc00>bonus</c>' },
	damage: { EN: 'DAMAGE' }, damageInfo: { EN: 'Deal <c00cc00><NUM>%</c> more damage.' },
	exclusive: { EN: 'SHELL SHOCK' }, exclusiveInfo: { EN: 'Improve by <NUM>%.' },
	shared: { EN: 'SHIELD' }, sharedInfo: { EN: 'Gain <NUM>%.' },
};
let base;
let requests = 0, active = 0, peak = 0;
const server = createServer(async (req, res) => {
	requests++;
	active++;
	peak = Math.max(peak, active);
	await new Promise(resolve => setTimeout(resolve, 20));
	const url = new URL(req.url, base);
	let value;
	if (url.pathname === '/catalog')
		value = { list: brawlers };
	else if (url.pathname === '/api.php') {
		const name = url.searchParams.get('page');
		const f = fixtures.find(f => f.name === name || f.title === name);
		value = f ? { parse: { title: f.title, text: { '*': f.html }, wikitext: { '*': f.source } } } : { error: { code: 'missingtitle' } };
	}
	else if ((url.pathname.endsWith('/gear_boosts.json') || url.pathname.endsWith('/gear_boosts')))
		value = url.pathname.startsWith('/game/') ? gearRows : { data: gearRows };
	else if ((url.pathname.endsWith('/texts.json') || url.pathname.endsWith('/texts')))
		value = url.pathname.startsWith('/game/') ? texts : { data: texts };
	else if ((url.pathname.endsWith('/characters.json') || url.pathname.endsWith('/characters')))
		value = url.pathname.startsWith('/game/') ? { Shelly: { id: 16000000 }, Lumi: { id: 16000001 }, Larry: { id: 16000002 } } : { data: { Shelly: { id: 16000000 }, Lumi: { id: 16000001 }, Larry: { id: 16000002 } } };
	else if (url.pathname === '/wikia.php')
		value = { url: `${base}/images/gear/scale-to-width-down/100?cb=123` };
	else if (url.pathname.startsWith('/images/')) {
		res.setHeader('Content-Type', 'image/png');
		res.end(image);
		active--;
		return;
	}
	else {
		res.statusCode = 404;
		value = { error: 'unhandled fixture URL', url: req.url };
	}
	res.setHeader('Content-Type', 'application/json');
	res.end(JSON.stringify(value));
	active--;
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
base = `http://127.0.0.1:${server.address().port}`;
for (const f of fixtures) {
	const $ = cheerio.load(f.html);
	$('img').each((i, el) => { $(el).attr('src', `${base}/images/${i}?cb=1`); if ($(el).attr('data-src'))
		$(el).attr('data-src', `${base}/images/${i}?cb=1`); });
	f.html = $.html();
}
const originalFetch = globalThis.fetch, originalLog = console.log, originalWarn = console.warn;
const originalDir = process.cwd();
try {
	globalThis.fetch = (input, init) => {
		const u = new URL(input);
		// The unchanged reference CLI uses Brawlify; v2 uses BrawlAPI.
		if ((u.hostname === 'api.brawlify.com' || u.hostname === 'api.brawlapi.com') && u.pathname === '/v1/brawlers')
			u.href = `${base}/catalog`;
		else if (u.hostname === 'api.brawlapi.com')
			u.href = `${base}/raw${u.pathname.split('/v2/raw')[1]}`;
		else if (u.hostname === 'brawlstars.fandom.com' && u.pathname === '/wikia.php')
			u.href = `${base}/wikia.php${u.search}`;
		else if (u.hostname === 'brawlstars.fandom.com' && u.pathname === '/api.php')
			u.href = `${base}/api.php${u.search}`;
		if (u.hostname !== '127.0.0.1')
			throw new Error(`Unmocked URL: ${u}`);
		return originalFetch(u, init);
	};
	const { main } = await import(pathToFileURL(`${directory}oracle/index.js`));
	const originalWtfFetch = wtf.fetch;
	wtf.fetch = async (name) => {
		await new Promise(resolve => setTimeout(resolve, 20));
		const f = fixtures.find(f => f.name === name);
		return f ? wtf(f.source, { title: f.title, domain: 'brawlstars.fandom.com' }) : null;
	};
	let oldMs;
	try {
		process.chdir(`${directory}legacy`);
		console.log = console.warn = () => { };
		const start = performance.now();
		await main();
		oldMs = performance.now() - start;
	}
	finally {
		process.chdir(originalDir);
		console.log = originalLog;
		console.warn = originalWarn;
		wtf.fetch = originalWtfFetch;
		globalThis.fetch = originalFetch;
	}
	const legacyRequests = requests;
	requests = 0;
	peak = 0;
	const start = performance.now();
	await new Promise((resolve, reject) => {
		const child = spawn(binary, ['--out', `${directory}rust/out`, '--fandom-api', `${base}/api.php`, '--catalog-url', `${base}/catalog`, '--game-api', `${base}/game`, '--curated-api', `${base}/wikia.php`]);
		let error = '';
		child.stderr.on('data', chunk => error += chunk);
		child.on('error', reject);
		child.on('close', code => code === 0 ? resolve() : reject(new Error(error)));
	});
	const rustMs = performance.now() - start;
	async function files(root, path = '') {
		const result = [];
		for (const e of await readdir(`${root}/${path}`, { withFileTypes: true })) {
			const name = path ? `${path}/${e.name}` : e.name;
			if (e.isDirectory())
				result.push(...await files(root, name));
			else
				result.push(name);
		}
		return result.sort();
	}
	const oldRoot = `${directory}legacy/out`, rustRoot = `${directory}rust/out`;
	const oldFiles = await files(oldRoot), rustFiles = await files(rustRoot);
	if (!isDeepStrictEqual(oldFiles, rustFiles))
		throw new Error(`Output paths differ: ${JSON.stringify({ oldFiles, rustFiles })}`);
	for (const path of oldFiles) {
		const [a, b] = await Promise.all([readFile(`${oldRoot}/${path}`), readFile(`${rustRoot}/${path}`)]);
		if (path.endsWith('.json')) {
			if (!isDeepStrictEqual(JSON.parse(a), JSON.parse(b)))
				throw new Error(`JSON differs: ${path}`);
		}
		else if (!a.equals(b))
			throw new Error(`Image bytes differ: ${path}`);
	}
	const report = { files: oldFiles.length, legacyMs: Math.round(oldMs), rustMs: Math.round(rustMs), speedup: Number((oldMs / rustMs).toFixed(2)), legacyRequests, rustRequests: requests, peakRequests: peak };
	await writeFile(`${directory}result.json`, JSON.stringify(report, null, 2));
	console.log('Identical output paths, JSON values, and WebP bytes:', report);
}
finally {
	globalThis.fetch = originalFetch;
	console.log = originalLog;
	console.warn = originalWarn;
	process.chdir(originalDir);
	await new Promise(resolve => server.close(resolve));
}
