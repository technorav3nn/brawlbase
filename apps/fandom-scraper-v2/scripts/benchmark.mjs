// CPU-only parsing comparison, independent of Fandom availability and request latency.
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { expectedBrawler } from "./oracle.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const binary = process.env.FANDOM_BINARY ?? `${root}target/release/fandom-scraper-v2`;
const rounds = Number(process.argv[2] ?? 20);
const results = [];
for (const name of ["shelly", "kaze", "larry_lawrie", "meg", "nita"]) {
	const fixture = JSON.parse(gunzipSync(await readFile(`${root}tests/fixtures/${name}.json.gz`)));
	const path = `${root}target/benchmark-input.json`;
	await writeFile(path, JSON.stringify(fixture));
	expectedBrawler(fixture);
	expectedBrawler(fixture);
	const start = performance.now();
	for (let i = 0; i < rounds; i++) expectedBrawler(fixture);
	const legacyMs = performance.now() - start;
	const run = spawnSync(binary, ["bench-parse", path, String(rounds)], { encoding: "utf8" });
	if (run.status !== 0) throw new Error(run.stderr);
	const rustMs = JSON.parse(run.stdout).milliseconds;
	results.push({
		name,
		rounds,
		legacyMs: Math.round(legacyMs),
		rustMs: Math.round(rustMs),
		speedup: Number((legacyMs / rustMs).toFixed(2)),
	});
}
const legacy = results.reduce((n, r) => n + r.legacyMs, 0),
	rust = results.reduce((n, r) => n + r.rustMs, 0);
const report = { results, aggregateSpeedup: Number((legacy / rust).toFixed(2)) };
console.log(JSON.stringify(report, null, 2));
await writeFile(`${root}target/benchmark.json`, JSON.stringify(report, null, 2));
