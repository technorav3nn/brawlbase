import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { URL } from "node:url";

// Execute the production SQL against real SQLite, including transactions and triggers.
export class LocalD1 {
	constructor() {
		this.sql = new DatabaseSync(":memory:");
		this.sql.exec("PRAGMA foreign_keys = ON");
		const directory = new URL("../migrations/", import.meta.url);
		for (const file of readdirSync(directory)
			.filter((file) => file.endsWith(".sql"))
			.sort()) {
			this.sql.exec(readFileSync(new URL(file, directory), "utf8"));
		}
	}
	prepare(query) {
		return new LocalStatement(this, query, []);
	}
	async batch(statements) {
		this.sql.exec("BEGIN");
		try {
			const results = [];
			for (const statement of statements) results.push(await statement.all());
			this.sql.exec("COMMIT");
			return results;
		} catch (error) {
			this.sql.exec("ROLLBACK");
			throw error;
		}
	}
}

class LocalStatement {
	constructor(db, query, params) {
		this.db = db;
		this.query = query;
		this.params = params;
	}
	bind(...params) {
		assert.ok(params.length <= 100, "D1 parameter limit");
		assert.ok(
			params.every((value) => value !== undefined),
			"D1 rejects undefined"
		);
		return new LocalStatement(this.db, this.query, params);
	}
	async raw(options) {
		const statement = this.db.sql.prepare(this.query);
		const names = statement.columns().map((column) => column.name);
		const rows = statement.all(...this.params).map((row) => names.map((name) => row[name]));
		return options?.columnNames ? [names, ...rows] : rows;
	}
	async first() {
		return this.db.sql.prepare(this.query).get(...this.params) ?? null;
	}
	async all() {
		const statement = this.db.sql.prepare(this.query);
		if (statement.columns().length) return { results: statement.all(...this.params), success: true, meta: { changes: 0 } };
		return this.run();
	}
	async run() {
		const result = this.db.sql.prepare(this.query).run(...this.params);
		return { results: [], success: true, meta: { changes: Number(result.changes) } };
	}
}
