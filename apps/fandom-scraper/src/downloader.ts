import { createWriteStream } from "node:fs";
import { stat, mkdir } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { AsyncQueue } from "@sapphire/async-queue";
import sharp from "sharp";

export async function exists(f: string) {
	try {
		await stat(f);
		return true;
	} catch {
		return false;
	}
}

async function replaceColorWithTransparency(
	inputPath: string,
	outputPath: string,
	targetColors: string[], // Array of colors like ["#c8c8c8"]
	tolerance: number = 10 // Tolerance level for color matching
) {
	// Convert hex color to RGB
	const hexToRgb = (hex: string) => {
		const bigint = Number.parseInt(hex.slice(1), 16);
		return {
			r: (bigint >> 16) & 255,
			g: (bigint >> 8) & 255,
			b: bigint & 255,
		};
	};

	const targetRGBs = targetColors.map(hexToRgb);
	const image = sharp(inputPath).ensureAlpha();
	const { width, height, channels } = await image.metadata();

	if (!width || !height || channels !== 4) {
		throw new Error("Image must have an alpha channel.");
	}
	const { data } = await image.raw().toBuffer({ resolveWithObject: true });

	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];

		for (const { r: tr, g: tg, b: tb } of targetRGBs) {
			if (Math.abs(r - tr) <= tolerance && Math.abs(g - tg) <= tolerance && Math.abs(b - tb) <= tolerance) {
				// Replace color with transparency
				data[i + 3] = 0; // Set alpha to 0 (transparent)
				break;
			}
		}
	}

	// Save the modified image
	await sharp(data, { raw: { width, height, channels: 4 } })
		.trim()
		.toFile(outputPath);
}

export class Downloader {
	private readonly queue = new AsyncQueue();

	async downloadAsset(url: string, outDir: string, outPath: string, removeWhite: boolean = false) {
		try {
			await this.queue.wait();
			await setTimeout(200);
			if (!(await exists(outDir))) {
				await mkdir(outDir, { recursive: true });
			}
			// const stream = createWriteStream(outPath, { flags: "w" });
			// await fetch(url).then((res) => Readable.fromWeb(res.body).pipe(stream));
			// await sharp()
			const res = await fetch(url);
			// eslint-disable-next-line n/prefer-global/buffer
			const buffer = Buffer.from(await res.arrayBuffer());

			// console.log(`Downloading ${url} to ${outPath}`);

			await sharp(buffer)
				.trim({ threshold: 20 })
				.webp({
					quality: 85,
				})
				.toFile(outPath.replace(".png", ".webp"));

			if (removeWhite) {
				await replaceColorWithTransparency(outPath.replace(".png", ".webp"), outPath.replace(".png", ".webp"), [
					"#8c8c8c",
					"#737373",
					"#5c5c5c",
					"#313131",
					"#1f1f1f",
				]);
			}

			this.queue.shift();
		} catch (e) {
			console.error(`Error downloading ${url}: ${e}`);
			this.queue.shift();
		}
	}

	async writeData(data: any, outDir: string, outPath: string) {
		await this.queue.wait();
		if (!(await exists(outDir))) {
			await mkdir(outDir, { recursive: true });
		}
		const stream = createWriteStream(outPath, { flags: "w" });
		stream.write(JSON.stringify(data, null, 2));
		stream.end();
		this.queue.shift();
	}

	async makeDir(dir: string) {
		await this.queue.wait();
		await mkdir(dir, { recursive: true });
		this.queue.shift();
	}
}
