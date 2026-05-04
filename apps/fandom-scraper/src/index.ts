import { mkdir } from "node:fs/promises";
import { Downloader } from "./downloader";
import { getIdFromName } from "./fuzzy-dict";
import { scrapeGears } from "./scrape-gears";
import { FandomScraper } from "./scraper";

const OUT_DIR = "./out";

const BRAWLER_DIR = `${OUT_DIR}/brawlers`;
const HYPERCHARGES_DIR = `${OUT_DIR}/hypercharges`;
const STAR_POWER_DIR = `${OUT_DIR}/star-powers`;
const GADGETS_DIR = `${OUT_DIR}/gadgets`;

async function main() {
	await mkdir(OUT_DIR, { recursive: true });
	await mkdir(BRAWLER_DIR, { recursive: true });
	await mkdir(HYPERCHARGES_DIR, { recursive: true });
	await mkdir(STAR_POWER_DIR, { recursive: true });
	await mkdir(GADGETS_DIR, { recursive: true });

	const scraper = new FandomScraper();
	const downloader = new Downloader();

	const { list: _brawlers } = (await fetch("https://api.brawlify.com/v1/brawlers").then((res) => res.json())) as {
		list: any[];
	};

	const brawlers = _brawlers
		.sort((a, b) => (a.name === "Larry & Lawrie" ? -1 : b.name === "Larry & Lawrie" ? 1 : 0))
		.filter((b) => b.name !== "Buzz Lightyear");

	const starpowers = brawlers.map((b) => b.starPowers).flat();
	const gadgets = brawlers.map((b) => b.gadgets).flat();

	for (const brawler of brawlers) {
		console.log(`Downloading ${brawler.name}`);
		const fandomBrawler = await scraper.getBrawlerData(brawler.name, starpowers, gadgets);
		if (fandomBrawler! === "skipped") {
			continue;
		}
		const outDir = `${BRAWLER_DIR}/${brawler.id}`;

		await downloader.downloadAsset(fandomBrawler!.model.sourceUrl, outDir, `${outDir}/model.png`);
		await downloader.writeData(fandomBrawler!, outDir, `${outDir}/data.json`);

		for (const gadget of fandomBrawler!.gadgets) {
			if (brawler.name === "Lumi" && gadget.name === "Internal Flames") {
				await downloader.downloadAsset(gadget.asset.sourceUrl, outDir, `${GADGETS_DIR}/23000907.png`, true);
				continue;
			}

			const id = getIdFromName(gadget.name, gadgets).id;
			await downloader.downloadAsset(gadget.asset.sourceUrl, outDir, `${GADGETS_DIR}/${id}.png`, true);
		}

		for (const starPower of fandomBrawler!.starpowers) {
			const id = getIdFromName(starPower.name, starpowers).id;
			await downloader.downloadAsset(starPower.asset.sourceUrl, outDir, `${STAR_POWER_DIR}/${id}.png`, true);
		}

		if (fandomBrawler!.hypercharge) {
			await downloader.downloadAsset(
				fandomBrawler!.hypercharge.asset.sourceUrl,
				outDir,
				`${HYPERCHARGES_DIR}/${brawler.id}.png`
			);
		}

		if (fandomBrawler!.skins.length > 0) {
			await downloader.makeDir(`${outDir}/skins`);
			for (const skin of fandomBrawler!.skins) {
				console.log("skin", skin.name);
				await mkdir(`${outDir}/skins/${skin.name}`, { recursive: true });
				await downloader.downloadAsset(skin.asset.sourceUrl, outDir, `${outDir}/skins/${skin.name}/model.png`);
				if (skin.profileIcons.length > 0) {
					for (const icon of skin.profileIcons) {
						await downloader.downloadAsset(icon.sourceUrl, outDir, `${outDir}/skins/${skin.name}/profile-icon.png`);
					}
				}
			}
		}

		// Portrait
		if (fandomBrawler!.avatar) {
			await downloader.downloadAsset(fandomBrawler!.avatar.sourceUrl, outDir, `${outDir}/portrait.png`);
		}
	}

	await scrapeGears();
}

void main();
