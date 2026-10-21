// Loads the actual TypeScript implementation, without running its CLI or gear import side effects.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';
import ts from 'typescript';
import wtf from 'wtf_wikipedia';
const root = fileURLToPath(new URL('../', import.meta.url));
const generated = `${root}target/oracle/`;
await mkdir(generated, { recursive: true });
for (const name of ['fuzzy-dict', 'scraper']) {
	const source = await readFile(new URL(`../../fandom-scraper/src/${name}.ts`, import.meta.url), 'utf8');
	await writeFile(`${generated}${name}.js`, ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
	}).outputText);
}
const { FandomScraper } = await import(pathToFileURL(`${generated}scraper.js`));
export function expectedBrawler(input) {
	const page = wtf(input.source, { title: input.title, domain: 'brawlstars.fandom.com' });
	const $ = cheerio.load(input.html);
	const scraper = new FandomScraper();
	const name = input.name === 'Jae-Yong' ? 'Jae-yong' : input.name;
	const oldLog = console.log, oldWarn = console.warn;
	console.log = console.warn = () => { };
	try {
		return JSON.parse(JSON.stringify({
			attribution: page.url().replace('//en.', '//'),
			...scraper.parseDescriptions(page, $),
			...scraper.parseAttack(page, $, name),
			...scraper.parseSuper(page, $, name),
			...scraper.parseHypercharge(name, page, $),
			...scraper.parseHealthByLevel(page, name),
			...scraper.parseStats(page, name),
			...scraper.parseTips(page),
			...scraper.parseDefaultSkin(name, $),
			...scraper.parseAvatar(name, $),
			...scraper.parseSkins(name, page, $),
			...scraper.parseBalanceHistory(page),
			...scraper.parseGadgets(name, page, $, input.gadgets),
			...scraper.parseStarpowers(name, page, $, input.starpowers),
		}));
	}
	finally {
		console.log = oldLog;
		console.warn = oldWarn;
	}
}
export async function expectedMode(input) {
	const original = wtf.fetch;
	wtf.fetch = async () => wtf(input.source, { title: input.title, domain: 'brawlstars.fandom.com' });
	try {
		return JSON.parse(JSON.stringify(await new FandomScraper().getModeData(input.name)));
	}
	finally {
		wtf.fetch = original;
	}
}
