import { writeFile } from "node:fs/promises";
import { URL } from "node:url";
import { search } from "fast-fuzzy";
const names = [
	"Fast Forward",
	"Fast Forward Plus",
	"FastForward",
	"Clay Pigeons",
	"Shell Shock",
	"Band-Aid",
	"Internal Flames",
	"Eternal Flame",
	"Order: Fall Back",
	"Gadget",
	"gadget",
	"Time for a Slow Song",
	"Slow Song",
	"Super Sticky",
	"Super Stiky",
	"Fire",
	"On Fire",
	"Fire Starter",
	"Café",
	"Cafe\u0301",
	"💥 Boom",
	"👨‍👩‍👧‍👦 Family",
	"Gracious Host",
	"Hensojutsu",
	"Fist of the North Star",
	"Físt",
	"İstanbul",
	"Gadget №1",
	"🔫",
];
const catalogs = [names, names.toReversed(), ["abcd", "abdc", "bcda", "cdab", "abc", "ab", "", "xyz"]].map((names) =>
	names.map((name, id) => ({ name, id }))
);
const cases = [];
for (const catalog of catalogs) {
	const queries = [
		"",
		"???",
		"unrelated",
		"Forward",
		"flames",
		"song",
		"ird",
		"FIRE!",
		"CAFÉ",
		"İSTANBUL",
		"👨‍👩‍👧‍👦",
		...catalog.flatMap(({ name }) => [
			name,
			` ${name.toUpperCase()} `,
			name.replaceAll(" ", ""),
			name.slice(1),
			name.slice(0, -1),
			name.slice(0, 2) + name.slice(3),
			name.slice(0, 2) + name.slice(3, 4) + name.slice(2, 3) + name.slice(4),
		]),
	];
	for (const query of queries.filter((q) => q.isWellFormed()))
		cases.push({ query, catalog, expected: search(query, catalog, { keySelector: (o) => o.name })[0]?.id ?? null });
}
await writeFile(new URL("../tests/fixtures/fuzzy.json", import.meta.url), JSON.stringify(cases));
console.log(cases.length, "fuzzy cases");
