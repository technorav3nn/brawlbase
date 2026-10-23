// Compare legacy fields; corrected profileIcons are covered by Rust regression tests.
import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
import { expectedBrawler } from "./oracle.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const binary = process.env.FANDOM_BINARY ?? `${root}target/debug/fandom-scraper-v2`;
let failures = 0;
function differences(actual, expected, path = "") {
	if (isDeepStrictEqual(actual, expected)) return [];
	if (actual && expected && typeof actual === "object" && typeof expected === "object") {
		return [...new Set([...Object.keys(actual), ...Object.keys(expected)])].flatMap((k) =>
			differences(actual[k], expected[k], `${path}/${k}`)
		);
	}
	return [{ path, actual, expected }];
}
for (const filename of (await readdir(`${root}tests/fixtures`)).filter((f) => f.endsWith(".json.gz")).sort()) {
	const fixture = JSON.parse(gunzipSync(await readFile(`${root}tests/fixtures/${filename}`)));
	const input = `${root}target/verify-input.json`;
	await writeFile(input, JSON.stringify(fixture));
	const expected = expectedBrawler(fixture);
	if (!isDeepStrictEqual(expected, fixture.expected)) throw new Error(`Stale expected output: ${filename}`);
	const run = spawnSync(binary, ["parse-brawler", input], { encoding: "utf8", maxBuffer: 20000000 });
	const actual = run.status === 0 ? JSON.parse(run.stdout) : null;
	if (actual) for (const skin of actual.skins) skin.profileIcons = [];
	const diff = actual ? differences(actual, expected) : [{ error: run.stderr }];
	console.log(fixture.name, diff.length ? `${diff.length} differences` : "identical");
	if (diff.length) {
		failures++;
		await writeFile(`${root}target/${filename}-diff.json`, JSON.stringify(diff, null, 2));
		console.log(JSON.stringify(diff.slice(0, 5), null, 2));
	}
}
process.exitCode = failures ? 1 : 0;
