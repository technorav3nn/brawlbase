import { Buffer } from "node:buffer";
// Pixel/byte comparisons against the actual old Downloader, with fixed local image inputs.
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import ts from "typescript";
const root = fileURLToPath(new URL("../", import.meta.url));
const binary = process.env.FANDOM_BINARY ?? `${root}target/debug/fandom-scraper-v2`;
const generated = `${root}target/images/`;
await mkdir(generated, { recursive: true });
const source = await readFile(new URL("../../fandom-scraper/src/downloader.ts", import.meta.url), "utf8");
await writeFile(
	`${generated}downloader.mjs`,
	ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText
);
const { Downloader } = await import(pathToFileURL(`${generated}downloader.mjs`));
const downloader = new Downloader();
const inputs = [];
for (const channels of [3, 4]) {
	const width = 192,
		height = 160;
	const pixels = Buffer.alloc(width * height * channels);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const offset = (y * width + x) * channels;
			const foreground = x >= 20 && x < 165 && y >= 14 && y < 140;
			const gray = [140, 115, 92, 49, 31][Math.floor(x / 40)];
			pixels[offset] = foreground ? (y < 60 ? 255 : gray) : 0;
			pixels[offset + 1] = foreground ? (y < 60 ? 35 : gray) : 0;
			pixels[offset + 2] = foreground ? (y < 60 ? 76 : gray) : 0;
			if (channels === 4) pixels[offset + 3] = foreground ? (x > 120 ? 160 : 255) : 0;
		}
	inputs.push([`rgb${channels}`, await sharp(pixels, { raw: { width, height, channels } }).png().toBuffer()]);
	inputs.push([`jpeg${channels}`, await sharp(pixels, { raw: { width, height, channels } }).jpeg().toBuffer()]);
}
if (process.argv.includes("--cached")) {
	for (const name of ["model", "portrait", "gadget", "skin"]) inputs.push([name, await readFile(`${generated}${name}.png`)]);
} else if (process.argv.includes("--live")) {
	const { gunzipSync } = await import("node:zlib");
	const fixture = JSON.parse(gunzipSync(await readFile(`${root}tests/fixtures/shelly.json.gz`)));
	for (const [name, asset] of [
		["model", fixture.expected.model],
		["portrait", fixture.expected.avatar],
		["gadget", fixture.expected.gadgets[0].asset],
		["skin", fixture.expected.skins[1].asset],
	]) {
		const res = await fetch(asset.sourceUrl);
		if (!res.ok) throw new Error(`${res.status} ${asset.sourceUrl}`);
		inputs.push([name, Buffer.from(await res.arrayBuffer())]);
	}
}
let failures = 0;
for (const [name, input] of inputs) {
	const inputPath = `${generated}${name}.png`;
	await writeFile(inputPath, input);
	for (const mode of ["asset", "remove-white", "gear"]) {
		const oldPath = `${generated}${name}-${mode}-old.webp`;
		const rustPath = `${generated}${name}-${mode}-rust.webp`;
		if (mode === "gear") await sharp(input).toFormat("webp").resize(80).toFile(oldPath);
		else {
			const original = globalThis.fetch;
			globalThis.fetch = async () => new Response(input);
			try {
				await downloader.downloadAsset(
					"https://fixture.test/image.png",
					generated,
					oldPath.replace(".webp", ".png"),
					mode === "remove-white"
				);
			} finally {
				globalThis.fetch = original;
			}
		}
		const result = spawnSync(binary, ["convert-image", inputPath, rustPath, ...(mode === "asset" ? [] : [`--${mode}`])], {
			encoding: "utf8",
		});
		if (result.status !== 0) {
			failures++;
			console.log(name, mode, result.stderr);
			continue;
		}
		const [old, rust] = await Promise.all([readFile(oldPath), readFile(rustPath)]);
		const [a, b] = await Promise.all([
			sharp(old).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
			sharp(rust).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
		]);
		const samePixels = a.info.width === b.info.width && a.info.height === b.info.height && a.data.equals(b.data);
		console.log(
			name,
			mode,
			old.equals(rust)
				? "identical bytes"
				: samePixels
					? "identical pixels"
					: `DIFFERENT ${a.info.width}x${a.info.height} / ${b.info.width}x${b.info.height}`
		);
		if (!samePixels) failures++;
	}
}
process.exitCode = failures ? 1 : 0;
