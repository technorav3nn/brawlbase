import assert from "node:assert/strict";
import test from "node:test";
import { BrawlStarsClient, SupercellAPIClientError } from "../dist/index.mjs";

test("client options, leaderboard envelopes, and retry ownership", async (context) => {
	const requests = [];
	let status = 200;
	context.mock.method(globalThis, "fetch", async (url, options) => {
		requests.push({ url: String(url), options });
		return new Response(JSON.stringify(status === 200 ? { items: [{ tag: "#P0Y" }] } : { reason: "accessDenied" }), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	});
	const api = new BrawlStarsClient("test-token", { baseURL: "https://api.example/v1", timeout: 10_000, retry: 0 });
	assert.deepEqual(await api.rankings.players.getPlayersRanking("global", 40), [{ tag: "#P0Y" }]);
	assert.deepEqual(await api.rankings.brawlers.getBrawlersRanking("US", "16000000", 40), [{ tag: "#P0Y" }]);
	assert.equal(requests[0].url, "https://api.example/v1/rankings/global/players?limit=40");
	assert.equal(new Headers(requests[0].options.headers).get("Authorization"), "Bearer test-token");
	status = 429;
	await assert.rejects(
		api.rankings.players.getPlayersRanking("global"),
		(error) => error instanceof SupercellAPIClientError && error.status === 429
	);
	assert.equal(requests.length, 3);
});
