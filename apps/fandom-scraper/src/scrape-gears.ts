/* eslint-disable n/prefer-global/buffer */
import fs from "node:fs/promises";
import sharp from "sharp";

const OUT_DIR = "./out/gears";
const BRAWLERS_DIR = "./out/brawlers";

async function nfetch(...args: Parameters<typeof fetch>) {
	const res = await fetch(...args);
	return await res.json();
}

export async function scrapeGears() {
	const gearInfo = (await nfetch("https://api.brawlapi.com/v2/raw/csv_logic/gear_boosts.json")).data as any;
	const tids = (await nfetch("https://api.brawlapi.com/v2/raw/localization/texts.json")).data;
	const brawlers = (await nfetch("https://api.brawlapi.com/v2/raw/csv_logic/characters.json")).data;
	const brawlApiBrawlers = (await nfetch("https://api.brawlify.com/v1/brawlers")).list;

	async function getGearImageUrl(gearName: string) {
		const res = await nfetch(
			`https://brawlstars.fandom.com/wikia.php?controller=CuratedContent&method=getImage&title=File:${encodeURIComponent(
				gearName
			)}Gear.png`
		);
		const { url } = res;
		return url.replaceAll(/scale-to-.*?(?=\?)/g, "");
	}

	async function exists(f: any) {
		try {
			await fs.stat(f);
			return true;
		} catch {
			return false;
		}
	}

	async function downloadImageUrl(url: string, filename: string) {
		console.log(url, filename);
		const res = await fetch(url);
		const buffer = Buffer.from(await res.arrayBuffer());
		if (!(await exists(OUT_DIR))) {
			await fs.mkdir(OUT_DIR, { recursive: true });
		}
		const newBuffer = await sharp(buffer).toFormat("webp").resize(80).toBuffer();
		await fs.writeFile(`${OUT_DIR}/${filename.replace("png", "webp")}`, newBuffer);
	}

	// confusing, but this is how it is actually in-game
	const IG_RARITY_TO_ACTUAL_RARITY = {
		RareGear: "Super Rare",
		SuperRareGear: "Epic",
		EpicGear: "Mythic",
	};

	const GEAR_TO_IMAGE_URL = {
		HEALTH: getGearImageUrl("Health"),
		DAMAGE: getGearImageUrl("Damage"),
		SPEED: getGearImageUrl("Speed"),
		SHIELD: getGearImageUrl("Shield"),
		VISION: getGearImageUrl("Vision"),
		"GADGET COOLDOWN": getGearImageUrl("Gadget"),
		"RELOAD SPEED": getGearImageUrl("Reload"),
		"PET POWER": getGearImageUrl("PetPower"),
		"SUPER CHARGE": getGearImageUrl("SuperCharge"),
	};

	const gears = {};

	for (const [_, _gear] of Object.entries(gearInfo)) {
		const gear = _gear as any;
		let modifierValue = gear.ModifierValue;
		const modifierType = gear.ModifierType;
		if (modifierType === "ticks") {
			modifierValue = modifierValue / 20; // 20 ticks per second
		}

		const name = tids[gear.TID].EN;
		const description = tids[gear.InfoTID].EN.replaceAll(/<c00cc00>([a-zA-Z0-9]+)<\/c>|NUM/g, (_: any, color: any) =>
			color ? "" : "x"
		)
			.replace(/<x>/, modifierValue)
			.replace("<c00cc00>", "")
			.replace("</c>", "");

		const rarity = (IG_RARITY_TO_ACTUAL_RARITY as any)[gear.Rarity];

		const brawlersAvaliableToUnresolved = gear.ExtraHerosAvailableTo;
		const brawlersAvaliableToArray = brawlersAvaliableToUnresolved
			? Array.isArray(brawlersAvaliableToUnresolved)
				? brawlersAvaliableToUnresolved
				: [brawlersAvaliableToUnresolved]
			: null;
		const brawlersAvaliableTo = brawlersAvaliableToArray
			? brawlersAvaliableToArray.map((brawler) => brawlers[brawler].id)
			: null;

		let url;

		if (brawlersAvaliableTo && brawlersAvaliableTo.length === 1) {
			const brawlerName = brawlApiBrawlers.find((b: any) => b.id === brawlersAvaliableTo[0]).name;
			url = await getGearImageUrl(brawlerName);
		} else {
			url = await (GEAR_TO_IMAGE_URL as any)[name];
		}

		(gears as any)[name] = {
			name,
			description,
			rarity,
			modifierType,
			modifierValue,
			brawlersAvaliableTo,
			url,
		};
	}

	for (const _gear of Object.values(gears)) {
		const gear = _gear as any;
		const { url, brawlersAvaliableTo } = gear;
		const directoryName = gear.name.replace(/\.| /g, "_").toLowerCase();

		if (brawlersAvaliableTo) {
			const brawlers = brawlersAvaliableTo.map((b: any) => brawlApiBrawlers.find((brawler: any) => brawler.id === b));
			const brawlerDirectoryNames = brawlers.map((b: any) => b.id);
			for (const dir of brawlerDirectoryNames) {
				const json = JSON.parse((await fs.readFile(`${BRAWLERS_DIR}/${dir}/data.json`)) as any);
				if (!json.gears) {
					json.gears = [];
				} else {
					delete json.gears;
					json.gears = [];
				}

				json.gears.push(gear);
				await fs.writeFile(`${BRAWLERS_DIR}/${dir}/data.json`, JSON.stringify(json, null, 2));
			}
		}

		await fs.mkdir(`${OUT_DIR}/${directoryName}`, { recursive: true });
		await downloadImageUrl(url, `${directoryName}/icon.png`);
		await fs.writeFile(`${OUT_DIR}/${directoryName}/info.json`, JSON.stringify(gear, null, 2));
		// await downloadImageUrl(url, `${directoryName}.png`);
	}

	await fs.writeFile(`${OUT_DIR}/all-info.json`, JSON.stringify(gears, null, 2));
}

void scrapeGears();
