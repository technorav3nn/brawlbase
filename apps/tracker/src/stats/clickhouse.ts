/* eslint-disable n/prefer-global/url -- URL is a native Cloudflare Workers API. */
export interface ClickHouseConnection {
	url: string;
	username: string;
	password: string;
	database: string;
}

export type QueryParameters = Record<string, string | number>;

/** Worker-compatible HTTP client. Credentials stay in headers, outside URLs and error messages. */
export class StatsDatabase {
	private readonly url: URL;
	private readonly headers: Record<string, string>;

	constructor(connection: ClickHouseConnection) {
		this.url = new URL(connection.url);
		if (this.url.username || this.url.password || this.url.search || this.url.hash) throw new Error("Invalid ClickHouse URL");
		if (
			this.url.protocol !== "https:" &&
			!(this.url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(this.url.hostname))
		)
			throw new Error("ClickHouse requires HTTPS");
		if (!/^[a-z_]\w*$/i.test(connection.database)) throw new Error("Invalid ClickHouse database");
		this.url.searchParams.set("database", connection.database);
		this.url.searchParams.set("output_format_json_quote_64bit_integers", "0");
		this.url.searchParams.set("max_execution_time", "15");
		this.url.searchParams.set("max_result_rows", "250000");
		this.url.searchParams.set("result_overflow_mode", "throw");
		this.url.searchParams.set("wait_end_of_query", "1");
		this.headers = {
			"Content-Type": "text/plain; charset=utf-8",
			"X-ClickHouse-User": connection.username,
			"X-ClickHouse-Key": connection.password,
		};
	}

	async query<Row>(query: string, parameters: QueryParameters = {}): Promise<Row[]> {
		const url = new URL(this.url);
		for (const [name, value] of Object.entries(parameters)) url.searchParams.set(`param_${name}`, String(value));
		const response = await fetch(url, {
			method: "POST",
			headers: this.headers,
			body: `${query}\nFORMAT JSON`,
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(`ClickHouse statistics query failed (${response.status})`);
		}
		const result = await response.json<{ data: Row[] }>();
		return result.data;
	}

	/** Wait for a successful flush before advancing the collector's outbox checkpoint. */
	async insert(table: "events" | "tracked_players", payload: string, token: string): Promise<void> {
		const url = new URL(this.url);
		url.searchParams.set("query", `INSERT INTO ${table} FORMAT JSONEachRow`);
		url.searchParams.set("async_insert", "1");
		url.searchParams.set("wait_for_async_insert", "1");
		url.searchParams.set("insert_deduplication_token", token);
		const response = await fetch(url, {
			method: "POST",
			headers: this.headers,
			body: payload,
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(`ClickHouse statistics insert failed (${response.status})`);
		}
		await response.text();
	}
}
